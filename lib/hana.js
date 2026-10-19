// The only bridge into HanaAgent: its own local HTTP API.
//
// magpie edits OpenHanako's provider catalog and agent config through the
// same endpoints. Hana Magpie runs inside HanaAgent, so it does the same
// thing from the inside: one provider named "hana-magpie" points at the
// loopback gateway, and each agent's chat model is a model of that provider.

import fs from "node:fs";
import path from "node:path";
import { homeDir, sleep } from "./util.js";

const PROVIDER_ID = "hana-magpie";
const PROVIDER_NAME = "Magpie";

export class HanaClient {
  constructor(store, gateway) {
    this.store = store;
    this.gateway = gateway;
    this._info = null;
    this._infoAt = 0;
    this._checkedBase = "";
  }

  info() {
    const now = Date.now();
    if (this._info && now - this._infoAt < 2000) return this._info;
    const file = path.join(homeDir(), "server-info.json");
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data?.port) {
        this._info = {
          port: Number(data.port),
          token: String(data.token || ""),
          pid: data.pid,
          version: data.version,
          baseUrl: `http://127.0.0.1:${Number(data.port)}`,
        };
        this._infoAt = now;
        return this._info;
      }
    } catch {}
    this._info = null;
    return null;
  }

  available() {
    return !!this.info();
  }

  async request(apiPath, { method = "GET", body, timeout = 15000 } = {}) {
    const info = this.info();
    if (!info) throw Object.assign(new Error("HanaAgent server is not reachable (server-info.json)"), { code: "HANA_OFFLINE" });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(info.baseUrl + apiPath, {
        method,
        headers: {
          authorization: `Bearer ${info.token}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
      if (!res.ok) {
        const msg = data?.error || `${res.status} ${res.statusText}`;
        throw Object.assign(new Error(`HanaAgent: ${msg}`), { status: res.status, code: data?.code, data });
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async cardFaces() {
    return await this.request("/api/chalkboard/card-faces", { timeout: 10000 });
  }

  async setCardFaceImage(cardEntityId, filename, contentBase64) {
    return await this.request(`/api/chalkboard/card-faces/${encodeURIComponent(cardEntityId)}/image`, {
      method: "PUT",
      body: { filename, contentBase64 },
      timeout: 30000,
    });
  }

  async listAgents() {
    const data = await this.request("/api/agents");
    const agents = Array.isArray(data?.agents) ? data.agents : Array.isArray(data) ? data : [];
    return agents.map((a) => ({
      id: a.id,
      name: a.name || a.agentName || a.id,
      avatar: a.avatar || a.icon || null,
      emoji: a.emoji || null,
      description: a.description || "",
      current: a.model || a.chatModel || null,
      raw: a,
    }));
  }

  async agentConfig(id) {
    return await this.request(`/api/agents/${encodeURIComponent(id)}/config`);
  }

  chatOfConfig(config) {
    const chat = config?.models?.chat ?? config?.model ?? null;
    if (!chat) return null;
    if (typeof chat === "string") {
      const [provider, id] = chat.split("/");
      return { provider: provider || "", id: id || chat };
    }
    return { provider: chat.provider || "", id: chat.id || "" };
  }

  async models() {
    const data = await this.request("/api/models", { timeout: 20000 });
    return Array.isArray(data?.models) ? data.models : [];
  }

  async fullConfig() {
    return await this.request("/api/config", { timeout: 20000 });
  }

  providerEntry(modelEntries) {
    return {
      display_name: PROVIDER_NAME,
      base_url: this.gateway.baseUrl,
      api: "openai-completions",
      api_key: this.store.config.gatewayKey,
      models: modelEntries,
    };
  }

  async putProvider(modelEntries) {
    const entry = this.providerEntry(modelEntries);
    await this.request("/api/config", {
      method: "PUT",
      body: { providers: { [PROVIDER_ID]: entry } },
      timeout: 60000,
    });
    return entry;
  }

  async removeProvider() {
    await this.request("/api/config", {
      method: "PUT",
      body: { providers: { [PROVIDER_ID]: null } },
      timeout: 30000,
    });
  }

  async syncProvider(modelEntries) {
    try {
      // HanaAgent 1.x keeps a local provider's definition in
      // provider-plugins/… and only credentials in the catalog. An older
      // catalog entry can keep a stale base_url that wins over the plugin
      // file when the gateway moves to another port, so remove it first in
      // that case and let the next PUT recreate it cleanly.
      try {
        if (this._checkedBase !== this.gateway.baseUrl) {
          const cfg = await this.fullConfig();
          const cur = cfg?.providers?.[PROVIDER_ID];
          if (cur?.base_url && cur.base_url !== this.gateway.baseUrl) {
            this.store.log("info", `provider base_url moved ${cur.base_url} -> ${this.gateway.baseUrl}; recreating entry`);
            await this.removeProvider();
          }
          this._checkedBase = this.gateway.baseUrl;
        }
      } catch {}
      await this.putProvider(modelEntries);
      this.store.log("info", `HanaAgent provider ${PROVIDER_ID} synced (${modelEntries.length} models)`);
      return { ok: true, count: modelEntries.length };
    } catch (err) {
      this.store.log("warn", `HanaAgent provider sync failed: ${err.message}`);
      return { ok: false, error: err.message, code: err.code };
    }
  }

  async waitForModel(modelId, timeout = 8000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      try {
        const models = await this.models();
        if (models.some((m) => m.id === modelId && (m.provider === PROVIDER_ID || m.provider === undefined))) return true;
      } catch {}
      await sleep(400);
    }
    return false;
  }

  async setAgentChat(agentId, modelId, { previous = null } = {}) {
    await this.waitForModel(modelId, 8000);
    const body = { models: { chat: { id: modelId, provider: PROVIDER_ID } } };
    await this.request(`/api/agents/${encodeURIComponent(agentId)}/config`, {
      method: "PUT",
      body,
      timeout: 30000,
    });
    this.store.config.agents[agentId] = {
      ...(this.store.config.agents[agentId] || {}),
      ref: modelId,
      previous: previous ?? this.store.config.agents[agentId]?.previous ?? null,
      at: Date.now(),
    };
    this.store.save();
    return { ok: true };
  }

  async restoreAgentChat(agentId) {
    const saved = this.store.config.agents[agentId];
    let previous = saved?.previous;
    if (!previous?.id) {
      // Nothing was stashed: go back to the first model HanaAgent itself can
      // still chat with, as magpie does when its own provider leaves.
      try {
        const models = await this.models();
        const own = models.find((m) => m.provider && m.provider !== PROVIDER_ID && m.id);
        if (own) previous = { id: own.id, provider: own.provider };
      } catch {}
    }
    if (!previous?.id) {
      throw Object.assign(new Error("No model was saved before Magpie took over this agent. Pick a model in HanaAgent's own settings first."), { code: "NO_PREVIOUS" });
    }
    await this.request(`/api/agents/${encodeURIComponent(agentId)}/config`, {
      method: "PUT",
      body: { models: { chat: { id: previous.id, provider: previous.provider } } },
      timeout: 30000,
    });
    delete this.store.config.agents[agentId];
    this.store.save();
    return { ok: true };
  }

  async status() {
    const info = this.info();
    if (!info) return { online: false, providerId: PROVIDER_ID, error: "server-info.json not found" };
    try {
      const models = await this.models();
      const mine = models.filter((m) => m.provider === PROVIDER_ID);
      return {
        online: true,
        version: info.version,
        port: info.port,
        providerId: PROVIDER_ID,
        providerModels: mine.length,
      };
    } catch (err) {
      return { online: false, error: err.message };
    }
  }
}

export { PROVIDER_ID, PROVIDER_NAME };
