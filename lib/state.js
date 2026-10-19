// Hana Magpie — persistence for providers, groups, settings, auth and the
// plugin registry. The on-disk shapes deliberately stay close to magpie's
// own files (plugins.json / plugin-auth.json / plugin-providers.json) so a
// Magpie provider plugin sees the same inputs here as it does there.

import fs from "node:fs";
import path from "node:path";
import { ensureDir, readJson, writeJson, randomToken, nowMs, isPlainObject } from "./util.js";

export const VERSION = 1;
export const PLUGIN_ID = "hana-magpie";
export const DEFAULT_PORT = 3525; // magpie's gateway is 3425/3426; ours is deliberately elsewhere

export function defaultConfig() {
  return {
    version: VERSION,
    port: DEFAULT_PORT,
    gatewayKey: randomToken("hm"),
    language: "zh",
    theme: "auto",
    proxy: "",
    registry: "",
    autoSync: true,
    setupDone: false,
    providers: {},
    groups: [],
    agents: {},
    pluginOptions: {},
    pluginProvidersOff: {},
    removedProviders: {},
    providerOrder: [],
    hiddenModels: {},
    createdAt: nowMs(),
    updatedAt: nowMs(),
  };
}

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.pluginsDir = path.join(dataDir, "plugins");
    this.logsDir = path.join(dataDir, "logs");
    this.statePath = path.join(dataDir, "state.json");
    this.authPath = path.join(dataDir, "plugin-auth.json");
    this.builtinAuthPath = path.join(dataDir, "builtin-auth.json");
    this.pluginRegistryPath = path.join(dataDir, "plugins.json");
    this.pluginProvidersPath = path.join(dataDir, "plugin-providers.json");
    this.modelsCachePath = path.join(dataDir, "models-cache.json");
    this.usagePath = path.join(dataDir, "usage.jsonl");
    this.logPath = path.join(this.logsDir, "hana-magpie.log");
    this.config = defaultConfig();
    this.builtinAuth = {};
    this.registry = { plugins: [] };
    this.modelsCache = {};
    this.ready = false;
  }

  ensure() {
    if (this.ready) return;
    ensureDir(this.dataDir);
    ensureDir(this.pluginsDir);
    ensureDir(this.logsDir);
    this.config = { ...defaultConfig(), ...(readJson(this.statePath, {}) || {}) };
    this.config.providers = isPlainObject(this.config.providers) ? this.config.providers : {};
    this.config.groups = Array.isArray(this.config.groups) ? this.config.groups : [];
    this.config.agents = isPlainObject(this.config.agents) ? this.config.agents : {};
    this.config.pluginOptions = isPlainObject(this.config.pluginOptions) ? this.config.pluginOptions : {};
    this.config.pluginProvidersOff = isPlainObject(this.config.pluginProvidersOff) ? this.config.pluginProvidersOff : {};
    this.config.removedProviders = isPlainObject(this.config.removedProviders) ? this.config.removedProviders : {};
    this.config.providerOrder = Array.isArray(this.config.providerOrder) ? this.config.providerOrder : [];
    this.config.hiddenModels = isPlainObject(this.config.hiddenModels) ? this.config.hiddenModels : {};
    if (!this.config.gatewayKey) this.config.gatewayKey = randomToken("hm");
    if (!Number.isInteger(this.config.port) || this.config.port < 1024 || this.config.port > 65535) {
      this.config.port = DEFAULT_PORT;
    }
    this.builtinAuth = readJson(this.builtinAuthPath, {}) || {};
    this.registry = readJson(this.pluginRegistryPath, { plugins: [] }) || { plugins: [] };
    if (!Array.isArray(this.registry.plugins)) this.registry.plugins = [];
    this.modelsCache = readJson(this.modelsCachePath, {}) || {};
    if (!fs.existsSync(this.authPath)) writeJson(this.authPath, {}, 0o600);
    this.save();
    this.ready = true;
  }

  save() {
    // Plugin reloads can briefly leave an older Server instance alive. Merge
    // provider tombstones from disk instead of overwriting a newer delete or
    // restore with this instance's stale snapshot.
    try {
      const disk = readJson(this.statePath, {}) || {};
      const diskRemoved = isPlainObject(disk.removedProviders) ? disk.removedProviders : {};
      const stamp = (v) => (v && typeof v === "object" ? Number(v.at) || 0 : 0);
      for (const [id, value] of Object.entries(diskRemoved)) {
        const local = this.config.removedProviders[id];
        if (local === undefined || stamp(value) > stamp(local)) this.config.removedProviders[id] = value;
      }
    } catch {}
    this.config.updatedAt = nowMs();
    writeJson(this.statePath, this.config, 0o600);
  }

  saveRegistry() {
    writeJson(this.pluginRegistryPath, this.registry, 0o600);
  }

  saveModelsCache() {
    writeJson(this.modelsCachePath, this.modelsCache, 0o600);
  }

  saveBuiltinAuth() {
    writeJson(this.builtinAuthPath, this.builtinAuth, 0o600);
  }

  log(level, ...args) {
    const line = `[${new Date().toISOString()}] ${level} ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}\n`;
    try {
      ensureDir(this.logsDir);
      fs.appendFileSync(this.logPath, line);
    } catch {}
    if (level === "error") console.error("[hana-magpie]", ...args);
  }

  // ---- providers -----------------------------------------------------------

  providers() {
    return Object.values(this.config.providers).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name)));
  }

  provider(id) {
    return this.config.providers[id] || null;
  }

  putProvider(provider) {
    const id = provider.id;
    if (!id) throw new Error("provider id required");
    const existing = this.config.providers[id];
    const order = existing?.order ?? Object.keys(this.config.providers).length;
    this.config.providers[id] = {
      ...existing,
      ...provider,
      id,
      order,
      updatedAt: nowMs(),
      createdAt: existing?.createdAt || nowMs(),
    };
    this.save();
    return this.config.providers[id];
  }

  removeProvider(id) {
    if (!this.config.providers[id]) return false;
    delete this.config.providers[id];
    for (const key of Object.keys(this.builtinAuth)) {
      if (key.startsWith(id + "#")) delete this.builtinAuth[key];
    }
    for (const agent of Object.values(this.config.agents)) {
      if (agent?.ref?.startsWith(`builtin:${id}/`)) agent.missing = true;
    }
    this.saveBuiltinAuth();
    this.save();
    return true;
  }

  // ---- built-in provider credentials --------------------------------------

  builtinAccountKey(providerId, accountId) {
    return `${providerId}#${accountId}`;
  }

  getBuiltinAuth(providerId, accountId) {
    return this.builtinAuth[this.builtinAccountKey(providerId, accountId)] || null;
  }

  setBuiltinAuth(providerId, accountId, value) {
    this.builtinAuth[this.builtinAccountKey(providerId, accountId)] = value;
    this.saveBuiltinAuth();
  }

  removeBuiltinAuth(providerId, accountId) {
    delete this.builtinAuth[this.builtinAccountKey(providerId, accountId)];
    this.saveBuiltinAuth();
  }

  // ---- groups --------------------------------------------------------------

  groups() {
    return this.config.groups;
  }

  putGroup(group) {
    const i = this.config.groups.findIndex((g) => g.id === group.id);
    if (i >= 0) this.config.groups[i] = { ...this.config.groups[i], ...group };
    else this.config.groups.push({ ...group, createdAt: nowMs() });
    this.save();
    return group;
  }

  removeGroup(id) {
    const before = this.config.groups.length;
    this.config.groups = this.config.groups.filter((g) => g.id !== id);
    this.save();
    return this.config.groups.length !== before;
  }

  // ---- plugin registry -----------------------------------------------------

  plugins() {
    return this.registry.plugins;
  }

  putPlugin(entry) {
    const i = this.registry.plugins.findIndex((p) => p.spec === entry.spec);
    if (i >= 0) this.registry.plugins[i] = { ...this.registry.plugins[i], ...entry };
    else this.registry.plugins.push(entry);
    this.saveRegistry();
    return entry;
  }

  removePlugin(spec) {
    const before = this.registry.plugins.length;
    this.registry.plugins = this.registry.plugins.filter((p) => p.spec !== spec);
    this.saveRegistry();
    return this.registry.plugins.length !== before;
  }

  pluginBySpec(spec) {
    return this.registry.plugins.find((p) => p.spec === spec) || null;
  }

  // ---- usage ---------------------------------------------------------------

  recordUsage(row) {
    try {
      const line = JSON.stringify(row) + "\n";
      try {
        const st = fs.statSync(this.usagePath);
        if (st.size > 20 * 1024 * 1024) fs.renameSync(this.usagePath, `${this.usagePath}.1`);
      } catch {}
      fs.appendFileSync(this.usagePath, line, { mode: 0o600 });
    } catch (err) {
      this.log("warn", "usage write failed", err?.message || err);
    }
  }

  readUsage(sinceMs = 0, limit = 100000) {
    let text = "";
    try { text = fs.readFileSync(this.usagePath, "utf8"); } catch { return []; }
    const lines = text.split("\n");
    const out = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      if ((row.at || 0) < sinceMs) break;
      out.push(row);
      if (out.length >= limit) break;
    }
    return out.reverse();
  }

  authSummary() {
    return {
      builtinAccounts: Object.keys(this.builtinAuth).length,
      pluginAccounts: Object.keys(readJson(this.authPath, {}) || {}).length,
    };
  }
}
