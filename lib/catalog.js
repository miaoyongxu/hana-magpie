// The model catalog: built-in API-key providers plus provider plugins from
// the magpie host, flattened into the one list HanaAgent's model picker sees.
//
// Model ids crossing into HanaAgent are opaque (`hm_...`) so a provider/model
// pair with slashes, dots or spaces can never be misread by HanaAgent's
// `provider/model` syntax. The gateway decodes the same ids.

import fs from "node:fs";
import path from "node:path";
import { b64url, unb64url, num, safeId, randomId, isPlainObject } from "./util.js";
import { PRESETS, presetById, presetKind, hanaApiFor, apiForNpm, pluginPathForNpm } from "./presets.js";

export function encodeModelId(kind, provider, model) {
  return "hm_" + b64url(`${kind}\u0000${provider}\u0000${model}`);
}

export function decodeModelId(id) {
  const raw = String(id || "");
  if (raw.startsWith("hm_")) {
    try {
      const [kind, provider, model] = unb64url(raw.slice(3)).split("\u0000");
      if (kind && provider && model) return { kind, provider, model, groupId: kind === "group" ? provider : undefined };
    } catch {}
  }
  // magpie-style provider/model, for a client that speaks magpie directly.
  const slash = raw.indexOf("/");
  if (slash > 0) return { kind: "plugin", provider: raw.slice(0, slash), model: raw.slice(slash + 1) };
  return null;
}

export function groupIdOf(provider) {
  return provider || "group";
}

function builtinModelDescriptor(store, provider, model) {
  const p = presetById(provider.presetId) || {};
  const api = provider.api || p.api || "openai-completions";
  const name = typeof model === "string" ? model : model.name || model.id;
  const modelId = typeof model === "string" ? model : model.id;
  const context = typeof model === "object" ? num(model.context, num(model.contextWindow, 0)) : 0;
  const maxOutput = typeof model === "object" ? num(model.maxOutput, num(model.maxTokens, 0)) : 0;
  return {
    ref: `builtin:${provider.id}/${modelId}`,
    kind: "builtin",
    providerId: provider.id,
    providerName: provider.name,
    providerIcon: provider.icon || p.icon || "generic.svg",
    modelId,
    name,
    api,
    context,
    maxOutput,
    image: typeof model === "object" ? !!model.image : false,
    reasoning: typeof model === "object" ? !!model.reasoning : false,
    variants: typeof model === "object" ? model.variants || [] : [],
    cost: typeof model === "object" ? model.cost || null : null,
    free: false,
    key: encodeModelId("builtin", provider.id, modelId),
  };
}

function pluginModelDescriptor(provider, model) {
  const npm = model.npm || provider.npm || "@ai-sdk/openai-compatible";
  const api = apiForNpm(npm);
  return {
    ref: `plugin:${provider.id}/${model.id}`,
    kind: "plugin",
    providerId: provider.id,
    providerName: provider.name,
    providerIcon: provider.icon || `${provider.id}.svg`,
    modelId: model.id,
    name: model.name || model.id,
    api,
    npm,
    apiId: model.apiId || model.id,
    context: num(model.context, num(model.input, 0)),
    maxOutput: num(model.output, 0),
    image: !!model.image,
    reasoning: !!model.reasoning,
    variants: Array.isArray(model.variants) ? model.variants : [],
    cost: model.cost || null,
    free: !!model.free,
    rate: model.rate,
    key: encodeModelId("plugin", provider.id, model.id),
  };
}

export class Catalog {
  constructor(store, host, gateway) {
    this.store = store;
    this.host = host;
    this.gateway = gateway;
    this.pluginProviders = [];
    this.pluginFetchedAt = 0;
    this.pluginError = "";
    this.pluginLoading = null;
    this._builtinRefresh = new Map();
  }

  preset(id) { return presetById(id); }

  builtinProviders() {
    return this.store.providers();
  }

  async pluginProviderList({ force = false, timeoutMs = 25000 } = {}) {
    if (!force && this.pluginProviders.length && Date.now() - this.pluginFetchedAt < 15000) return this.pluginProviders;
    if (this.pluginLoading) return this.pluginLoading;
    const hasEnabled = this.store.plugins().some((p) => !p.off);
    if (!hasEnabled) {
      this.pluginProviders = [];
      this.pluginError = "";
      this.pluginFetchedAt = Date.now();
      return this.pluginProviders;
    }
    this.pluginLoading = (async () => {
      try {
        const list = await Promise.race([
          this.host.providers(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("provider list timed out; the plugin may be doing network work")), timeoutMs)),
        ]);
        this.pluginProviders = Array.isArray(list) ? list.filter((p) => p && p.id) : [];
        this.pluginError = "";
        this.pluginFetchedAt = Date.now();
        try {
          fs.writeFileSync(this.store.pluginProvidersPath, JSON.stringify({ at: Date.now(), providers: this.pluginProviders }, null, 2));
        } catch {}
      } catch (err) {
        this.pluginError = err?.message || String(err);
        this.store.log("warn", "provider plugin list failed", this.pluginError);
        // Keep the last good list rather than making every provider vanish
        // because one plugin was slow to answer.
        if (!this.pluginProviders.length) {
          try {
            const cached = JSON.parse(fs.readFileSync(this.store.pluginProvidersPath, "utf8"));
            if (Array.isArray(cached.providers)) this.pluginProviders = cached.providers;
          } catch {}
        }
      } finally {
        this.pluginLoading = null;
      }
      return this.pluginProviders;
    })();
    return this.pluginLoading;
  }

  pluginProvider(id) {
    return this.pluginProviders.find((p) => p.id === id) || null;
  }

  isRemoved(id, kind) {
    if (kind !== "plugin") return false;
    const value = this.store.config.removedProviders?.[id];
    return !!(value === true || (value && value.removed));
  }

  isOff(id, kind) {
    if (kind === "plugin") return !!this.store.config.pluginProvidersOff?.[id];
    return !!this.store.provider(id)?.off;
  }

  modelKey(kind, providerId, modelId) {
    return `${kind}:${providerId}/${modelId}`;
  }

  isModelOff(kind, providerId, model) {
    if (kind === "plugin") return !!this.store.config.hiddenModels?.[this.modelKey(kind, providerId, model?.id)];
    return !!model?.off;
  }

  orderOf(id) {
    const i = (this.store.config.providerOrder || []).indexOf(id);
    return i >= 0 ? i : 9999;
  }

  pluginHasOAuth(p) {
    return Array.isArray(p?.methods) && p.methods.some((m) => m && m.type === "oauth");
  }

  async allProviders() {
    const plugins = await this.pluginProviderList();
    const out = [];
    for (const p of this.builtinProviders()) {
      out.push({
        id: p.id,
        kind: "builtin",
        name: p.name,
        icon: p.icon || "generic.svg",
        api: p.api,
        baseUrl: p.baseUrl,
        presetId: p.presetId,
        presetKind: presetKind(p.presetId),
        category: presetKind(p.presetId) === "relay" ? "relay" : "vendor",
        keyless: !!p.keyless,
        off: !!p.off,
        accounts: (p.accounts || []).map((a) => ({
          id: a.id,
          name: a.name || a.id,
          keyMask: a.keyMask || "",
          hasKey: this.store.getBuiltinAuth(p.id, a.id)?.key !== undefined || !!p.keyless,
          disabled: !!a.disabled,
        })),
        models: (p.models || []).length,
        modelsOn: (p.models || []).filter((m) => !this.isModelOff("builtin", p.id, m)).length,
        source: "preset",
        connected: (p.accounts || []).some((a) => this.store.getBuiltinAuth(p.id, a.id) || p.keyless),
        ...(p.lastError ? { error: p.lastError } : {}),
      });
    }
    for (const p of plugins) {
      if (this.isRemoved(p.id, "plugin")) continue;
      const accounts = Array.isArray(p.accounts) ? p.accounts : [];
      out.push({
        id: p.id,
        kind: "plugin",
        spec: p.spec,
        name: p.name || p.id,
        icon: p.icon || "generic.svg",
        npm: p.npm,
        api: p.api,
        baseUrl: p.api,
        off: !!this.store.config.pluginProvidersOff?.[p.id],
        accounts: accounts.map((a) => ({ id: a.account || a.id, name: a.name || a.account || a.id, hasKey: true, disabled: !!a.disabled })),
        models: Array.isArray(p.models) ? p.models.length : 0,
        modelsOn: (p.models || []).filter((m) => !this.isModelOff("plugin", p.id, m)).length,
        category: this.pluginHasOAuth(p) ? "subscription" : "plugin",
        hasOAuth: this.pluginHasOAuth(p),
        connected: accounts.length > 0,
        methods: p.methods || [],
        usage: !!p.usage,
        maxConcurrency: p.maxConcurrency || 0,
        source: "plugin",
        error: p.listError || "",
      });
    }
    out.sort((a, b) => this.orderOf(a.id) - this.orderOf(b.id) || String(a.name).localeCompare(String(b.name)));
    return out.map((p, i) => ({ ...p, order: i }));
  }

  async providerDetail(providerId, kind) {
    if (kind === "plugin") {
      const p = this.pluginProvider(providerId);
      if (!p || this.isRemoved(providerId, "plugin")) return null;
      return {
        id: p.id,
        kind: "plugin",
        name: p.name || p.id,
        icon: p.icon || "generic.svg",
        spec: p.spec,
        npm: p.npm,
        api: p.api,
        baseUrl: p.api,
        off: this.isOff(p.id, "plugin"),
        category: this.pluginHasOAuth(p) ? "subscription" : "plugin",
        hasOAuth: this.pluginHasOAuth(p),
        methods: p.methods || [],
        accounts: (p.accounts || []).map((a) => ({
          id: a.account || a.id,
          name: a.name || a.account || a.id,
          hasKey: true,
          disabled: !!a.disabled,
          plan: a.plan || "",
        })),
        usage: !!p.usage,
        maxConcurrency: p.maxConcurrency || 0,
        models: (p.models || []).map((m) => ({
          id: m.id,
          name: m.name || m.id,
          api: m.apiId || m.id,
          npm: m.npm || p.npm,
          context: num(m.context, 0),
          maxOutput: num(m.output, 0),
          reasoning: !!m.reasoning,
          image: !!m.image,
          off: this.isModelOff("plugin", p.id, m),
        })),
      };
    }
    const p = this.store.provider(providerId);
    if (!p) return null;
    return {
      id: p.id,
      kind: "builtin",
      name: p.name,
      icon: p.icon || "generic.svg",
      presetId: p.presetId,
      presetKind: presetKind(p.presetId),
      category: presetKind(p.presetId) === "relay" ? "relay" : "vendor",
      api: p.api,
      baseUrl: p.baseUrl,
      off: !!p.off,
      headers: p.headers || {},
      accounts: (p.accounts || []).map((a) => {
        const auth = this.store.getBuiltinAuth(p.id, a.id);
        return {
          id: a.id,
          name: a.name || a.id,
          hasKey: !!auth?.key || !!p.keyless,
          keyMask: auth?.key ? "••••" + String(auth.key).slice(-4) : "",
          disabled: !!a.disabled,
          plan: a.plan || "",
        };
      }),
      models: (p.models || []).map((m) => {
        const obj = typeof m === "string" ? { id: m } : m;
        return {
          id: obj.id,
          name: obj.name || obj.id,
          api: obj.api || p.api,
          context: num(obj.context, 0),
          maxOutput: num(obj.maxOutput, 0),
          reasoning: !!obj.reasoning,
          image: !!obj.image,
          off: !!obj.off,
        };
      }),
    };
  }

  async setProviderOff(providerId, kind, off) {
    if (kind === "plugin") {
      this.store.config.pluginProvidersOff[providerId] = !!off;
    } else {
      const p = this.store.provider(providerId);
      if (!p) throw new Error("no such provider");
      this.store.putProvider({ ...p, off: !!off });
    }
    this.store.save();
  }

  async setModelOff(providerId, kind, modelId, off) {
    if (kind === "plugin") {
      this.store.config.hiddenModels[this.modelKey("plugin", providerId, modelId)] = !!off;
      this.store.save();
      return;
    }
    const p = this.store.provider(providerId);
    if (!p) throw new Error("no such provider");
    p.models = (p.models || []).map((m) => {
      const obj = typeof m === "string" ? { id: m } : { ...m };
      return obj.id === modelId ? { ...obj, off: !!off } : obj;
    });
    this.store.putProvider(p);
  }

  async setModelsOff(providerId, kind, states = []) {
    if (kind === "plugin") {
      for (const state of states) {
        if (!state?.id) continue;
        this.store.config.hiddenModels[this.modelKey("plugin", providerId, state.id)] = !!state.off;
      }
      this.store.save();
      return;
    }
    const p = this.store.provider(providerId);
    if (!p) throw new Error("no such provider");
    const map = new Map(states.map((s) => [s.id, !!s.off]));
    p.models = (p.models || []).map((m) => {
      const obj = typeof m === "string" ? { id: m } : { ...m };
      return map.has(obj.id) ? { ...obj, off: map.get(obj.id) } : obj;
    });
    this.store.putProvider(p);
  }

  async removeProvider(providerId, kind) {
    if (kind === "plugin") {
      this.store.config.removedProviders[providerId] = { removed: true, at: Date.now() };
      delete this.store.config.pluginProvidersOff[providerId];
      this.store.save();
      return true;
    }
    return this.store.removeProvider(providerId);
  }

  async restoreProvider(providerId, kind) {
    if (kind !== "plugin") return false;
    this.store.config.removedProviders[providerId] = { removed: false, at: Date.now() };
    this.store.save();
    return true;
  }

  removedPluginProviders() {
    return this.pluginProviders
      .filter((p) => this.isRemoved(p.id, "plugin"))
      .map((p) => ({ id: p.id, name: p.name || p.id, icon: p.icon || "generic.svg", spec: p.spec }));
  }

  async arrangeProvider(providerId, direction) {
    const ids = (await this.allProviders()).map((p) => p.id);
    const i = ids.indexOf(providerId);
    if (i < 0) throw new Error("no such provider");
    ids.splice(i, 1);
    if (direction === "top") ids.unshift(providerId);
    else if (direction === "bottom") ids.push(providerId);
    else if (direction === "up") ids.splice(Math.max(0, i - 1), 0, providerId);
    else ids.splice(Math.min(ids.length, i + 1), 0, providerId);
    this.store.config.providerOrder = ids;
    this.store.save();
    return ids;
  }

  async modelsForProvider(providerId, kind) {
    if (this.isOff(providerId, kind)) return [];
    if (kind === "plugin") {
      const p = this.pluginProvider(providerId);
      if (!p) return [];
      return (p.models || []).map((m) => pluginModelDescriptor(p, m)).filter((m) => !this.isModelOff("plugin", providerId, { id: m.modelId }));
    }
    const p = this.store.provider(providerId);
    if (!p) return [];
    return (p.models || []).map((m) => builtinModelDescriptor(this.store, p, m)).filter((m) => !this.isModelOff("builtin", providerId, { id: m.modelId, off: m.off }));
  }

  async allModels() {
    const plugins = await this.pluginProviderList();
    const out = [];
    for (const p of this.builtinProviders()) {
      if (p.off) continue;
      for (const m of p.models || []) {
        if (this.isModelOff("builtin", p.id, m)) continue;
        out.push(builtinModelDescriptor(this.store, p, m));
      }
    }
    for (const p of plugins) {
      if (this.isRemoved(p.id, "plugin") || this.isOff(p.id, "plugin")) continue;
      for (const m of p.models || []) {
        if (this.isModelOff("plugin", p.id, m)) continue;
        out.push(pluginModelDescriptor(p, m));
      }
    }
    return out;
  }

  groupDescriptor(group) {
    const members = group.models || [];
    const all = this._lastModels || [];
    const found = members.map((ref) => all.find((m) => m.ref === ref || m.key === ref)).filter(Boolean);
    const first = found[0] || null;
    return {
      ref: `group:${group.id}`,
      kind: "group",
      providerId: `group:${group.id}`,
      providerName: group.name || group.id,
      providerIcon: "routing.svg",
      groupId: group.id,
      modelId: group.id,
      name: group.name || group.id,
      api: "openai-completions",
      context: Math.max(0, ...found.map((m) => m.context || 0)),
      maxOutput: Math.max(0, ...found.map((m) => m.maxOutput || 0)),
      image: found.length > 0 && found.every((m) => m.image),
      reasoning: found.some((m) => m.reasoning),
      variants: first?.variants || [],
      members: found.map((m) => ({ ref: m.ref, name: m.name, providerName: m.providerName, api: m.api })),
      routing: group.routing || "smart",
      key: encodeModelId("group", group.id, "group"),
    };
  }

  async allModelsWithGroups() {
    const models = await this.allModels();
    this._lastModels = models;
    const groups = (this.store.groups() || []).filter((g) => (g.models || []).length).map((g) => this.groupDescriptor(g));
    return [...models, ...groups];
  }

  async findModel(keyOrRef) {
    const models = await this.allModelsWithGroups();
    const exact = models.find((m) => m.key === keyOrRef || m.ref === keyOrRef);
    if (exact) return exact;
    const decoded = decodeModelId(keyOrRef);
    if (!decoded) return null;
    if (decoded.kind === "group") {
      const group = this.store.groups().find((g) => g.id === decoded.provider);
      return group ? this.groupDescriptor(group) : null;
    }
    return models.find((m) => m.kind === decoded.kind && m.providerId === decoded.provider && m.modelId === decoded.model) || null;
  }

  // ---- built-in model discovery -------------------------------------------

  async refreshBuiltinModels(providerId) {
    const p = this.store.provider(providerId);
    if (!p) throw new Error("no such provider");
    const key = p.accounts?.find((a) => !a.disabled && this.store.getBuiltinAuth(p.id, a.id))?.id
      || p.accounts?.[0]?.id;
    const auth = key ? this.store.getBuiltinAuth(p.id, key) : null;
    const apiKey = auth?.key || "";
    const base = (auth?.baseUrl || p.baseUrl || "").replace(/\/+$/, "");
    if (!base) throw new Error("provider has no base URL");
    let url;
    const headers = { accept: "application/json", "user-agent": "hana-magpie/1.0" };
    if (p.api === "anthropic-messages") {
      url = base.endsWith("/v1") ? `${base}/models?limit=1000` : `${base}/v1/models?limit=1000`;
      if (apiKey) headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      url = `${base}/models`;
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    let data;
    try {
      const res = await fetch(url, { headers, signal: ctl.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
    if (!rows.length) throw new Error("the provider listed no models");
    const existing = new Map((p.models || []).map((m) => [typeof m === "string" ? m : m.id, m]));
    const models = rows.map((row) => {
      const id = row.id || row.name;
      const old = existing.get(id);
      const meta = isPlainObject(old) ? old : {};
      return {
        ...meta,
        id,
        name: row.display_name || row.name || meta.name || id,
        context: num(row.context_length, num(row.context_window, num(meta.context, 0))),
        maxOutput: num(row.max_output_tokens, num(meta.maxOutput, 0)),
        image: row.supports_vision ?? meta.image ?? false,
        reasoning: row.supports_reasoning ?? meta.reasoning ?? false,
      };
    }).filter((m) => m.id);
    this.store.putProvider({ ...p, models, lastRefreshAt: Date.now(), lastError: "" });
    return models;
  }

  async ensureBuiltinModels(providerId) {
    const p = this.store.provider(providerId);
    if (!p) return [];
    if ((p.models || []).length) return p.models;
    try {
      return await this.refreshBuiltinModels(providerId);
    } catch (err) {
      this.store.putProvider({ ...p, lastError: err.message });
      return p.models || [];
    }
  }

  // ---- creation ------------------------------------------------------------

  createBuiltinFromPreset(presetId, { id, name, baseUrl, api, apiKey, models } = {}) {
    const preset = presetById(presetId) || presetById("custom");
    const providerId = safeId(id || (presetId === "custom" ? `custom-${randomId(3)}` : presetId));
    if (this.store.provider(providerId)) throw new Error(`provider "${providerId}" already exists`);
    const chosenApi = api || preset.api;
    const chosenBase = (baseUrl || preset.baseUrl || "").replace(/\/+$/, "");
    const accountId = "default";
    const seedModels = Array.isArray(models) && models.length
      ? models.map((m) => (typeof m === "string" ? { id: m } : m))
      : (preset.models || []).map((id) => ({ id }));
    const provider = this.store.putProvider({
      id: providerId,
      name: name || preset.name,
      icon: preset.icon,
      api: chosenApi,
      baseUrl: chosenBase,
      presetId: preset.id,
      keyless: !!preset.keyless,
      off: false,
      headers: preset.headers || {},
      accounts: [{ id: accountId, name: preset.keyless ? "Local" : "Default" }],
      models: seedModels,
      source: "preset",
    });
    if (apiKey || preset.keyless) {
      this.store.setBuiltinAuth(providerId, accountId, {
        type: "api",
        key: apiKey || "local",
        baseUrl: chosenBase,
        api: chosenApi,
      });
    }
    return provider;
  }

  // ---- groups --------------------------------------------------------------

  validateGroup(input) {
    const name = String(input.name || "").trim();
    if (!name) throw new Error("group name is required");
    const models = Array.isArray(input.models) ? [...new Set(input.models.filter(Boolean))] : [];
    if (!models.length) throw new Error("a routing group needs at least one model");
    const routing = ["smart", "round-robin", "ordered"].includes(input.routing) ? input.routing : "smart";
    return {
      id: input.id || `group-${safeId(name)}-${randomId(3)}`,
      name,
      models,
      routing,
      enabled: input.enabled !== false,
      createdAt: input.createdAt || Date.now(),
    };
  }
}
