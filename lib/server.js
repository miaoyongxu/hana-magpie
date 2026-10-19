// One object that owns the gateway, the provider-plugin host, the catalog
// and the bridge into HanaAgent. The lifecycle entry point and every route
// share it through a global registry, because HanaAgent imports plugin files
// as separate ESM modules.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Store } from "./state.js";
import { createPluginHost } from "./host-client.js";
import { Catalog, decodeModelId } from "./catalog.js";
import { Gateway } from "./gateway.js";
import { HanaClient, PROVIDER_ID } from "./hana.js";
import { installPlugin, removePluginFiles, searchNpm, loadMarket, checkPluginUpdate } from "./installer.js";
import { hanaApiFor } from "./presets.js";
import { mapLimit, sleep, safeId, truncate } from "./util.js";

const REGISTRY = Symbol.for("hana-magpie.servers.v1");
export const SERVER_API = "1.2.0";
const PLUGIN_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CARD_FACE_PATH = path.join(PLUGIN_ROOT, "assets", "card-face.png");

function registryHolder() {
  // HanaAgent can evaluate plugin modules in separate module contexts. Those
  // share `process`, but not always `globalThis`; keeping the singleton on
  // `process` prevents a second Server (and a second gateway) from starting.
  return typeof process !== "undefined" ? process : globalThis;
}

function registry() {
  const holder = registryHolder();
  if (!holder[REGISTRY]) holder[REGISTRY] = new Map();
  return holder[REGISTRY];
}

export async function getServer(ctx) {
  const dataDir = ctx?.dataDir;
  if (!dataDir) throw new Error("Hana Magpie needs ctx.dataDir");
  const key = path.resolve(dataDir);
  if (registry().has(key)) {
    const s = registry().get(key);
    if (s.apiVersion === SERVER_API) {
      if (ctx?.log && !s.ctxLog) s.ctxLog = ctx.log;
      return s;
    }
    // A plugin reinstall replaces the module code but not the global
    // registry; an old Server instance would keep answering with the old
    // API. Retire it and build the new one.
    try { await s.stop(); } catch {}
    registry().delete(key);
  }
  const server = new Server(dataDir, ctx);
  registry().set(key, server);
  return server;
}

export class Server {
  constructor(dataDir, ctx = {}) {
    this.apiVersion = SERVER_API;
    this.dataDir = dataDir;
    this.ctx = ctx;
    this.store = new Store(dataDir);
    this.host = null;
    this.catalog = null;
    this.gateway = null;
    this.hana = null;
    this.started = false;
    this.starting = null;
    this.syncTimer = null;
    this.syncPromise = null;
    this.lastSync = { at: 0, ok: false, count: 0, error: "" };
    this.hostReady = false;
  }

  log(level, ...args) {
    this.store.log(level, ...args);
    try { this.ctx?.log?.[level]?.("[hana-magpie]", ...args); } catch {}
  }

  async start() {
    if (this.started) return this;
    if (this.starting) return this.starting;
    this.starting = this._start().finally(() => { this.starting = null; });
    return this.starting;
  }

  async _start() {
    this.store.ensure();
    this.log("info", "starting", { dataDir: this.dataDir });
    this.host = createPluginHost(this.store);
    this.gateway = new Gateway(this.store, this.host);
    this.catalog = new Catalog(this.store, this.host, this.gateway);
    this.gateway.setCatalog(this.catalog);
    this.hana = new HanaClient(this.store, this.gateway);
    try {
      await this.gateway.start(this.store.config.port);
    } catch (err) {
      this.log("error", "gateway did not start", err?.message || err);
    }
    this.started = true;
    // The host may need to install nothing but still loads every plugin and
    // asks vendors for model lists; keep it off the startup path.
    this.bootstrapHost().catch((err) => this.log("warn", "plugin host bootstrap failed", err?.message || err));
    return this;
  }

  async bootstrapHost() {
    try {
      // The server writes server-info.json after plugins load, so the first
      // sync can race it. Wait briefly rather than treating the host as gone.
      for (let i = 0; i < 60 && !this.hana.available(); i++) await sleep(1000);
      const hasPlugins = this.store.plugins().some((p) => !p.off);
      if (hasPlugins) {
        await this.host.ensure();
        this.hostReady = true;
        await this.catalog.pluginProviderList({ force: true });
      }
      const r = await this.syncProvider();
      if (!r?.ok) this.scheduleSync(5000);
      this.ensureCardFace().catch((err) => this.log("warn", "card face:", err?.message || err));
    } catch (err) {
      this.log("warn", "bootstrap host:", err?.message || err);
      const r = await this.syncProvider().catch(() => null);
      if (!r?.ok) this.scheduleSync(5000);
    }
  }

  async ensureCardFace() {
    // HanaAgent renders a page card for every plugin page. Its default face
    // is a generated pattern; set the Magpie face once if the user has not
    // chosen one, so the card center shows the actual plugin artwork.
    if (!this.hana?.available() || !fs.existsSync(CARD_FACE_PATH)) return;
    const cardEntityId = `plugin-surface:${PROVIDER_ID}:page`;
    const faces = await this.hana.cardFaces();
    if (faces?.faces?.[cardEntityId]) return;
    const bytes = fs.readFileSync(CARD_FACE_PATH);
    await this.hana.setCardFaceImage(cardEntityId, "hana-magpie-card.png", bytes.toString("base64"));
    this.log("info", "Magpie card face set");
  }

  async stop() {
    this.started = false;
    clearTimeout(this.syncTimer);
    try { await this.host?.stop(); } catch {}
    try { await this.gateway?.stop(); } catch {}
    this.log("info", "stopped");
  }

  // ---- HanaAgent provider sync --------------------------------------------

  async hanaModelEntries() {
    const models = await this.catalog.allModelsWithGroups();
    return models.map((m) => {
      const entry = {
        id: m.key,
        name: `${m.providerName} · ${m.name}`.replace(/^group:/, ""),
        api: hanaApiFor(m.api),
        image: !!m.image,
        reasoning: !!m.reasoning,
      };
      // HanaAgent validates any present context/maxOutput as a positive
      // finite number, so unknown values are omitted rather than sent as 0.
      if (m.context > 0) entry.context = Math.round(m.context);
      if (m.maxOutput > 0) entry.maxOutput = Math.round(m.maxOutput);
      return entry;
    });
  }

  scheduleSync(delay = 800) {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncProvider().catch((err) => this.log("warn", "provider sync:", err?.message || err));
    }, delay);
    this.syncTimer.unref?.();
  }

  // ---- providers -----------------------------------------------------------

  async providerDetail(id, kind = "builtin") {
    const detail = await this.catalog.providerDetail(id, kind);
    if (!detail) throw new Error("no such provider");
    return detail;
  }

  async toggleProvider(id, kind, off) {
    await this.catalog.setProviderOff(id, kind, off);
    await this.syncProvider();
    return { ok: true, off: !!off };
  }

  async arrangeProvider(id, direction) {
    const order = await this.catalog.arrangeProvider(id, direction);
    return { ok: true, order };
  }

  async setModelEnabled(id, kind, modelId, off) {
    await this.catalog.setModelOff(id, kind, modelId, off);
    await this.syncProvider();
    return { ok: true, off: !!off };
  }

  async setModelsEnabled(id, kind, states) {
    await this.catalog.setModelsOff(id, kind, states);
    await this.syncProvider();
    return { ok: true };
  }

  async removeProvider(id, kind = "builtin") {
    if (kind === "plugin") {
      await this.catalog.removeProvider(id, kind);
      await this.syncProvider();
      return { ok: true };
    }
    const ok = this.store.removeProvider(id);
    await this.syncProvider();
    return { ok };
  }

  async restoreProvider(id, kind = "plugin") {
    await this.catalog.restoreProvider(id, kind);
    await this.syncProvider();
    return { ok: true };
  }

  async testProvider(id, kind, modelId) {
    const detail = await this.catalog.providerDetail(id, kind);
    if (!detail) throw new Error("no such provider");
    const models = await this.catalog.modelsForProvider(id, kind);
    const chosen = modelId ? models.find((m) => m.modelId === modelId) : models[0];
    if (!chosen) throw new Error("这个供应商还没有可用模型");
    await this.syncProvider();
    const started = Date.now();
    try {
      const r = await this.hana.request("/api/models/health", {
        method: "POST",
        body: { modelId: chosen.key, provider: "hana-magpie" },
        timeout: 30000,
      });
      return {
        ok: !!r?.ok,
        status: r?.status || 0,
        model: chosen.modelId,
        provider: chosen.providerName,
        ms: Date.now() - started,
        error: r?.ok ? "" : (r?.error || "健康检查失败"),
      };
    } catch (err) {
      return { ok: false, model: chosen.modelId, provider: chosen.providerName, ms: Date.now() - started, error: err.message };
    }
  }

  async syncProvider() {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = (async () => {
      if (!this.hana) return this.lastSync;
      const entries = await this.hanaModelEntries();
      const signature = `${this.gateway.baseUrl}|${JSON.stringify(entries)}`;
      if (this.lastSync.ok && this.lastSignature === signature) return this.lastSync;
      if (!entries.length) {
        // Everything was turned off or removed: don't leave stale models in
        // HanaAgent's picker that the gateway can no longer serve.
        if (this.lastSync.count > 0) {
          try { await this.hana.putProvider([]); } catch (err) { this.log("warn", "clear provider models failed", err?.message || err); }
        }
        this.lastSync = { at: Date.now(), ok: false, count: 0, error: "no models yet" };
        return this.lastSync;
      }
      const r = await this.hana.syncProvider(entries);
      this.lastSignature = signature;
      this.lastSync = { at: Date.now(), ok: !!r.ok, count: entries.length, error: r.error || "" };
      return this.lastSync;    })().finally(() => { this.syncPromise = null; });
    return this.syncPromise;
  }

  async refreshProviders({ restartHost = false } = {}) {
    if (restartHost) {
      await this.host.stop();
      this.hostReady = false;
      if (this.store.plugins().some((p) => !p.off)) {
        await this.host.ensure();
        this.hostReady = true;
      }
    }
    await this.catalog.pluginProviderList({ force: true });
    await this.syncProvider();
    return await this.catalog.allProviders();
  }

  // ---- agents --------------------------------------------------------------

  async agents() {
    const list = await this.hana.listAgents();
    const configs = await mapLimit(list, 4, async (a) => {
      try { return await this.hana.agentConfig(a.id); } catch { return null; }
    });
    const models = await this.catalog.allModelsWithGroups().catch(() => []);
    return list.map((a, i) => {
      const chat = this.hana.chatOfConfig(configs[i]);
      const descriptor = chat?.id ? models.find((m) => m.key === chat.id) : null;
      const magpie = chat?.provider === PROVIDER_ID;
      return {
        id: a.id,
        name: a.name,
        avatar: a.avatar || null,
        emoji: a.emoji || null,
        description: a.description || "",
        chat,
        onMagpie: magpie,
        modelName: descriptor ? `${descriptor.providerName} · ${descriptor.name}` : chat?.id || "",
        saved: this.store.config.agents[a.id] || null,
      };
    });
  }

  async connectAgent(agentId, modelKey) {
    const descriptor = await this.catalog.findModel(modelKey);
    if (!descriptor) throw new Error(`unknown model: ${modelKey}`);
    let previous = null;
    try {
      const cfg = await this.hana.agentConfig(agentId);
      const chat = this.hana.chatOfConfig(cfg);
      if (chat?.id && chat.provider !== PROVIDER_ID) previous = { id: chat.id, provider: chat.provider };
    } catch {}
    await this.syncProvider();
    return await this.hana.setAgentChat(agentId, descriptor.key, { previous });
  }

  async disconnectAgent(agentId) {
    return await this.hana.restoreAgentChat(agentId);
  }

  // ---- usage ---------------------------------------------------------------

  periodStart(period) {
    const now = new Date();
    if (period === "today") {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if (period === "7d") return Date.now() - 7 * 86400000;
    if (period === "30d") return Date.now() - 30 * 86400000;
    return 0;
  }

  usageSummary(period = "today") {
    const since = this.periodStart(period);
    const rows = this.store.readUsage(since);
    const totals = { calls: 0, errors: 0, input: 0, output: 0, cost: 0, ms: 0, bytes: 0 };
    const byProvider = new Map();
    const byModel = new Map();
    const byAccount = new Map();
    const byDay = new Map();
    for (const r of rows) {
      totals.calls++;
      if (r.status >= 400) totals.errors++;
      totals.input += r.input || 0;
      totals.output += r.output || 0;
      totals.cost += r.cost || 0;
      totals.ms += r.ms || 0;
      totals.bytes += r.bytes || 0;
      const day = new Date(r.at).toISOString().slice(0, 10);
      const d = byDay.get(day) || { day, calls: 0, input: 0, output: 0, cost: 0 };
      d.calls++; d.input += r.input || 0; d.output += r.output || 0; d.cost += r.cost || 0;
      byDay.set(day, d);
      for (const [map, key, label] of [
        [byProvider, r.provider, r.providerName || r.provider],
        [byModel, `${r.provider}/${r.model}`, `${r.providerName || r.provider} · ${r.modelName || r.model}`],
        [byAccount, `${r.provider}/${r.account}`, `${r.providerName || r.provider} · ${r.account}`],
      ]) {
        const cur = map.get(key) || { key, label, calls: 0, input: 0, output: 0, cost: 0, errors: 0 };
        cur.calls++; cur.input += r.input || 0; cur.output += r.output || 0; cur.cost += r.cost || 0;
        if (r.status >= 400) cur.errors++;
        map.set(key, cur);
      }
    }
    const sort = (m) => [...m.values()].sort((a, b) => b.calls - a.calls).slice(0, 30);
    return {
      period, since,
      totals: { ...totals, avgMs: totals.calls ? Math.round(totals.ms / totals.calls) : 0 },
      providers: sort(byProvider),
      models: sort(byModel),
      accounts: sort(byAccount),
      days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
      recent: rows.slice(-80).reverse(),
    };
  }

  logLines(limit = 300) {
    try {
      const text = fs.readFileSync(this.store.logPath, "utf8");
      return text.split(/\r?\n/).filter(Boolean).slice(-limit);
    } catch {
      return [];
    }
  }

  // ---- state for the UI ----------------------------------------------------

  async state() {
    if (!this.lastSync.ok && this.hana.available()) this.scheduleSync(300);
    const [providers, models, agents] = await Promise.all([
      this.catalog.allProviders().catch(() => []),
      this.catalog.allModelsWithGroups().catch(() => []),
      this.agents().catch(() => []),
    ]);
    const pluginStatus = this.store.plugins().map((p) => ({
      spec: p.spec,
      name: p.name,
      version: p.version,
      source: p.source,
      target: p.target,
      off: !!p.off,
      options: p.options || null,
      addedAt: p.addedAt,
      provides: providers.filter((x) => x.spec === p.spec).map((x) => x.id),
    }));
    return {
      version: "1.0.0",
      pluginId: "hana-magpie",
      gateway: this.gateway.status(),
      gatewayKeyMasked: this.store.config.gatewayKey ? this.store.config.gatewayKey.slice(0, 6) + "…" + this.store.config.gatewayKey.slice(-4) : "",
      hana: await this.hana.status().catch((err) => ({ online: false, error: err.message })),
      providers,
      removedProviders: this.catalog.removedPluginProviders(),
      models: models.map((m) => ({
        key: m.key, ref: m.ref, name: m.name, providerId: m.providerId, providerName: m.providerName,
        providerIcon: m.providerIcon, kind: m.kind, modelId: m.modelId, api: m.api,
        context: m.context, maxOutput: m.maxOutput, image: m.image, reasoning: m.reasoning,
        variants: m.variants, free: m.free, members: m.members, routing: m.routing,
      })),
      groups: this.store.groups().map((g) => this.catalog.groupDescriptor(g)),
      agents,
      plugins: pluginStatus,
      host: this.host.status(),
      lastSync: this.lastSync,
      settings: this.publicSettings(),
      stats: this.gateway.stats,
      market: loadMarket(this.store),
      attribution: [
        { name: "magpie", url: "https://github.com/yetone/magpie", license: "MIT", what: "provider plugin protocol, host, gateway behaviour and UI design" },
        { name: "OpenCode plugin API", url: "https://opencode.ai/docs/plugins/", license: "MIT", what: "the plugin hook contract magpie and this plugin implement" },
        { name: "HanaAgent / OpenHanako", url: "https://github.com/liliMozi/openhanako", license: "Apache-2.0", what: "the host this runs inside" },
        { name: "magpie-community/plugins", url: "https://github.com/magpie-community/plugins", license: "MIT", what: "community provider plugins listed in the market" },
      ],
    };
  }

  publicSettings() {
    return {
      port: this.store.config.port,
      language: this.store.config.language,
      theme: this.store.config.theme,
      proxy: this.store.config.proxy,
      registry: this.store.config.registry,
      autoSync: this.store.config.autoSync,
      gatewayKeySet: !!this.store.config.gatewayKey,
    };
  }

  async updateSettings(patch = {}) {
    const before = { ...this.store.config };
    for (const key of ["language", "theme", "proxy", "registry", "autoSync"]) {
      if (patch[key] !== undefined) this.store.config[key] = patch[key];
    }
    if (patch.port !== undefined) {
      const port = Number(patch.port);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("port must be between 1024 and 65535");
      if (port === 3425 || port === 3426) throw new Error("that is magpie's own gateway port; choose another one (the default here is 3525)");
      this.store.config.port = port;
    }
    this.store.save();
    let gatewayChanged = false;
    if (patch.port !== undefined && patch.port !== before.port) {
      await this.gateway.stop();
      await this.gateway.start(this.store.config.port);
      gatewayChanged = true;
    }
    if (patch.registry !== undefined) {
      // new registry for future installs; existing plugins stay as they are
    }
    if (gatewayChanged) await this.syncProvider();
    return this.publicSettings();
  }

  async regenerateKey() {
    const { randomToken } = await import("./util.js");
    this.store.config.gatewayKey = randomToken("hm");
    this.store.save();
    await this.syncProvider();
    return { gatewayKey: this.store.config.gatewayKey };
  }

  async gatewayInfo({ exposeKey = false } = {}) {
    return {
      ...this.gateway.status(),
      gatewayKey: exposeKey ? this.store.config.gatewayKey : undefined,
      gatewayKeyMasked: this.store.config.gatewayKey ? this.store.config.gatewayKey.slice(0, 6) + "…" + this.store.config.gatewayKey.slice(-4) : "",
      providerId: PROVIDER_ID,
    };
  }

  // ---- plugins -------------------------------------------------------------

  async addPlugin(spec, options) {
    const entry = await installPlugin(this.store, spec, options);
    this.log("info", `plugin installed: ${entry.spec} -> ${entry.target}`);
    await this.refreshProviders({ restartHost: true });
    return entry;
  }

  async removePlugin(spec) {
    const entry = this.store.pluginBySpec(spec);
    if (!entry) throw new Error("no such plugin");
    removePluginFiles(this.store, entry);
    this.store.removePlugin(spec);
    await this.host.stop();
    this.hostReady = false;
    await this.refreshProviders({ restartHost: true }).catch(() => {});
    return { ok: true };
  }

  async togglePlugin(spec, off) {
    const entry = this.store.pluginBySpec(spec);
    if (!entry) throw new Error("no such plugin");
    this.store.putPlugin({ ...entry, off: !!off });
    await this.refreshProviders({ restartHost: true });
    return { ok: true, off: !!off };
  }

  async setPluginOptions(spec, options) {
    const entry = this.store.pluginBySpec(spec);
    if (!entry) throw new Error("no such plugin");
    this.store.config.pluginOptions[spec] = options || {};
    this.store.putPlugin({ ...entry, options: options || undefined });
    // Plugin options reach a plugin's module while the host loads it, so a
    // restart is the reliable way to apply them here.
    await this.refreshProviders({ restartHost: true }).catch(() => {});
    return { ok: true };
  }

  async updatePlugin(spec) {
    const entry = this.store.pluginBySpec(spec);
    if (!entry) throw new Error("no such plugin");
    const info = await checkPluginUpdate(this.store, entry);
    if (!info) return { ok: true, updated: false };
    const next = await installPlugin(this.store, entry.spec, entry.options);
    await this.refreshProviders({ restartHost: true });
    return { ok: true, updated: true, version: next.version };
  }

  async searchPlugins(query) {
    const [npm, market] = await Promise.all([
      searchNpm(this.store, query || "opencode-plugin").catch(() => []),
      Promise.resolve(loadMarket(this.store)),
    ]);
    return { npm, market };
  }

  async pluginSignIn({ provider, method, key, inputs, account }) {
    const r = await this.host.apiKey({ provider, method, key, inputs, account, proxy: this.store.config.proxy });
    if (r?.ok) await this.catalog.pluginProviderList({ force: true });
    return r;
  }

  async pluginOAuthStart({ provider, method, inputs, account }) {
    const r = await this.host.authorize({ provider, method, inputs, account, proxy: this.store.config.proxy });
    return r;
  }

  async pluginOAuthCallback({ session, code }) {
    const r = await this.host.callback({ session, code });
    if (r?.ok) await this.catalog.pluginProviderList({ force: true });
    return r;
  }

  async pluginSignOut({ provider, account }) {
    await this.host.signOut({ provider, account });
    await this.catalog.pluginProviderList({ force: true });
    return { ok: true };
  }

  async pluginUsage({ provider, account }) {
    return await this.host.usage({ provider, account, proxy: this.store.config.proxy });
  }

  async pluginCheck({ provider, account }) {
    return await this.host.check({ provider, account, proxy: this.store.config.proxy });
  }
}
