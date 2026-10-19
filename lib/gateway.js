// The local gateway HanaAgent talks to.
//
// It is deliberately a small reverse proxy rather than a second protocol
// translator. HanaAgent already speaks the provider's own wire API (chat
// completions, Responses, Anthropic Messages or Gemini), and a magpie
// provider plugin's `fetch` expects exactly that wire API after magpie's
// gateway has done its routing. So the gateway only has to: pick a provider
// account, rewrite the model id, add the account's sign-in, stream the
// answer through unchanged, and count what went past.
//
// Routing groups, per-account failover, a loopback-only listener and a port
// away from magpie's 3425/3426 are added on top.

import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import {
  jsonResponse, readJsonBody, isLoopbackAddress, safeEqual, truncate, nowMs, iso,
  num, sleep,
} from "./util.js";
import { decodeModelId, encodeModelId } from "./catalog.js";
import { pluginPathForNpm, hanaApiFor } from "./presets.js";

const RETRY_STATUS = new Set([401, 403, 408, 409, 425, 429, 500, 502, 503, 504, 529]);
const HOP_HEADERS = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length",
  "content-encoding", "authorization", "x-api-key", "accept-encoding",
]);

function headerObject(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (HOP_HEADERS.has(k.toLowerCase())) continue;
    out[k] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  return out;
}

function inferApi(pathname) {
  if (/:streamGenerateContent|:generateContent/.test(pathname)) return "google-generative-ai";
  if (/\/messages\/?$/.test(pathname)) return "anthropic-messages";
  if (/\/responses\/?$/.test(pathname)) return "openai-responses";
  return "openai-completions";
}

function parseUsageJson(obj, api) {
  const u = obj?.usage || obj?.response?.usage || obj?.message?.usage;
  if (u && typeof u === "object") {
    const input = num(u.input_tokens, num(u.prompt_tokens, 0));
    const output = num(u.output_tokens, num(u.completion_tokens, 0));
    const cached = num(u.cache_read_input_tokens, num(u.prompt_tokens_details?.cached_tokens, 0));
    if (input || output) return { input, output, cached };
  }
  const g = obj?.usageMetadata;
  if (g) {
    return {
      input: num(g.promptTokenCount, 0),
      output: num(g.candidatesTokenCount, 0),
      cached: num(g.cachedContentTokenCount, 0),
    };
  }
  return null;
}

function parseUsageSse(text, api) {
  let usage = null;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const obj = JSON.parse(payload);
      const got = parseUsageJson(obj, api);
      if (got) usage = { ...(usage || {}), ...got };
    } catch {}
  }
  return usage;
}

function costOf(descriptor, usage) {
  const c = descriptor?.cost;
  if (!c || !usage) return 0;
  const perM = (v) => (num(v, 0) || 0) / 1_000_000;
  let usd = (usage.input || 0) * perM(c.input) + (usage.output || 0) * perM(c.output);
  if (usage.cached && c.cache?.read) usd -= usage.cached * perM(c.input) - usage.cached * perM(c.cache.read);
  return usd > 0 ? usd : 0;
}

// HanaAgent installs a global undici dispatcher for its own outbound proxy.
// A plugin sharing that process must not let it send loopback gateway traffic
// through a proxy, so provider calls use node:http/node:https directly.
function requestUpstream(url, headers, body, signal) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (err) { reject(err); return; }
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      method: "POST",
      headers,
    }, (res) => {
      resolve({
        status: res.statusCode || 0,
        headers: res.headers,
        body: Readable.toWeb(res),
        abort: () => { try { req.destroy(); res.destroy(); } catch {} },
      });
    });
    req.on("error", reject);
    if (signal) {
      if (signal.aborted) { req.destroy(); reject(new DOMException("Aborted", "AbortError")); return; }
      signal.addEventListener("abort", () => { try { req.destroy(new DOMException("Aborted", "AbortError")); } catch {} }, { once: true });
    }
    if (body != null) req.write(body);
    req.end();
  });
}

export class Gateway {
  constructor(store, host) {
    this.store = store;
    this.host = host;
    this.catalog = null;
    this.server = null;
    this.port = store.config.port || 3525;
    this.hostName = "127.0.0.1";
    this.startedAt = 0;
    this.cursors = new Map();
    this.badAccounts = new Map();
    this.stats = { requests: 0, errors: 0, retries: 0, bytes: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
  }

  setCatalog(catalog) {
    // Non-enumerable: the gateway ← catalog link is a real cycle, and
    // HanaAgent serialises plugin descriptors when a plugin is installed.
    Object.defineProperty(this, "catalog", {
      value: catalog,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  }

  get baseUrl() { return `http://${this.hostName}:${this.port}`; }
  get v1() { return `${this.baseUrl}/v1`; }

  status() {
    return {
      running: !!this.server,
      port: this.port,
      baseUrl: this.baseUrl,
      v1: this.v1,
      startedAt: this.startedAt,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      stats: this.stats,
    };
  }

  async start(preferredPort) {
    if (this.server) return;
    const port = Number(preferredPort || this.store.config.port || 3525);
    try {
      await this._listen(port);
    } catch (err) {
      // Never silently move to another port: that leaves HanaAgent pointing
      // at a dead gateway while a stale instance keeps the old port, and two
      // servers then overwrite each other's state.
      this.store.log("error", `gateway failed to listen on ${port}`, err?.message || err);
      throw err;
    }
    this.port = port;
    this.startedAt = Date.now();
    this.store.log("info", `gateway listening on ${this.baseUrl}`);
  }

  _listen(port) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          try {
            if (!res.headersSent) jsonResponse(res, err.status || 500, { error: err.message || String(err) });
            else res.end();
          } catch {}
        });
      });
      server.on("error", (err) => {
        server.close();
        reject(err);
      });
      server.listen(port, this.hostName, () => {
        this.server = server;
        resolve();
      });
    });
  }

  async stop() {
    const server = this.server;
    this.server = null;
    this.startedAt = 0;
    if (!server) return;
    await new Promise((resolve) => server.close(() => resolve()));
  }

  async restart() {
    const port = this.store.config.port;
    await this.stop();
    await this.start(port);
  }

  _authorized(req, url) {
    const key = this.store.config.gatewayKey;
    if (!key) return true;
    if (isLoopbackAddress(req.socket?.remoteAddress || "")) {
      // HanaAgent and local tools may come without a key; non-loopback may
      // never.
      return true;
    }
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth || String(req.headers["x-api-key"] || "") || url.searchParams.get("key") || "";
    return safeEqual(token, key);
  }

  async handle(req, res) {
    const url = new URL(req.url || "/", this.baseUrl);
    const pathname = url.pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": req.headers.origin || "*",
        "access-control-allow-headers": "authorization, content-type, x-api-key, anthropic-version, anthropic-beta, x-hana-plugin-surface-session",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-max-age": "86400",
      });
      res.end();
      return;
    }
    if (req.headers.origin) {
      res.setHeader("access-control-allow-origin", req.headers.origin);
      res.setHeader("vary", "origin");
    }

    if (pathname === "/health" || pathname === "/api/magpie/health") {
      jsonResponse(res, 200, {
        ok: true,
        name: "hana-magpie",
        version: "1.0.0",
        port: this.port,
        gateway: this.status(),
        hana: this.catalog ? { providers: this.catalog.builtinProviders().length } : undefined,
        attribution: { magpie: "https://github.com/yetone/magpie" },
      });
      return;
    }

    if (!this._authorized(req, url)) {
      jsonResponse(res, 401, { error: { type: "authentication_error", message: "invalid gateway key" } });
      return;
    }

    if (pathname === "/v1/models" || pathname === "/models") {
      const models = await this.catalog.allModelsWithGroups();
      jsonResponse(res, 200, {
        object: "list",
        data: models.map((m) => ({
          id: m.key,
          object: "model",
          name: m.name,
          owned_by: m.providerName,
          provider: m.providerId,
          api: m.api,
          context_window: m.context || undefined,
          max_output_tokens: m.maxOutput || undefined,
        })),
      });
      return;
    }

    if (pathname === "/api/magpie/status") {
      jsonResponse(res, 200, {
        gateway: this.status(),
        models: (await this.catalog.allModelsWithGroups()).length,
        providers: (await this.catalog.allProviders()).length,
      });
      return;
    }

    if (pathname === "/api/magpie/quotas") {
      jsonResponse(res, 200, { quotas: await this.quotas(), at: iso() });
      return;
    }

    if (pathname === "/api/magpie/usage") {
      jsonResponse(res, 200, { totals: this.stats, rows: this.store.readUsage(Date.now() - 7 * 86400000, 1000) });
      return;
    }

    if (req.method !== "POST") {
      jsonResponse(res, 405, { error: "use POST for model requests" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req, 128 << 20);
    } catch (err) {
      jsonResponse(res, err.status || 400, { error: err.message });
      return;
    }
    const api = inferApi(pathname);
    let modelKey = body?.model;
    if (!modelKey && api === "google-generative-ai") {
      const m = /\/models\/([^:?/]+)/.exec(pathname);
      if (m) modelKey = decodeURIComponent(m[1]);
    }
    if (!modelKey) {
      jsonResponse(res, 400, { error: { type: "invalid_request_error", message: "missing model" } });
      return;
    }
    const descriptors = await this.resolveAttempts(modelKey, api);
    if (!descriptors.length) {
      jsonResponse(res, 404, { error: { type: "invalid_request_error", message: `unknown model ${modelKey}` } });
      return;
    }
    await this.forward(req, res, { rawBody: body, api, pathname, modelKey, descriptors });
  }

  async resolveAttempts(modelKey, api) {
    const decoded = decodeModelId(modelKey);
    if (!decoded) return [];
    if (decoded.kind === "group") {
      const group = this.store.groups().find((g) => g.id === decoded.provider || g.id === decoded.model);
      if (!group) return [];
      const members = [];
      for (const ref of group.models || []) {
        const m = await this.catalog.findModel(ref);
        if (m && m.kind !== "group") members.push(m);
      }
      return this.orderGroup(group, members.filter((m) => !m.api || m.api === api));
    }
    const one = await this.catalog.findModel(modelKey);
    return one && one.kind !== "group" ? [one] : [];
  }

  orderGroup(group, members) {
    if (!members.length) return [];
    if (group.routing === "round-robin") {
      const cur = this.cursors.get(group.id) || 0;
      this.cursors.set(group.id, (cur + 1) % members.length);
      return [...members.slice(cur), ...members.slice(0, cur)];
    }
    if (group.routing === "ordered") return [...members];
    // smart: put accounts that failed recently last, then rotate
    const cur = this.cursors.get(group.id) || 0;
    this.cursors.set(group.id, (cur + 1) % members.length);
    return [...members.slice(cur), ...members.slice(0, cur)];
  }

  accountsFor(descriptor) {
    if (descriptor.kind === "builtin") {
      const p = this.store.provider(descriptor.providerId);
      if (!p) return [];
      const accounts = (p.accounts || []).filter((a) => !a.disabled);
      if (p.keyless) return accounts.length ? accounts : [{ id: "local" }];
      return accounts.filter((a) => !!this.store.getBuiltinAuth(p.id, a.id));
    }
    const p = this.catalog.pluginProvider(descriptor.providerId);
    if (!p) return [];
    const accounts = Array.isArray(p.accounts) ? p.accounts : [];
    if (!accounts.length) return [{ account: "", id: "" }];
    const cur = this.cursors.get(`acct:${descriptor.providerId}`) || 0;
    this.cursors.set(`acct:${descriptor.providerId}`, (cur + 1) % accounts.length);
    return [...accounts.slice(cur), ...accounts.slice(0, cur)].map((a) => ({ id: a.account || a.id, account: a.account || a.id }));
  }

  badKey(descriptor, accountId) {
    return `${descriptor.kind}:${descriptor.providerId}:${accountId}`;
  }

  accountHealthy(descriptor, accountId) {
    const bad = this.badAccounts.get(this.badKey(descriptor, accountId));
    return !bad || bad.until < Date.now();
  }

  markBad(descriptor, accountId, status, error) {
    const key = this.badKey(descriptor, accountId);
    const ms = status === 429 ? 30000 : 60000;
    this.badAccounts.set(key, { until: Date.now() + ms, status, error: truncate(error, 300) });
  }

  upstreamUrl(descriptor, { api, pathname, modelId, stream }) {
    if (descriptor.kind === "builtin") {
      const p = this.store.provider(descriptor.providerId);
      const auth = p?.accounts?.length ? this.store.getBuiltinAuth(p.id, p.accounts[0].id) : null;
      const base = String(auth?.baseUrl || p?.baseUrl || "").replace(/\/+$/, "");
      if (!base) throw new Error("provider has no base URL");
      const apiKind = descriptor.api || "openai-completions";
      if (apiKind === "anthropic-messages") {
        return base.endsWith("/v1") ? `${base}/messages` : `${base}/v1/messages`;
      }
      if (apiKind === "openai-responses") return `${base}/responses`;
      if (apiKind === "google-generative-ai") {
        return `${base}/models/${encodeURIComponent(modelId)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
      }
      return `${base}/chat/completions`;
    }
    // plugin
    return null; // filled by caller after loader
  }

  async forward(req, res, ctx) {
    const { rawBody, api, pathname, modelKey, descriptors } = ctx;
    const started = nowMs();
    let lastError = null;
    let lastStatus = 0;
    const attempts = [];

    for (const descriptor of descriptors) {
      const accounts = this.accountsFor(descriptor);
      if (!accounts.length) {
        lastError = `${descriptor.providerName} has no signed-in account`;
        continue;
      }
      for (const account of accounts) {
        const accountId = account.account ?? account.id ?? "";
        if (!this.accountHealthy(descriptor, accountId)) continue;
        attempts.push({ descriptor, accountId });
        try {
          const out = await this.forwardOnce(req, descriptor, accountId, ctx);
          if (!out || out.retry) {
            lastStatus = out?.status || lastStatus;
            lastError = out?.message || lastError;
            if (out?.status && RETRY_STATUS.has(out.status)) {
              this.markBad(descriptor, accountId, out.status, out.message || `HTTP ${out.status}`);
            }
            this.stats.retries++;
            continue;
          }
          await this.writeResponse(req, res, descriptor, accountId, out, ctx, started);
          return;
        } catch (err) {
          lastError = err?.message || String(err);
          this.store.log("warn", `request ${descriptor.providerId}/${descriptor.modelId} via ${accountId || "default"} failed: ${truncate(lastError, 400)}`);
          this.markBad(descriptor, accountId, 0, lastError);
        }
      }
    }

    this.stats.errors++;
    const status = lastStatus && RETRY_STATUS.has(lastStatus) ? lastStatus : 502;
    const message = lastError || "no provider account could serve this request";
    jsonResponse(res, status, {
      error: {
        type: "upstream_error",
        message: `Hana Magpie: ${message}`,
        attempts: attempts.length,
      },
    });
  }

  async forwardOnce(req, descriptor, accountId, { rawBody, api, pathname }) {
    // Only an explicit stream:true means SSE. HanaAgent's utility calls omit
    // the field and expect a JSON reply, exactly as the OpenAI SDK does.
    const stream = rawBody?.stream === true;
    const body = { ...rawBody, model: descriptor.apiId || descriptor.modelId };
    let url;
    let headers = {};
    let npm = descriptor.npm;
    let proxy = this.store.config.proxy || "";

    if (descriptor.kind === "builtin") {
      const p = this.store.provider(descriptor.providerId);
      const auth = this.store.getBuiltinAuth(p.id, accountId) || {};
      const base = String(auth.baseUrl || p.baseUrl || "").replace(/\/+$/, "");
      const apiKind = descriptor.api || p.api || "openai-completions";
      if (!base) return { retry: true, message: "provider has no base URL" };
      if (apiKind === "anthropic-messages") {
        url = base.endsWith("/v1") ? `${base}/messages` : `${base}/v1/messages`;
        if (auth.key) headers["x-api-key"] = auth.key;
        headers["anthropic-version"] = req.headers["anthropic-version"] || "2023-06-01";
      } else if (apiKind === "openai-responses") {
        url = `${base}/responses`;
        if (auth.key) headers.authorization = `Bearer ${auth.key}`;
      } else if (apiKind === "google-generative-ai") {
        url = `${base}/models/${encodeURIComponent(descriptor.apiId || descriptor.modelId)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
        if (auth.key) headers["x-goog-api-key"] = auth.key;
      } else {
        url = `${base}/chat/completions`;
        if (auth.key) headers.authorization = `Bearer ${auth.key}`;
      }
      for (const [k, v] of Object.entries(p.headers || {})) headers[k] = String(v);
      for (const [k, v] of Object.entries(req.headers || {})) {
        const key = k.toLowerCase();
        if (HOP_HEADERS.has(key)) continue;
        if (headers[key] !== undefined) continue;
        headers[key] = Array.isArray(v) ? v.join(", ") : String(v);
      }
    } else {
      const p = this.catalog.pluginProvider(descriptor.providerId);
      if (!p) return { retry: true, message: "provider plugin is not loaded" };
      const loaded = await this.host.load({ provider: p.id, account: accountId, proxy });
      const base = String(loaded?.baseURL || p.api || "").replace(/\/+$/, "");
      if (!base) return { retry: true, message: "provider plugin returned no base URL" };
      const kind = pluginPathForNpm(npm || p.npm || "@ai-sdk/openai-compatible");
      const apiId = descriptor.apiId || descriptor.modelId;
      if (kind === "anthropic") url = `${base}/messages`;
      else if (kind === "responses") url = `${base}/responses`;
      else if (kind === "gemini") url = `${base}/models/${encodeURIComponent(apiId)}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
      else url = `${base}/chat/completions`;
      headers = {
        "content-type": "application/json",
        accept: stream ? "text/event-stream" : "application/json",
      };
      // Magpie passes the gateway request's headers through to the plugin's
      // fetch; a few vendors (Anthropic betas, OpenAI betas) need them.
      for (const [k, v] of Object.entries(req.headers || {})) {
        const key = k.toLowerCase();
        if (HOP_HEADERS.has(key) || key === "x-api-key" || key === "cookie") continue;
        if (headers[key] !== undefined) continue;
        headers[key] = Array.isArray(v) ? v.join(", ") : String(v);
      }
      // Host applies the account's own headers and chat.headers hooks.
      const session = String(req.headers["x-hana-session-id"] || req.headers["x-session-id"] || "");
      const out = await this.host.fetchStream({
        provider: p.id,
        account: accountId,
        model: descriptor.modelId,
        npm: npm || p.npm,
        url,
        method: "POST",
        headers,
        body,
        session,
      });
      if (out.status >= 400) {
        let text = "";
        try {
          const chunks = [];
          for await (const chunk of Readable.fromWeb(out.body)) chunks.push(Buffer.from(chunk));
          text = Buffer.concat(chunks).toString("utf8");
        } catch {}
        return { retry: true, status: out.status, message: text.slice(0, 800) || `HTTP ${out.status}` };
      }
      return out;
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 600000);
    timer.unref?.();
    let upstream;
    try {
      upstream = await requestUpstream(url, headers, JSON.stringify(body), ctl.signal);
    } catch (err) {
      clearTimeout(timer);
      const cause = err?.cause?.message || err?.cause?.code || err?.code || "";
      return { retry: true, message: `network: ${err.message}${cause ? ` (${cause})` : ""}` };
    }
    if (upstream.status >= 400) {
      let text = "";
      try {
        const chunks = [];
        for await (const chunk of Readable.fromWeb(upstream.body)) chunks.push(Buffer.from(chunk));
        text = Buffer.concat(chunks).toString("utf8");
      } catch {}
      clearTimeout(timer);
      return { retry: true, status: upstream.status, message: text.slice(0, 800) || `HTTP ${upstream.status}` };
    }
    const outHeaders = {};
    for (const [k, v] of Object.entries(upstream.headers || {})) {
      if (!HOP_HEADERS.has(k.toLowerCase()) && v !== undefined) outHeaders[k] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    return { status: upstream.status, headers: outHeaders, body: upstream.body, abort: () => { ctl.abort(); upstream.abort?.(); clearTimeout(timer); } };
  }

  async writeResponse(req, res, descriptor, accountId, out, ctx, started) {
    const headers = { ...(out.headers || {}) };
    delete headers["content-length"];
    delete headers["content-encoding"];
    delete headers["transfer-encoding"];
    delete headers["connection"];
    headers["cache-control"] = headers["cache-control"] || "no-store";
    headers["x-hana-magpie-provider"] = descriptor.providerId;
    headers["x-hana-magpie-model"] = descriptor.modelId;
    res.writeHead(out.status || 200, headers);
    this.stats.requests++;
    const ttft = nowMs() - started;

    const chunks = [];
    let usageText = "";
    const MAX_CAPTURE = 4 << 20;
    let bytes = 0;
    let usage = null;
    const contentType = String(headers["content-type"] || "").toLowerCase();
    const isSse = contentType.includes("text/event-stream") || ctx.rawBody?.stream === true;
    let closed = false;
    req.on("close", () => { if (!res.writableEnded) { closed = true; out.abort?.(); } });

    try {
      const source = Readable.fromWeb(out.body);
      for await (const chunk of source) {
        if (closed) break;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buf.length;
        if (usageText.length < MAX_CAPTURE) usageText += buf.toString("utf8");
        if (!res.write(buf)) await new Promise((r) => res.once("drain", r));
      }
    } catch (err) {
      if (!closed) {
        this.store.log("warn", "stream ended early", err?.message || err);
      }
    } finally {
      if (!res.writableEnded) res.end();
      try { out.abort?.(); } catch {}
      if (isSse) usage = parseUsageSse(usageText, ctx.api);
      if (!usage) {
        try { usage = parseUsageJson(JSON.parse(usageText), ctx.api); } catch {}
      }
      usage = usage || { input: 0, output: 0, cached: 0 };
      const cost = costOf(descriptor, usage);
      const row = {
        at: nowMs(),
        ms: nowMs() - started,
        ttftMs: ttft,
        provider: descriptor.providerId,
        providerName: descriptor.providerName,
        model: descriptor.modelId,
        modelName: descriptor.name,
        account: accountId || "default",
        api: ctx.api,
        status: out.status || 200,
        input: usage.input || 0,
        output: usage.output || 0,
        cached: usage.cached || 0,
        total: (usage.input || 0) + (usage.output || 0),
        bytes,
        cost,
      };
      this.store.recordUsage(row);
      this.stats.bytes += bytes;
      this.stats.inputTokens += row.input;
      this.stats.outputTokens += row.output;
      this.stats.cost += cost;
      this.store.log("info", `${descriptor.providerId}/${descriptor.modelId} ${row.status} ${row.ms}ms ${row.input}+${row.output} tok`);
    }
  }

  async quotas() {
    const out = [];
    for (const p of this.catalog.builtinProviders()) {
      out.push({
        provider: p.id,
        name: p.name,
        kind: "builtin",
        accounts: (p.accounts || []).map((a) => ({ account: a.id, name: a.name || a.id, windows: [], plan: "", error: "" })),
      });
    }
    for (const p of await this.catalog.pluginProviderList()) {
      const accounts = Array.isArray(p.accounts) ? p.accounts : [];
      const rows = [];
      for (const a of accounts) {
        const row = { account: a.account || a.id, name: a.name || a.account || a.id, windows: [], plan: "", error: "" };
        if (p.usage) {
          try {
            const u = await this.pluginUsage(p.id, a.account || a.id);
            row.plan = u?.plan || "";
            row.windows = u?.windows || [];
            row.error = u?.error || "";
            row.user = u?.user || "";
            row.signIn = u?.signIn || "";
          } catch (err) {
            row.error = err.message;
          }
        }
        rows.push(row);
      }
      out.push({ provider: p.id, name: p.name, kind: "plugin", accounts: rows });
    }
    return out;
  }

  async pluginUsage(provider, account) {
    return await this.host.usage({ provider, account, proxy: this.store.config.proxy || "" });
  }
}

export { inferApi };
