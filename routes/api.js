// JSON API for the Magpie page. Mounted at
// /api/plugins/hana-magpie/api by HanaAgent.

import { getServer } from "../lib/server.js";
import { loadMarket, searchNpm } from "../lib/installer.js";
import { presetById, PRESETS } from "../lib/presets.js";

function jsonError(c, err) {
  const status = err?.status || err?.statusCode || (err?.code === "HANA_OFFLINE" ? 503 : 500);
  return c.json({ error: err?.message || String(err), code: err?.code || undefined }, status);
}

async function body(c) {
  try { return await c.req.json(); } catch { return {}; }
}

export default function (app, ctx) {
  // 1.1.x route factories receive the plugin's root Hono app (not a
  // filename-prefixed sub-app), so give every handler its public prefix.
  const api = {
    get: (p, h) => app.get("/api" + p, h),
    post: (p, h) => app.post("/api" + p, h),
  };
  const serverPromise = getServer(ctx);

  api.get("/state", async (c) => {
    try {
      const s = await serverPromise;
      await s.start();
      return c.json(await s.state());
    } catch (err) { return jsonError(c, err); }
  });

  api.get("/about", async (c) => {
    const s = await serverPromise;
    return c.json({
      name: "Hana Magpie",
      version: "1.0.0",
      pluginId: "hana-magpie",
      port: s.store.config.port,
      attribution: [
        { name: "magpie", url: "https://github.com/yetone/magpie", license: "MIT", note: "Provider plugin protocol and host, gateway semantics, presets, market and the visual language this page follows." },
        { name: "OpenCode plugin API", url: "https://opencode.ai/docs/plugins/", license: "MIT", note: "The provider plugin hooks (config/auth/provider/fetch) implemented here." },
        { name: "HanaAgent (OpenHanako)", url: "https://github.com/liliMozi/openhanako", license: "Apache-2.0", note: "The host application, its plugin system and its local HTTP API." },
        { name: "magpie-community/plugins", url: "https://github.com/magpie-community/plugins", license: "MIT", note: "Community provider plugins offered by the plugin marketplace." },
      ],
    });
  });

  // ---- agents --------------------------------------------------------------

  api.get("/agents", async (c) => {
    try {
      const s = await serverPromise;
      return c.json({ agents: await s.agents() });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/agents/connect", async (c) => {
    try {
      const s = await serverPromise;
      const { agentId, model } = await body(c);
      if (!agentId || !model) return c.json({ error: "agentId and model are required" }, 400);
      await s.connectAgent(agentId, model);
      return c.json({ ok: true, agents: await s.agents() });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/agents/disconnect", async (c) => {
    try {
      const s = await serverPromise;
      const { agentId } = await body(c);
      if (!agentId) return c.json({ error: "agentId is required" }, 400);
      await s.disconnectAgent(agentId);
      return c.json({ ok: true, agents: await s.agents() });
    } catch (err) { return jsonError(c, err); }
  });

  // ---- providers -----------------------------------------------------------

  api.get("/providers", async (c) => {
    try {
      const s = await serverPromise;
      return c.json({ providers: await s.catalog.allProviders(), presets: PRESETS, lastSync: s.lastSync });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/add", async (c) => {
    try {
      const s = await serverPromise;
      const input = await body(c);
      if (input.presetId) {
        const provider = s.catalog.createBuiltinFromPreset(input.presetId, input);
        if (input.fetchModels !== false) {
          s.catalog.refreshBuiltinModels(provider.id).then(() => s.syncProvider()).catch(() => {});
        }
        await s.syncProvider();
        return c.json({ ok: true, provider });
      }
      const provider = s.catalog.createBuiltinFromPreset("custom", input);
      s.catalog.refreshBuiltinModels(provider.id).then(() => s.syncProvider()).catch(() => {});
      await s.syncProvider();
      return c.json({ ok: true, provider });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/remove", async (c) => {
    try {
      const s = await serverPromise;
      const { id, kind = "builtin" } = await body(c);
      return c.json(await s.removeProvider(id, kind));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/restore", async (c) => {
    try {
      const s = await serverPromise;
      const { id, kind = "plugin" } = await body(c);
      return c.json(await s.restoreProvider(id, kind));
    } catch (err) { return jsonError(c, err); }
  });

  api.get("/providers/detail", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.providerDetail(c.req.query("id"), c.req.query("kind") || "builtin"));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/toggle", async (c) => {
    try {
      const s = await serverPromise;
      const { id, kind = "builtin", off } = await body(c);
      return c.json(await s.toggleProvider(id, kind, off));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/arrange", async (c) => {
    try {
      const s = await serverPromise;
      const { id, direction } = await body(c);
      return c.json(await s.arrangeProvider(id, direction));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/model", async (c) => {
    try {
      const s = await serverPromise;
      const { id, kind = "builtin", modelId, off } = await body(c);
      return c.json(await s.setModelEnabled(id, kind, modelId, off));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/models/bulk", async (c) => {
    try {
      const s = await serverPromise;
      const { id, kind = "builtin", states } = await body(c);
      return c.json(await s.setModelsEnabled(id, kind, Array.isArray(states) ? states : []));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/test", async (c) => {
    try {
      const s = await serverPromise;
      const { id, kind = "builtin", modelId } = await body(c);
      return c.json(await s.testProvider(id, kind, modelId));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/update", async (c) => {
    try {
      const s = await serverPromise;
      const { id, name, baseUrl, api } = await body(c);
      const p = s.store.provider(id);
      if (!p) return c.json({ error: "no such provider" }, 404);
      s.store.putProvider({ ...p, name: name ?? p.name, baseUrl: baseUrl ?? p.baseUrl, api: api ?? p.api });
      await s.syncProvider();
      return c.json({ ok: true });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/refresh", async (c) => {
    try {
      const s = await serverPromise;
      const { id, kind = "builtin" } = await body(c);
      let models;
      if (id && kind === "builtin") models = await s.catalog.refreshBuiltinModels(id);
      else if (id && kind === "plugin") await s.catalog.pluginProviderList({ force: true });
      else {
        for (const p of s.store.builtinProviders()) {
          try { await s.catalog.refreshBuiltinModels(p.id); } catch {}
        }
      }
      await s.catalog.pluginProviderList({ force: true });
      await s.syncProvider();
      return c.json({ ok: true, count: models?.length });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/providers/models", async (c) => {
    try {
      const s = await serverPromise;
      const { id, models } = await body(c);
      const p = s.store.provider(id);
      if (!p) return c.json({ error: "no such provider" }, 404);
      s.store.putProvider({ ...p, models: Array.isArray(models) ? models : [] });
      await s.syncProvider();
      return c.json({ ok: true });
    } catch (err) { return jsonError(c, err); }
  });

  // ---- accounts ------------------------------------------------------------

  api.post("/accounts/add", async (c) => {
    try {
      const s = await serverPromise;
      const { provider: id, name, apiKey, baseUrl, api } = await body(c);
      const p = s.store.provider(id);
      if (!p) return c.json({ error: "no such provider" }, 404);
      if (!apiKey && !p.keyless) return c.json({ error: "API key is required" }, 400);
      const accountId = `acct-${Date.now().toString(36)}`;
      const accounts = [...(p.accounts || []), { id: accountId, name: name || `Key ${(p.accounts || []).length + 1}` }];
      s.store.putProvider({ ...p, accounts });
      s.store.setBuiltinAuth(id, accountId, {
        type: "api",
        key: apiKey || "local",
        baseUrl: baseUrl || p.baseUrl,
        api: api || p.api,
      });
      s.catalog.refreshBuiltinModels(id).then(() => s.syncProvider()).catch(() => {});
      await s.syncProvider();
      return c.json({ ok: true, account: accountId });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/accounts/remove", async (c) => {
    try {
      const s = await serverPromise;
      const { provider: id, account } = await body(c);
      const p = s.store.provider(id);
      if (!p) return c.json({ error: "no such provider" }, 404);
      s.store.putProvider({ ...p, accounts: (p.accounts || []).filter((a) => a.id !== account) });
      s.store.removeBuiltinAuth(id, account);
      await s.syncProvider();
      return c.json({ ok: true });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/accounts/disable", async (c) => {
    try {
      const s = await serverPromise;
      const { provider: id, account, disabled } = await body(c);
      const p = s.store.provider(id);
      if (!p) return c.json({ error: "no such provider" }, 404);
      s.store.putProvider({
        ...p,
        accounts: (p.accounts || []).map((a) => (a.id === account ? { ...a, disabled: !!disabled } : a)),
      });
      return c.json({ ok: true });
    } catch (err) { return jsonError(c, err); }
  });

  // ---- plugin provider sign-in --------------------------------------------

  api.post("/provider/signin", async (c) => {
    try {
      const s = await serverPromise;
      const input = await body(c);
      return c.json(await s.pluginSignIn(input));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/provider/oauth/start", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.pluginOAuthStart(await body(c)));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/provider/oauth/callback", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.pluginOAuthCallback(await body(c)));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/provider/prompt", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.host.prompt(await body(c)));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/provider/validate", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.host.validate(await body(c)));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/provider/signout", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.pluginSignOut(await body(c)));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/provider/usage", async (c) => {
    try {
      const s = await serverPromise;
      const input = await body(c);
      return c.json(await s.pluginUsage(input));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/provider/check", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.pluginCheck(await body(c)));
    } catch (err) { return jsonError(c, err); }
  });

  // ---- models & groups -----------------------------------------------------

  api.get("/models", async (c) => {
    try {
      const s = await serverPromise;
      return c.json({ models: await s.catalog.allModelsWithGroups() });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/groups/save", async (c) => {
    try {
      const s = await serverPromise;
      const group = s.catalog.validateGroup(await body(c));
      s.store.putGroup(group);
      await s.syncProvider();
      return c.json({ ok: true, group: s.catalog.groupDescriptor(group) });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/groups/remove", async (c) => {
    try {
      const s = await serverPromise;
      const { id } = await body(c);
      const ok = s.store.removeGroup(id);
      await s.syncProvider();
      return c.json({ ok });
    } catch (err) { return jsonError(c, err); }
  });

  // ---- plugins -------------------------------------------------------------

  api.get("/plugins", async (c) => {
    try {
      const s = await serverPromise;
      return c.json({
        plugins: s.store.plugins(),
        host: s.host.status(),
        market: loadMarket(s.store),
      });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/plugins/add", async (c) => {
    try {
      const s = await serverPromise;
      const { spec, options } = await body(c);
      if (!spec) return c.json({ error: "spec is required" }, 400);
      const entry = await s.addPlugin(spec, options);
      return c.json({ ok: true, plugin: entry });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/plugins/remove", async (c) => {
    try {
      const s = await serverPromise;
      const { spec } = await body(c);
      return c.json(await s.removePlugin(spec));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/plugins/toggle", async (c) => {
    try {
      const s = await serverPromise;
      const { spec, off } = await body(c);
      return c.json(await s.togglePlugin(spec, off));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/plugins/options", async (c) => {
    try {
      const s = await serverPromise;
      const { spec, options } = await body(c);
      return c.json(await s.setPluginOptions(spec, options));
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/plugins/update", async (c) => {
    try {
      const s = await serverPromise;
      const { spec } = await body(c);
      return c.json(await s.updatePlugin(spec));
    } catch (err) { return jsonError(c, err); }
  });

  api.get("/plugins/search", async (c) => {
    try {
      const s = await serverPromise;
      const q = c.req.query("q") || "opencode-plugin";
      return c.json(await s.searchPlugins(q));
    } catch (err) { return jsonError(c, err); }
  });

  api.get("/market", async (c) => {
    const s = await serverPromise;
    return c.json(loadMarket(s.store));
  });

  // ---- usage ---------------------------------------------------------------

  api.get("/usage", async (c) => {
    try {
      const s = await serverPromise;
      const period = c.req.query("period") || "today";
      return c.json(s.usageSummary(period));
    } catch (err) { return jsonError(c, err); }
  });

  // ---- settings / gateway --------------------------------------------------

  api.get("/settings", async (c) => {
    const s = await serverPromise;
    return c.json({ settings: s.publicSettings(), gateway: await s.gatewayInfo(), host: s.host.status(), lastSync: s.lastSync });
  });

  api.post("/settings", async (c) => {
    try {
      const s = await serverPromise;
      return c.json({ ok: true, settings: await s.updateSettings(await body(c)), gateway: await s.gatewayInfo() });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/gateway/key", async (c) => {
    try {
      const s = await serverPromise;
      return c.json(await s.regenerateKey());
    } catch (err) { return jsonError(c, err); }
  });

  api.get("/gateway", async (c) => {
    const s = await serverPromise;
    return c.json(await s.gatewayInfo({ exposeKey: c.req.query("key") === "1" }));
  });

  api.post("/gateway/restart", async (c) => {
    try {
      const s = await serverPromise;
      await s.gateway.restart();
      await s.syncProvider();
      return c.json({ ok: true, gateway: s.gateway.status() });
    } catch (err) { return jsonError(c, err); }
  });

  api.post("/sync", async (c) => {
    try {
      const s = await serverPromise;
      await s.syncProvider();
      return c.json({ ok: true, lastSync: s.lastSync, gateway: s.gateway.status() });
    } catch (err) { return jsonError(c, err); }
  });

  api.get("/logs", async (c) => {
    const s = await serverPromise;
    return c.json({ lines: s.logLines(Number(c.req.query("limit") || 300)) });
  });

  api.get("/quotas", async (c) => {
    try {
      const s = await serverPromise;
      return c.json({ quotas: await s.gateway.quotas(), at: new Date().toISOString() });
    } catch (err) { return jsonError(c, err); }
  });
}

