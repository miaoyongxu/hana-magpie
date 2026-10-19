// Parent side of the provider-plugin host.
//
// The child is magpie's own host.js (vendored as host.vendor.mjs and patched
// for Node); it speaks the same newline-delimited JSON protocol magpie's Go
// side uses. This file implements the subset Hana Magpie needs: init,
// providers, sign-in, load, fetch (streaming), usage, reload and sign-out.

import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { ensureDir, sleep } from "./util.js";
import { pluginHostList } from "./installer.js";

const HOST_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "host.vendor.mjs");
const FETCH_WINDOW = 8 << 20;

export class PluginHost {
  constructor(store) {
    this.store = store;
    this.child = null;
    this.pending = new Map();
    this.seq = 1;
    this.starting = null;
    this.ready = false;
    this.lastError = "";
    this.stderrTail = "";
    this.events = new Set();
    this.startedAt = 0;
  }

  onEvent(fn) {
    this.events.add(fn);
    return () => this.events.delete(fn);
  }

  emit(event) {
    for (const fn of this.events) {
      try { fn(event); } catch {}
    }
  }

  status() {
    return {
      running: !!this.child && !this.child.killed && this.ready,
      pid: this.child?.pid || null,
      startedAt: this.startedAt,
      error: this.lastError,
      stderr: this.stderrTail.slice(-2000),
      plugins: this.store.plugins().length,
    };
  }

  async ensure() {
    if (this.child && this.ready) return;
    if (this.starting) return this.starting;
    this.starting = this._start().finally(() => { this.starting = null; });
    return this.starting;
  }

  async _start() {
    if (this.child) await this.stop();
    ensureDir(this.store.dataDir);
    ensureDir(this.store.pluginsDir);
    const list = pluginHostList(this.store);
    this.lastError = "";
    this.ready = false;
    this.stderrTail = "";
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      // The host reads these for its proxy defaults, as magpie's host does.
      MAGPIE_HTTPS_PROXY: this.store.config.proxy || process.env.HTTPS_PROXY || "",
      MAGPIE_HTTP_PROXY: this.store.config.proxy || process.env.HTTP_PROXY || "",
    };
    const child = spawn(process.execPath, [HOST_FILE], {
      cwd: this.store.pluginsDir,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.startedAt = Date.now();
    child.stdout.setEncoding("utf8");
    const rl = readline.createInterface({ input: child.stdout });
    rl.on("line", (line) => this._onLine(line));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d) => {
      this.stderrTail += d;
      if (this.stderrTail.length > 20000) this.stderrTail = this.stderrTail.slice(-12000);
      for (const line of String(d).split(/\r?\n/)) {
        if (line.trim()) this.store.log("plugin-host", line.slice(0, 2000));
      }
    });
    child.on("exit", (code, signal) => {
      const wasReady = this.ready;
      this.ready = false;
      const err = new Error(`provider plugin host exited (${code ?? signal ?? "unknown"})`);
      for (const [id, p] of this.pending) {
        this.pending.delete(id);
        try { p.reject(err); } catch {}
      }
      if (wasReady) this.store.log("warn", err.message);
      this.lastError = err.message;
      this.child = null;
      this.emit({ type: "exit", code, signal });
    });
    child.on("error", (err) => {
      this.lastError = err.message;
      this.store.log("error", "plugin host spawn failed", err.message);
    });

    try {
      const result = await this.call("init", {
        directory: this.store.dataDir,
        authPath: this.store.authPath,
        modelsDevPath: "",
        piPath: "",
        plugins: list.map((p) => ({ spec: p.spec, target: p.target, options: p.options })),
        config: {},
      }, 180000);
      this.ready = true;
      for (const p of result?.plugins || []) {
        if (p?.error) this.store.log("warn", `plugin failed to load: ${p.spec}: ${p.error}`);
      }
      this.store.log("info", `plugin host ready (${list.length} plugin(s))`);
      return result;
    } catch (err) {
      this.lastError = err?.message || String(err);
      this.store.log("error", "plugin host init failed", this.lastError);
      try { child.kill(); } catch {}
      this.child = null;
      throw err;
    }
  }

  async stop() {
    const child = this.child;
    this.child = null;
    this.ready = false;
    if (!child) return;
    try { child.stdin.end(); } catch {}
    try { child.kill(); } catch {}
    await sleep(30);
  }

  _onLine(line) {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.id === undefined || msg.id === null) {
      if (msg.event) this._onEvent(msg);
      return;
    }
    const p = this.pending.get(msg.id);
    if (msg.event === "head" && p) {
      p.head = msg;
      p.onHead?.(msg);
      return;
    }
    if (msg.event === "chunk" && p) {
      const buf = Buffer.from(msg.data || "", "base64");
      p.bytes += buf.length;
      p.onChunk?.(buf);
      // Return the window the reader consumed, so a long reply never
      // deadlocks on the host's flow-control gate.
      this._send({ method: "credit", params: { id: msg.id, n: buf.length + 64 } });
      return;
    }
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message || "plugin host error"));
    else p.resolve(msg.result ?? null);
  }

  _onEvent(msg) {
    if (msg.event === "log") {
      this.store.log(msg.level || "info", `plugin: ${msg.message}`);
    } else if (msg.event === "toast") {
      this.store.log("info", `plugin toast: ${msg.message}`);
    } else if (msg.event === "auth") {
      this.emit({ type: "auth", provider: msg.provider, account: msg.account });
    } else if (msg.event === "signIn") {
      this.emit({ type: "signIn", provider: msg.provider, account: msg.account, said: msg.said });
    }
    this.emit({ type: "event", event: msg });
  }

  _send(msg) {
    const child = this.child;
    if (!child || !child.stdin || child.stdin.destroyed) return false;
    try {
      child.stdin.write(JSON.stringify(msg) + "\n");
      return true;
    } catch {
      return false;
    }
  }

  call(method, params = {}, timeout = 60000) {
    if (!this.child) return Promise.reject(new Error("provider plugin host is not running"));
    const id = this.seq++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`provider plugin host: ${method} timed out after ${Math.round(timeout / 1000)}s`));
      }, timeout);
      timer.unref?.();
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      if (!this._send({ id, method, params })) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new Error("provider plugin host is not accepting requests"));
      }
    });
  }

  async providers() {
    await this.ensure();
    return await this.call("providers", {}, 120000);
  }

  async apiKey({ provider, method, key, inputs, account, proxy }) {
    await this.ensure();
    return await this.call("apiKey", { provider, method, key, inputs: inputs || {}, account, proxy: proxy || "" }, 120000);
  }

  async authorize({ provider, method, inputs, account, proxy }) {
    await this.ensure();
    return await this.call("authorize", { provider, method, inputs: inputs || {}, account, proxy: proxy || "" }, 120000);
  }

  async callback({ session, code }) {
    await this.ensure();
    return await this.call("callback", { session, code }, 120000);
  }

  async prompt({ provider, method, inputs }) {
    await this.ensure();
    return await this.call("prompt", { provider, method, inputs: inputs || {} }, 30000);
  }

  async validate({ provider, method, key, value }) {
    await this.ensure();
    return await this.call("validate", { provider, method, key, value }, 30000);
  }

  async load({ provider, account, proxy }) {
    await this.ensure();
    return await this.call("load", { provider, account, proxy: proxy || "" }, 120000);
  }

  async usage({ provider, account, proxy }) {
    await this.ensure();
    return await this.call("usage", { provider, account, proxy: proxy || "" }, 120000);
  }

  async check({ provider, account, proxy }) {
    await this.ensure();
    return await this.call("check", { provider, account, proxy: proxy || "" }, 180000);
  }

  async signOut({ provider, account }) {
    await this.ensure();
    return await this.call("signOut", { provider, account }, 30000);
  }

  async reload({ provider, account }) {
    await this.ensure();
    return await this.call("reload", { provider, account }, 30000);
  }

  async setProviderOptions(options) {
    await this.ensure();
    return await this.call("setProviderOptions", { options: options || {} }, 30000);
  }

  // fetchStream resolves once the upstream's head arrives, with a Web
  // ReadableStream for its body. Throwing before the head means no bytes were
  // committed, so the gateway may try another account or model.
  async fetchStream({ provider, account, model, npm, url, method = "POST", headers, body, session }) {
    await this.ensure();
    const id = this.seq++;
    const controller = new AbortController();
    let streamController = null;
    const bodyStream = new ReadableStream({
      start(c) { streamController = c; },
      cancel: () => {
        controller.abort();
        this._send({ method: "abort", params: { id } });
      },
    });

    return await new Promise((resolve, reject) => {
      let settled = false;
      let head = null;
      const timer = setTimeout(() => {
        if (settled && head) return;
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        this._send({ method: "abort", params: { id } });
        reject(new Error(`provider fetch timed out after 180s`));
      }, 180000);
      timer.unref?.();
      const finishOk = () => {
        clearTimeout(timer);
        try { streamController?.close(); } catch {}
      };
      const fail = (err) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          this.pending.delete(id);
          reject(err);
        } else {
          try { streamController?.error(err); } catch {}
        }
      };
      this.pending.set(id, {
        bytes: 0,
        onHead: (msg) => {
          head = msg;
          if (settled) return;
          settled = true;
          resolve({
            status: msg.status || 200,
            headers: msg.headers || {},
            body: bodyStream,
            abort: () => {
              controller.abort();
              this._send({ method: "abort", params: { id } });
            },
          });
        },
        onChunk: (buf) => {
          try { streamController?.enqueue(new Uint8Array(buf)); } catch {}
        },
        resolve: () => finishOk(),
        reject: (err) => fail(err),
      });
      if (!this._send({
        id,
        method: "fetch",
        params: {
          provider, account, model, npm, url, method,
          headers: headers || {},
          body: body == null ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body)).toString("base64"),
          window: FETCH_WINDOW,
          session: session || "",
        },
      })) {
        fail(new Error("provider plugin host is not accepting requests"));
      }
    });
  }
}

export function createPluginHost(store) {
  return new PluginHost(store);
}
