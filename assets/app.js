/* Hana Magpie — the page inside HanaAgent.
 *
 * The layout and the visual language follow magpie's own window (its
 * sidebar, top bar, rows and dialogs); the data comes from this plugin's
 * JSON API instead of magpie's Go server. Nothing here talks to magpie.
 */
(() => {
  "use strict";

  const PLUGIN_ID = "hana-magpie";
  const BASE = `/api/plugins/${PLUGIN_ID}`;
  const params = new URLSearchParams(location.search);
  const surfaceSession = params.get("pluginSurfaceSession") || "";
  const pageToken = params.get("token") || "";
  const themeParam = params.get("hana-theme") || "";
  if (themeParam === "dark" || themeParam === "light") document.documentElement.dataset.theme = themeParam;
  else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) document.documentElement.dataset.theme = "dark";

  const T = {
    zh: {
      agents: "智能体", providers: "供应商", routing: "路由", gateway: "网关",
      usage: "用量", plugins: "插件", settings: "设置", about: "关于",
      work: "工作", modelsGroup: "模型", insightsGroup: "洞察", extendGroup: "扩展", gatewayNav: "网关", settingsNav: "设置",
      loading: "加载中…", addProvider: "添加供应商", refresh: "刷新", add: "添加", search: "搜索",
      agentsSub: "为 HanaAgent 的每个智能体选择一个模型", providersSub: "API Key、订阅与 Magpie 供应商插件",
      routingSub: "把多个模型组成一个可故障切换的路由组", gatewaySub: "HanaAgent 使用的本地网关",
      usageSub: "调用、token、费用与额度", pluginsSub: "Magpie / OpenCode 供应商插件",
      noAgents: "还没有智能体。先在 HanaAgent 里创建一个。",
      agentsHint: "在这里选择的模型会写回 HanaAgent 中对应智能体的配置。",
      noProviders: "还没有供应商。添加一个 API Key 供应商，或从插件市场安装订阅插件。",
      noGroups: "还没有路由组。",
      noPlugins: "还没有安装供应商插件。",
      connect: "选择模型", change: "更换模型", disconnect: "断开",
      onMagpie: "经由 Magpie", ownModel: "HanaAgent 自己的模型", noModel: "未设置",
      chooseModel: "选择模型", searchModels: "搜索模型…", current: "当前",
      accounts: "个账号", models: "个模型", signIn: "登录", addKey: "添加 Key",
      usageBtn: "额度", edit: "编辑", remove: "移除", save: "保存", cancel: "取消",
      delete: "删除", confirm: "确认", close: "关闭", copy: "复制", copied: "已复制",
      providerAdded: "供应商已添加", saved: "已保存", removed: "已移除", failed: "操作失败",
      gatewayRunning: "运行中", gatewayStopped: "未运行", port: "端口", baseUrl: "地址",
      gatewayKey: "网关密钥", reveal: "显示", hide: "隐藏", regenerate: "重新生成",
      restart: "重启网关", syncProvider: "同步到 HanaAgent", syncOK: "已同步",
      calls: "调用", errors: "错误", inputTokens: "输入 token", outputTokens: "输出 token",
      cost: "费用", avgLatency: "平均延迟", today: "今天", last7: "7 天", last30: "30 天", all: "全部",
      byProvider: "按供应商", byModel: "按模型", recent: "最近请求", quotas: "额度窗口",
      refreshQuotas: "读取额度", noUsage: "这个时间段还没有请求。",
      market: "插件市场", installed: "已安装", searchNpm: "搜索 npm 供应商插件…",
      addFrom: "从 npm、GitHub 或文件夹安装", specPlaceholder: "npm 包名 / owner/repo / 文件夹路径",
      install: "安装", update: "更新", options: "选项", enable: "启用", disable: "禁用",
      source: "来源", provides: "提供", version: "版本", folder: "文件夹", npm: "npm", git: "GitHub",
      aboutText: "Hana Magpie 把 Magpie 的核心能力搬进 HanaAgent：供应商插件、登录、模型发现、本地网关、故障切换、路由组与用量。它不需要安装或运行 Magpie。",
      attribution: "借用的项目", portNote: "Magpie 使用 3425/3426；本插件默认 3525。",
      language: "语言", theme: "主题", auto: "跟随系统", proxy: "代理", registry: "npm 镜像",
      autoSync: "模型变化时自动同步到 HanaAgent", settingsSaved: "设置已保存",
      providerName: "名称", baseUrlLabel: "Base URL", apiLabel: "接口", keyLabel: "API Key",
      keyPlaceholder: "粘贴 API Key（不会显示在页面上）", modelsLabel: "模型（每行一个，可留空自动发现）",
      custom: "自定义", presets: "常用供应商", pluginSource: "供应商插件",
      groupName: "路由组名称", groupModels: "成员模型", groupRouting: "路由方式",
      smart: "智能（轮换 + 故障切换）", roundRobin: "轮询", ordered: "按顺序",
      signInTitle: "登录", signInHint: "登录信息只保存在本机插件数据目录。",
      oauthStart: "打开登录页", oauthCode: "粘贴回调码", finish: "完成",
      pluginInstalled: "插件已安装", pluginRemoved: "插件已移除", pluginToggled: "已切换",
      confirmRemoveProvider: "移除这个供应商？它的账号与 Key 会一起删除。",
      confirmRemovePlugin: "移除这个插件？",
      confirmRemoveGroup: "删除这个路由组？",
      emptyModels: "还没有模型。先登录一个账号，或点「编辑」手动填写模型。",
      gatewayHint: "HanaAgent 已经通过 provider「hana-magpie」使用这个网关；不需要在 HanaAgent 设置里再添加供应商。",
      logs: "日志", noLogs: "暂无日志。", syncFailed: "同步失败",
      localOnly: "只监听 127.0.0.1", modelsCount: "个模型", pluginCount: "个插件",
      builtin: "内置", pluginKind: "插件", groupKind: "路由组",
      revealKeyHint: "网关密钥等同本机模型访问权限，请勿分享。",
      retry: "重试", done: "完成", working: "处理中…", signedIn: "已登录", signOut: "退出登录", lastSync: "最近同步", modelsStat: "模型",
      providerLabel: "供应商", modelsShort: "模型", time: "时间", model: "模型", status: "状态", tokens: "token", latency: "耗时", quota: "额度",
      marketProvider: "供应商", middlewareKind: "中间件", noResults: "没有结果。", invalidJson: "JSON 无效：",
      localProviderNote: "本地供应商不需要 Key。", optionsNote: "这些 JSON 选项会作为插件的第二个参数，与 magpie 的 plugins.json 一致。",
      folderNote: "文件夹插件会复制到 HanaAgent 的插件数据目录，原目录之后可以移动。",
      proxyHint: "供应商请求使用的 HTTP(S) 代理（如果厂商需要）。", registryHint: "留空使用 https://registry.npmjs.org",
      modelsPlaceholder: "每行一个模型 ID，可留空自动发现", defaultAccount: "默认",
      searchPlaceholder: "搜索 npm 供应商插件…", noResult: "没有结果。",
      needsSignIn: "需要登录", keyConfigured: "Key 已配置", needsKey: "需要 Key", keyless: "本地 · 不需要 Key",
      providerDisabled: "已停用", providerEnabled: "已启用", addAccount: "添加账号", test: "测试",
      settings: "设置", allOn: "全部启用", allOff: "全部停用", refreshModels: "刷新模型",
      accountsTitle: "账号", modelsTitle: "模型", providerUsage: "额度", providerInfo: "供应商信息",
      noAccounts: "还没有账号。", noModels: "还没有模型。", addFirstProvider: "添加第一个供应商",
      pluginsInstalled: "已安装的供应商插件", apiProviders: "API Key 供应商", vendors: "模型厂商", relays: "聚合 / 中转", localProviders: "本机",
      subscriptions: "订阅（登录即可）", subscriptionHint: "登录已有的订阅或计划，不需要 API Key",
      fromPlugins: "来自插件", fromPluginsHint: "由 Magpie 供应商插件提供",
      apiKeyProviders: "供应商（API Key）", apiKeyHint: "厂商自己的 API",
      relaysTitle: "中转（一个密钥多家厂商）", relayHint: "一个 Key 接入多家模型",
      anyCompatUrl: "任意 OpenAI / Anthropic 兼容地址",
      subShort: "订阅", pluginShort: "插件", relayShort: "中转", vendorShort: "供应商", installAndSignIn: "安装并登录",
      morePlugins: "更多", morePluginsHint: "打开插件页面查看全部供应商插件",
      selectAll: "全选", invert: "反选", enableProvider: "启用供应商", disableProvider: "停用供应商",
      confirmRemovePluginProvider: "删除这个供应商？它的模型会从 Magpie 和 HanaAgent 中移除，供应商插件本身会保留。",
      restore: "恢复", restoreHint: "之前删除的供应商", restored: "供应商已恢复",
      modelsSaveHint: "勾选或全选后，点“保存”才会同步到 HanaAgent。",
      added: "已添加", manage: "管理", goPlugins: "去插件市场", testOK: "测试通过", testFailed: "测试失败",
      removeProvider: "删除供应商", saveProvider: "保存设置", usageOnlyPlugin: "供应商插件可以报告额度；API Key 供应商没有额度窗口。",
      startSignIn: "开始登录", account: "账号", searchProviders: "搜索供应商…",
    },
    en: {
      agents: "Agents", providers: "Providers", routing: "Routing", gateway: "Gateway",
      usage: "Usage", plugins: "Plugins", settings: "Settings", about: "About",
      work: "Work", modelsGroup: "Models", insightsGroup: "Insights", extendGroup: "Extend", gatewayNav: "Gateway", settingsNav: "Settings",
      loading: "Loading…", addProvider: "Add provider", refresh: "Refresh", add: "Add", search: "Search",
      agentsSub: "Pick a model for each HanaAgent agent", providersSub: "API keys, subscriptions and Magpie provider plugins",
      routingSub: "Group models behind one failover route", gatewaySub: "The local gateway HanaAgent uses",
      usageSub: "Calls, tokens, cost and quotas", pluginsSub: "Magpie / OpenCode provider plugins",
      noAgents: "No agents yet. Create one in HanaAgent first.",
      agentsHint: "A model picked here is written back into that agent's HanaAgent config.",
      noProviders: "No providers yet. Add an API-key provider or install a subscription plugin.",
      noGroups: "No routing groups yet.", noPlugins: "No provider plugins installed yet.",
      connect: "Pick model", change: "Change model", disconnect: "Disconnect",
      onMagpie: "via Magpie", ownModel: "HanaAgent's own model", noModel: "Not set",
      chooseModel: "Choose a model", searchModels: "Search models…", current: "Current",
      accounts: "accounts", models: "models", signIn: "Sign in", addKey: "Add key",
      usageBtn: "Usage", edit: "Edit", remove: "Remove", save: "Save", cancel: "Cancel",
      delete: "Delete", confirm: "Confirm", close: "Close", copy: "Copy", copied: "Copied",
      providerAdded: "Provider added", saved: "Saved", removed: "Removed", failed: "Failed",
      gatewayRunning: "Running", gatewayStopped: "Stopped", port: "Port", baseUrl: "Base URL",
      gatewayKey: "Gateway key", reveal: "Reveal", hide: "Hide", regenerate: "Regenerate",
      restart: "Restart gateway", syncProvider: "Sync to HanaAgent", syncOK: "Synced",
      calls: "Calls", errors: "Errors", inputTokens: "Input tokens", outputTokens: "Output tokens",
      cost: "Cost", avgLatency: "Avg latency", today: "Today", last7: "7 days", last30: "30 days", all: "All",
      byProvider: "By provider", byModel: "By model", recent: "Recent requests", quotas: "Quota windows",
      refreshQuotas: "Read quotas", noUsage: "No requests in this period.",
      market: "Plugin market", installed: "Installed", searchNpm: "Search npm provider plugins…",
      addFrom: "Install from npm, GitHub or a folder", specPlaceholder: "npm name / owner/repo / folder path",
      install: "Install", update: "Update", options: "Options", enable: "Enable", disable: "Disable",
      source: "Source", provides: "Provides", version: "Version", folder: "folder", npm: "npm", git: "GitHub",
      aboutText: "Hana Magpie brings Magpie's core into HanaAgent: provider plugins, sign-in, model discovery, a local gateway, failover, routing groups and usage. Magpie never has to be installed or running.",
      attribution: "Borrowed projects", portNote: "Magpie uses 3425/3426; this plugin defaults to 3525.",
      language: "Language", theme: "Theme", auto: "System", proxy: "Proxy", registry: "npm registry",
      autoSync: "Sync model changes to HanaAgent automatically", settingsSaved: "Settings saved",
      providerName: "Name", baseUrlLabel: "Base URL", apiLabel: "API", keyLabel: "API key",
      keyPlaceholder: "Paste an API key (never shown again)", modelsLabel: "Models (one per line, empty = discover)",
      custom: "Custom", presets: "Common providers", pluginSource: "Provider plugin",
      groupName: "Group name", groupModels: "Member models", groupRouting: "Routing",
      smart: "Smart (rotate + fail over)", roundRobin: "Round-robin", ordered: "In order",
      signInTitle: "Sign in", signInHint: "Credentials stay in this plugin's local data folder.",
      oauthStart: "Open sign-in page", oauthCode: "Paste the callback code", finish: "Finish",
      pluginInstalled: "Plugin installed", pluginRemoved: "Plugin removed", pluginToggled: "Toggled",
      confirmRemoveProvider: "Remove this provider? Its accounts and keys go with it.",
      confirmRemovePlugin: "Remove this plugin?", confirmRemoveGroup: "Delete this routing group?",
      emptyModels: "No models yet. Sign in an account, or use Edit to add model ids by hand.",
      gatewayHint: "HanaAgent already uses this gateway through the provider \"hana-magpie\"; you do not need to add another provider in HanaAgent settings.",
      logs: "Logs", noLogs: "No logs yet.", syncFailed: "Sync failed",
      localOnly: "Listening on 127.0.0.1 only", modelsCount: "models", pluginCount: "plugins",
      builtin: "Built-in", pluginKind: "Plugin", groupKind: "Group",
      revealKeyHint: "The gateway key is local model access; do not share it.",
      retry: "Retry", done: "Done", working: "Working…", signedIn: "signed in", signOut: "Sign out", lastSync: "Last sync", modelsStat: "Models",
      providerLabel: "Provider", modelsShort: "Models", time: "Time", model: "Model", status: "Status", tokens: "Tokens", latency: "Latency", quota: "Quota",
      marketProvider: "provider", middlewareKind: "middleware", noResults: "No results.", invalidJson: "Invalid JSON: ",
      localProviderNote: "This provider is local and needs no key.", optionsNote: "These JSON options are passed as the plugin's second argument, as in magpie's plugins.json.",
      folderNote: "Folder plugins are copied into HanaAgent's plugin data, so the original can be moved later.",
      proxyHint: "HTTP(S) proxy for provider requests, if the vendor needs one.", registryHint: "Empty uses https://registry.npmjs.org",
      modelsPlaceholder: "One model id per line; empty = discover", defaultAccount: "Default",
      searchPlaceholder: "Search npm provider plugins…", noResult: "No results.",
      needsSignIn: "Sign-in needed", keyConfigured: "Key configured", needsKey: "Key needed", keyless: "Local · no key",
      providerDisabled: "Off", providerEnabled: "On", addAccount: "Add account", test: "Test",
      settings: "Settings", allOn: "Enable all", allOff: "Disable all", refreshModels: "Refresh models",
      accountsTitle: "Accounts", modelsTitle: "Models", providerUsage: "Usage", providerInfo: "Provider",
      noAccounts: "No accounts yet.", noModels: "No models yet.", addFirstProvider: "Add your first provider",
      pluginsInstalled: "Installed provider plugins", apiProviders: "API-key providers", vendors: "Vendors", relays: "Relays", localProviders: "Local",
      subscriptions: "Subscriptions (sign in)", subscriptionHint: "Sign in to a plan you already pay for; no API key",
      fromPlugins: "From plugins", fromPluginsHint: "Supplied by a Magpie provider plugin",
      apiKeyProviders: "Providers (API key)", apiKeyHint: "The vendors' own APIs",
      relaysTitle: "Relays (one key, many vendors)", relayHint: "One key for many models",
      anyCompatUrl: "Any OpenAI / Anthropic compatible URL",
      subShort: "Subscription", pluginShort: "Plugin", relayShort: "Relay", vendorShort: "Provider", installAndSignIn: "Install & sign in",
      morePlugins: "More", morePluginsHint: "Open the Plugins page for every provider plugin",
      selectAll: "All", invert: "Invert", enableProvider: "Enable provider", disableProvider: "Disable provider",
      confirmRemovePluginProvider: "Remove this provider? Its models disappear from Magpie and HanaAgent; the provider plugin itself is kept.",
      restore: "Restore", restoreHint: "Providers removed earlier", restored: "Provider restored",
      modelsSaveHint: "After ticking models (or All / Invert), press Save to sync to HanaAgent.",
      added: "Added", manage: "Manage", goPlugins: "Plugin market", testOK: "Test passed", testFailed: "Test failed",
      removeProvider: "Remove provider", saveProvider: "Save settings", usageOnlyPlugin: "Provider plugins can report quotas; API-key providers have no quota windows.",
      startSignIn: "Start sign-in", account: "account", searchProviders: "Search providers…",
    },
  };

  const S = {
    state: null,
    view: "agents",
    usage: null,
    usagePeriod: "today",
    quotas: null,
    presets: [],
    market: null,
    busy: false,
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  function lang() { return S.state?.settings?.language === "en" ? "en" : "zh"; }
  function t(key) { return T[lang()][key] ?? key; }

  function applyStaticLanguage() {
    const en = lang() === "en";
    for (const el of document.querySelectorAll("[data-zh]")) {
      el.textContent = en ? (el.dataset.en || el.dataset.zh) : el.dataset.zh;
    }
    document.documentElement.lang = en ? "en" : "zh";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (k === "disabled") el.disabled = !!v;
      else if (k === "style") el.setAttribute("style", v);
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function assetUrl(file) {
    if (typeof window.__HANA_MAGPIE_ASSET__ === "function") return window.__HANA_MAGPIE_ASSET__(file);
    return `${BASE}/assets/${file}`;
  }

  function iconSrc(name) {
    if (!name) return assetUrl("icons/generic.svg");
    if (/^https?:\/\//i.test(name) || /^data:/i.test(name)) return name;
    const file = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.svg`;
    return assetUrl(`icons/${encodeURIComponent(file)}`);
  }

  function providerIcon(name, cls = "") {
    const img = h("img", { src: iconSrc(name), alt: "", loading: "lazy" });
    // Market icons are bare names; most are SVG, a few (zcode, workbuddy…)
    // are PNG. Try the other extension once, then the generic puzzle.
    img.addEventListener("error", () => {
      if (!img.dataset.fallback && name && !/^https?:|^data:/i.test(name) && !/\.[a-z0-9]+$/i.test(name)) {
        img.dataset.fallback = "png";
        img.src = assetUrl(`icons/${encodeURIComponent(name)}.png`);
      } else if (img.dataset.fallback !== "generic") {
        img.dataset.fallback = "generic";
        img.src = assetUrl("icons/generic.svg");
      }
    });
    return h("span", { class: `hm-icon ${cls}` }, img);
  }

  function avatar(agent) {
    if (agent.avatar) return h("span", { class: "hm-avatar" }, h("img", { src: agent.avatar, alt: "" }));
    const ch = (agent.name || "?").trim().slice(0, 1).toUpperCase();
    return h("span", { class: "hm-avatar", text: agent.emoji || ch });
  }

  function badge(text, cls = "") { return h("span", { class: `hm-badge ${cls}`, text }); }

  function fmtNum(n) {
    const v = Number(n) || 0;
    if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return String(Math.round(v));
  }

  function fmtCost(n) {
    const v = Number(n) || 0;
    if (!v) return "$0";
    if (v < 0.01) return "$" + v.toFixed(4);
    return "$" + v.toFixed(2);
  }

  function fmtMs(ms) {
    const v = Number(ms) || 0;
    return v >= 1000 ? (v / 1000).toFixed(1) + "s" : Math.round(v) + "ms";
  }

  function fmtTime(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    const two = (x) => String(x).padStart(2, "0");
    return `${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
  }

  function toast(message, kind = "") {
    const wrap = $("#toasts");
    const el = h("div", { class: `toast ${kind}`, text: message });
    wrap.append(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .2s"; }, 3200);
    setTimeout(() => el.remove(), 3600);
  }

  async function api(path, { method = "GET", body } = {}) {
    const headers = { accept: "application/json" };
    if (surfaceSession) headers["x-hana-plugin-surface-session"] = surfaceSession;
    if (pageToken) headers.authorization = `Bearer ${pageToken}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${BASE}/api/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) throw Object.assign(new Error(data?.error || `${res.status} ${res.statusText}`), { status: res.status, data });
    return data;
  }

  async function loadState() {
    try {
      S.state = await api("state");
      applyStaticLanguage();
      S.presets = S.presets.length ? S.presets : (await api("providers").catch(() => ({}))).presets || [];
      S.market = S.state.market || S.market;
      return true;
    } catch (err) {
      $("#view").replaceChildren(h("div", { class: "hm-empty" }, h("b", { text: "Hana Magpie" }), String(err.message || err)));
      return false;
    }
  }

  function setHeader() {
    const titles = {
      agents: t("agents"), providers: t("providers"), routing: t("routing"),
      gateway: t("gateway"), usage: t("usage"), plugins: t("plugins"), settings: t("settings"),
    };
    $("#pageTitle").textContent = titles[S.view] || "Magpie";
    const subs = {
      agents: t("agentsSub"), providers: t("providersSub"), routing: t("routingSub"),
      gateway: t("gatewaySub"), usage: t("usageSub"), plugins: t("pluginsSub"), settings: "",
    };
    $("#pageSub").textContent = S.state ? subs[S.view] || "" : "";
    for (const b of $$("#nav button[data-view]")) b.classList.toggle("on", b.dataset.view === S.view);
    $("#sideSettings")?.classList.toggle("on", S.view === "settings");
    const gw = S.state?.gateway;
    const pill = $("#sideGw");
    if (gw) {
      pill.classList.toggle("on", !!gw.running);
      pill.classList.toggle("off", !gw.running);
      pill.querySelector("span").textContent = `${t("gatewayNav")} :${gw.port}`;
      pill.title = gw.running ? `${gw.baseUrl} · ${t("gatewayRunning")}` : t("gatewayStopped");
    }
  }

  function actionButton(label, onClick, cls = "") {
    return h("button", { class: `hm-btn ${cls}`, type: "button", onclick: onClick, text: label });
  }

  function setActions(nodes) {
    $("#pageActions").replaceChildren(...nodes.filter(Boolean));
  }

  // ---- modal ---------------------------------------------------------------

  let modalReturn = null;

  function openModal({ title, sub = "", body, footer = [], wide = false }) {
    modalReturn = document.activeElement;
    const dialog = $("#dialog");
    dialog.style.width = wide ? "min(760px, 100%)" : "";
    const close = h("button", { class: "hm-close", type: "button", title: t("close"), onclick: closeModal }, "×");
    const kids = [
      h("div", { class: "hm-dialog-head" },
        h("h2", { text: title }),
        sub ? h("span", { class: "sub", text: sub }) : null,
        close,
      ),
      h("div", { class: "hm-dialog-body" }, body),
    ];
    if (footer.length) kids.push(h("div", { class: "hm-dialog-foot" }, ...footer));
    dialog.replaceChildren(...kids);
    $("#modal").hidden = false;
    $("#modal").onclick = (e) => { if (e.target === $("#modal")) closeModal(); };
    setTimeout(() => dialog.querySelector("input,button,textarea,select")?.focus(), 30);
  }

  function closeModal() {
    $("#modal").hidden = true;
    $("#dialog").replaceChildren();
    try { modalReturn?.focus?.(); } catch {}
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal").hidden) closeModal();
  });

  function confirmModal(title, text, onYes, danger = false) {
    openModal({
      title,
      body: h("div", { class: "hm-note", text }),
      footer: [
        actionButton(t("cancel"), closeModal),
        actionButton(t("confirm"), async () => { closeModal(); await onYes(); }, danger ? "danger" : "primary"),
      ],
    });
  }

  async function withBusy(button, fn) {
    if (!button) return fn();
    const old = button.textContent;
    button.disabled = true;
    button.textContent = t("working");
    try { return await fn(); } finally { button.disabled = false; button.textContent = old; }
  }

  // ---- navigation ----------------------------------------------------------

  function navigate(view) {
    if (!T[lang()][view]) return;
    S.view = view;
    S.usage = null;
    S.quotas = null;
    setHeader();
    render().catch((err) => toast(err.message, "err"));
  }

  function initNav() {
    for (const b of $$("#nav button[data-view]")) {
      b.addEventListener("click", () => navigate(b.dataset.view));
    }
    $("#sideGw").addEventListener("click", () => navigate("gateway"));
    $("#sideSettings")?.addEventListener("click", () => navigate("settings"));
  }

  // ---- agents --------------------------------------------------------------

  function modelLabel(m) { return `${m.providerName} · ${m.name}`; }

  async function renderAgents() {
    const s = S.state;
    setActions([
      actionButton(t("refresh"), () => reloadView()),
    ]);
    if (!s.agents.length) {
      $("#view").replaceChildren(h("div", { class: "hm-empty" }, h("b", { text: t("agents") }), t("noAgents")));
      return;
    }
    const list = h("div", { class: "list" });
    for (const a of s.agents) {
      const modelText = a.onMagpie ? (a.modelName || a.chat?.id || "") : (a.modelName || t("ownModel"));
      const row = h("div", { class: `row ${a.onMagpie ? "" : "off"}` },
        avatar(a),
        h("div", { class: "who" },
          h("div", { class: "name", text: a.name }),
          h("div", { class: "sub", text: modelText || t("noModel") }),
        ),
        a.onMagpie ? badge(t("onMagpie"), "green") : null,
        h("div", { class: "hm-row-actions" },
          actionButton(a.onMagpie ? t("change") : t("connect"), () => openAgentModelPicker(a), "small"),
          a.onMagpie ? actionButton(t("disconnect"), () => disconnectAgent(a), "small ghost") : null,
        ),
      );
      list.append(row);
    }
    $("#view").replaceChildren(
      h("div", { class: "hm-note", text: t("agentsHint") }),
      list,
    );
  }

  async function disconnectAgent(agent) {
    try {
      await api("agents/disconnect", { method: "POST", body: { agentId: agent.id } });
      toast(t("saved"), "ok");
      await reloadView();
    } catch (err) { toast(err.message, "err"); }
  }

  async function openAgentModelPicker(agent) {
    // The provider editor can hide models; make sure this picker reads the
    // post-sync catalog instead of the snapshot loaded when the page opened.
    try { await loadState(); } catch {}
    const models = S.state.models;
    const body = h("div", { style: "display:flex;flex-direction:column;gap:10px" });
    const search = h("input", { class: "hm-input", placeholder: t("searchModels") });
    const choice = h("div", { class: "hm-choice" });
    const groups = new Map();
    for (const m of models) {
      const key = m.providerId;
      if (!groups.has(key)) groups.set(key, { name: m.providerName, icon: m.providerIcon, kind: m.kind, items: [] });
      groups.get(key).items.push(m);
    }
    const draw = (q = "") => {
      choice.replaceChildren();
      const needle = q.trim().toLowerCase();
      for (const g of groups.values()) {
        const items = g.items.filter((m) => !needle || `${m.name} ${m.providerName} ${m.modelId}`.toLowerCase().includes(needle));
        if (!items.length) continue;
        choice.append(h("div", { class: "hm-choice-group", text: `${g.name} · ${g.kind === "group" ? t("groupKind") : ""}`.trim() }));
        for (const m of items) {
          const current = agent.chat?.id === m.key;
          choice.append(h("button", { type: "button", class: current ? "on" : "", onclick: () => pickModel(agent, m) },
            providerIcon(m.providerIcon),
            h("span", { class: "grow" },
              h("div", { text: m.name }),
              h("div", { class: "sub", text: [m.kind === "group" ? t("groupKind") : m.providerName, m.context ? `${fmtNum(m.context)} ctx` : "", m.api].filter(Boolean).join(" · ") }),
            ),
            current ? badge(t("current"), "green") : null,
          ));
        }
      }
      if (!choice.childElementCount) choice.append(h("div", { class: "hm-empty", text: t("emptyModels") }));
    };
    search.addEventListener("input", () => draw(search.value));
    draw();
    body.append(search, choice);
    openModal({ title: `${t("chooseModel")} · ${agent.name}`, body, wide: true });
  }

  async function pickModel(agent, model) {
    closeModal();
    try {
      await api("agents/connect", { method: "POST", body: { agentId: agent.id, model: model.key } });
      toast(`${agent.name} → ${model.providerName} · ${model.name}`, "ok");
      await reloadView();
    } catch (err) { toast(err.message, "err"); }
  }

  // ---- providers -----------------------------------------------------------

  let providerQuery = "";

  function providerMatches(p, q) {
    if (!q) return true;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = [p.id, p.name, p.kind, p.spec, p.api, p.baseUrl, p.presetId,
      ...(p.accounts || []).flatMap((a) => [a.name, a.id]),
      ...((S.presets || []).filter((x) => x.id === p.presetId).map((x) => `${x.name} ${x.note || ""}`)),
    ].filter(Boolean).join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  }

  function agentsUsingProvider(p) {
    const models = S.state.models || [];
    return (S.state.agents || []).filter((a) => {
      if (!a.onMagpie) return false;
      const m = models.find((x) => x.key === a.chat?.id);
      if (!m) return false;
      if (m.kind === "group") {
        return (m.members || []).some((x) => String(x.ref || "").startsWith(`${p.kind}:${p.id}/`));
      }
      return m.providerId === p.id;
    });
  }

  function providerStatus(p) {
    if (p.kind === "plugin") return p.connected ? (p.accounts?.[0]?.name || t("signedIn")) : t("needsSignIn");
    if (p.connected) return t("keyConfigured");
    return p.keyless ? t("keyless") : t("needsKey");
  }

  function providerSwitch(on, onToggle) {
    const b = h("button", { type: "button", class: `hm-switch ${on ? "on" : ""}`, title: on ? t("providerEnabled") : t("providerDisabled") }, h("i"));
    b.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Read the rendered state, not the state captured when the row was
      // built: if the list has not re-rendered yet, a second click must
      // still flip the switch instead of sending the same value again.
      const next = !b.classList.contains("on");
      b.classList.toggle("on", next);
      try { await onToggle(next); } catch (err) { b.classList.toggle("on", !next); toast(err.message, "err"); }
    };
    return b;
  }

  async function toggleProvider(p, off) {
    await api("providers/toggle", { method: "POST", body: { id: p.id, kind: p.kind, off } });
    toast(off ? `${p.name} · ${t("providerDisabled")}` : `${p.name} · ${t("providerEnabled")}`, "ok");
    await reloadView();
  }

  async function renderProviders() {
    const s = S.state;
    setActions([
      actionButton(t("addProvider"), () => openAddProvider(), "primary"),
      actionButton(t("refresh"), () => withBusy(null, async () => { await api("providers/refresh", { method: "POST", body: {} }); await reloadView(); })),
    ]);
    const q = providerQuery.trim().toLowerCase();
    const all = (s.providers || []).filter((p) => providerMatches(p, q));
    const on = all.filter((p) => !p.off);
    const off = all.filter((p) => p.off);
    const toolbar = h("div", { class: "hm-toolbar" },
      h("input", {
        class: "hm-input", style: "max-width:300px", placeholder: t("searchProviders"),
        value: providerQuery,
        oninput: (e) => { providerQuery = e.target.value; renderProviders(); },
      }),
      h("span", { class: "grow" }),
      h("span", { class: "hm-muted", text: lang() === "zh" ? `${s.providers.length} 个供应商` : `${s.providers.length} providers` }),
    );
    const view = h("div", { style: "display:flex;flex-direction:column;gap:12px" }, toolbar);
    if (!s.providers.length) {
      view.append(h("div", { class: "hm-empty" },
        h("b", { text: t("providers") }), t("noProviders"),
        h("div", { style: "margin-top:10px" }, actionButton(t("addFirstProvider"), () => openAddProvider(), "primary")),
      ));
      $("#view").replaceChildren(view);
      return;
    }
    if (!all.length) {
      view.append(h("div", { class: "hm-empty", text: t("noResult") }));
      $("#view").replaceChildren(view);
      return;
    }
    if (on.length) view.append(providerList(on));
    if (off.length) {
      view.append(h("div", { class: "hm-note", text: `${t("providerDisabled")} (${off.length})` }), providerList(off));
    }
    view.append(h("div", { class: "hm-note", text: t("portNote") }));
    $("#view").replaceChildren(view);
  }

  function providerList(list) {
    const box = h("div", { class: "list" });
    for (const p of list) {
      const agents = agentsUsingProvider(p);
      const uses = h("div", { class: "uses" });
      for (const a of agents) {
        uses.append(h("button", {
          type: "button", class: "use", title: `${a.name} · ${a.modelName || ""}`,
          onclick: (e) => { e.stopPropagation(); openAgentModelPicker(a); },
        }, avatar(a)));
      }
      const key = h("span", { class: `key ${p.connected ? (p.kind === "plugin" ? "acct" : "on") : "none"}` },
        h("span", { text: providerStatus(p) }),
      );
      const row = h("div", { class: `row provider ${p.off ? "off" : ""}`, onclick: () => openProviderDetail(p) },
        providerIcon(p.icon || "generic.svg"),
        h("div", { class: "who" },
          h("div", { class: "name" },
            h("span", { text: p.name }),
            badge(
              p.category === "subscription" ? t("subShort") :
                p.category === "relay" ? t("relayShort") :
                  p.category === "plugin" ? t("pluginShort") : t("vendorShort"),
              "line",
            ),
            p.off ? badge(t("providerDisabled"), "amber") : null,
          ),
          h("div", { class: "sub", text: [
            p.kind === "plugin" && p.connected ? (p.accounts?.[0]?.name || t("signedIn")) : "",
            lang() === "zh" ? `${p.modelsOn ?? p.models} 个模型` : `${p.modelsOn ?? p.models} models`,
            p.error || "",
          ].filter(Boolean).join(" · ") }),
        ),
        uses,
        key,
        actionButton(p.off ? t("enable") : t("disable"), async (e) => {
          e.stopPropagation();
          try { await toggleProvider(p, !p.off); } catch (err) { toast(err.message, "err"); }
        }, "small ghost"),
        providerSwitch(!p.off, (off) => toggleProvider(p, off)),
        h("span", { class: "chev", text: "›" }),
      );
      box.append(row);
    }
    return box;
  }

  const SUBSCRIPTION_MARKET_PROVIDERS = new Set([
    "zcode", "qoder", "devin", "zed", "factory", "grok",
    "commandcode-plan", "mimo-app", "cursor", "kiro", "workbuddy", "workbuddy-ai",
  ]);

  function marketIsSubscription(m) {
    return (m.providers || []).some((id) => SUBSCRIPTION_MARKET_PROVIDERS.has(id));
  }

  function addTile({ icon, name, note, action, onClick }) {
    return h("button", { type: "button", class: "hm-tile", onclick: onClick },
      providerIcon(icon || "generic.svg"),
      h("span", { class: "nm" }, h("span", { class: "n", text: name }), note ? h("span", { class: "s", text: note }) : null),
      action ? h("span", { class: "hm-tile-act" }, action) : null,
    );
  }

  async function installFromAddSheet(pkg) {
    try {
      const r = await api("plugins/add", { method: "POST", body: { spec: pkg } });
      await loadState();
      closeModal();
      await renderProviders();
      const p = (S.state.providers || []).find((x) => x.kind === "plugin" && (x.spec === pkg || x.id === r?.plugin?.name));
      if (p) {
        if (p.connected) await openProviderDetail(p);
        else openPluginSignIn(p);
      } else {
        toast(t("pluginInstalled"), "ok");
        navigate("plugins");
      }
    } catch (err) { toast(err.message, "err"); }
  }

  async function openAddProvider() {
    let presets = S.presets;
    if (!presets?.length) {
      try { presets = (await api("providers")).presets || []; S.presets = presets; } catch {}
    }
    const body = h("div", { class: "hm-form" });
    const search = h("input", { class: "hm-input", placeholder: t("searchProviders") });
    const list = h("div", { style: "display:flex;flex-direction:column;gap:14px" });
    const section = (title, hint) => {
      const head = h("div", { class: "hm-section-head" }, h("b", { text: title }), hint ? h("span", { text: hint }) : null);
      const grid = h("div", { class: "hm-tiles" });
      return { head, grid, add: (tile) => grid.append(tile), wrap: () => h("div", { class: "hm-section" }, head, grid) };
    };
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      list.replaceChildren();
      const hit = (text) => !q || String(text || "").toLowerCase().includes(q);
      const installed = S.state.providers || [];
      const installedPlugins = new Set((S.state.plugins || []).map((p) => p.spec));
      const market = (S.state.market?.plugins || []).filter((m) => !m.installed && !installedPlugins.has(m.package));

      // 1. 订阅（登录即可）
      {
        const s = section(t("subscriptions"), t("subscriptionHint"));
        for (const p of installed.filter((x) => x.kind === "plugin" && x.hasOAuth && hit(`${x.name} ${x.id}`))) {
          s.add(addTile({
            icon: p.icon, name: p.name, note: p.connected ? t("signedIn") : t("needsSignIn"),
            action: badge(p.connected ? t("manage") : t("signIn"), p.connected ? "line" : "accent"),
            onClick: () => { closeModal(); p.connected ? openProviderDetail(p) : openPluginSignIn(p); },
          }));
        }
        for (const m of market.filter((x) => marketIsSubscription(x) && hit(`${x.name} ${x.package} ${x.summary?.[lang()] || ""}`))) {
          s.add(addTile({
            icon: m.icon, name: m.name, note: (m.summary?.[lang()] || m.summary?.en || "").slice(0, 80),
            action: badge(t("installAndSignIn"), "accent"),
            onClick: () => installFromAddSheet(m.package),
          }));
        }
        if (s.grid.childElementCount) list.append(s.wrap());
      }

      // 2. 来自插件
      {
        const s = section(t("fromPlugins"), t("fromPluginsHint"));
        for (const p of installed.filter((x) => x.kind === "plugin" && !x.hasOAuth && hit(`${x.name} ${x.id}`))) {
          s.add(addTile({
            icon: p.icon, name: p.name, note: p.connected ? t("signedIn") : t("needsSignIn"),
            action: badge(p.connected ? t("manage") : t("signIn"), p.connected ? "line" : "accent"),
            onClick: () => { closeModal(); p.connected ? openProviderDetail(p) : openPluginSignIn(p); },
          }));
        }
        for (const m of market.filter((x) => !marketIsSubscription(x) && hit(`${x.name} ${x.package} ${x.summary?.[lang()] || ""}`))) {
          s.add(addTile({
            icon: m.icon, name: m.name, note: (m.summary?.[lang()] || m.summary?.en || "").slice(0, 80),
            action: badge(t("install"), "accent"),
            onClick: () => installFromAddSheet(m.package),
          }));
        }
        for (const p of (S.state.removedProviders || []).filter((x) => hit(`${x.name} ${x.id}`))) {
          s.add(addTile({
            icon: p.icon, name: `${t("restore")} ${p.name}`, note: t("restoreHint"),
            action: badge(t("restore"), "line"),
            onClick: async () => {
              try {
                await api("providers/restore", { method: "POST", body: { id: p.id, kind: "plugin" } });
                closeModal(); await reloadView(); toast(t("restored"), "ok");
              } catch (err) { toast(err.message, "err"); }
            },
          }));
        }
        s.add(addTile({
          icon: "generic.svg",
          name: t("morePlugins"),
          note: t("morePluginsHint"),
          ...(q ? {} : { action: badge("→", "line") }),
          onClick: () => { closeModal(); navigate("plugins"); },
        }));
        if (s.grid.childElementCount) list.append(s.wrap());
      }

      // 3. venders / API key
      {
        const s = section(t("apiKeyProviders"), t("apiKeyHint"));
        for (const preset of (presets || []).filter((p) => p.id !== "custom" && presetKindOf(p.id) !== "relay" && hit(`${p.name} ${presetNoteOf(p)} ${p.baseUrl}`))) {
          const existing = installed.find((p) => p.presetId === preset.id);
          s.add(addTile({
            icon: preset.icon, name: preset.name, note: presetNoteOf(preset),
            action: existing ? badge(t("added"), "green") : null,
            onClick: () => { closeModal(); existing ? openProviderDetail(existing) : openPresetForm(preset); },
          }));
        }
        const custom = (presets || []).find((p) => p.id === "custom");
        if (custom && hit(`${custom.name} ${custom.baseUrl}`)) {
          s.add(addTile({
            icon: "generic.svg", name: custom.name, note: t("anyCompatUrl"),
            onClick: () => { closeModal(); openPresetForm(custom); },
          }));
        }
        list.append(s.wrap());
      }

      // 4. relays
      {
        const s = section(t("relaysTitle"), t("relayHint"));
        for (const preset of (presets || []).filter((p) => presetKindOf(p.id) === "relay" && hit(`${p.name} ${presetNoteOf(p)} ${p.baseUrl}`))) {
          const existing = installed.find((p) => p.presetId === preset.id);
          s.add(addTile({
            icon: preset.icon, name: preset.name, note: presetNoteOf(preset),
            action: existing ? badge(t("added"), "green") : null,
            onClick: () => { closeModal(); existing ? openProviderDetail(existing) : openPresetForm(preset); },
          }));
        }
        if (s.grid.childElementCount) list.append(s.wrap());
      }

      if (!list.childElementCount) list.append(h("div", { class: "hm-empty", text: t("noResult") }));
    };
    search.addEventListener("input", draw);
    draw();
    body.append(search, list);
    openModal({ title: t("addProvider"), body, wide: true });
  }

  function presetKindOf(id) {
    if (id === "ollama") return "local";
    if (id === "openrouter" || id === "siliconflow" || id === "aihubmix" || id === "302ai" || id === "vercel-ai") return "relay";
    return "vendor";
  }

  const PRESET_NOTES_ZH = {
    openai: "官方 OpenAI API Key。",
    anthropic: "Anthropic 官方 API Key（不是 Claude 订阅）。",
    google: "Gemini 的 OpenAI 兼容接口。",
    deepseek: "DeepSeek 开放平台。",
    moonshot: "Moonshot AI（中国）。",
    zhipu: "智谱 AI 开放平台。",
    qwen: "阿里云百炼兼容模式。",
    xai: "xAI API Key。",
    groq: "GroqCloud API Key。",
    mistral: "Mistral La Plateforme。",
    openrouter: "一个 Key 接入多家模型，自动发现模型。",
    siliconflow: "硅基流动（中国）。",
    aihubmix: "一个 Key 接入多家模型。",
    "302ai": "一个 Key 接入多家模型。",
    "vercel-ai": "Vercel AI Gateway，一个 Key 接入多家模型。",
    ollama: "本机 Ollama，不需要 API Key。",
    custom: "任意 OpenAI 兼容接口。",
  };
  function presetNoteOf(p) {
    return lang() === "zh" ? (PRESET_NOTES_ZH[p.id] || p.note || "") : (p.note || "");
  }

  function openPresetForm(preset) {
    const isCustom = preset.id === "custom";
    const name = h("input", { class: "hm-input", value: isCustom ? "" : preset.name, placeholder: preset.name });
    const base = h("input", { class: "hm-input", value: preset.baseUrl || "", placeholder: "https://api.example.com/v1" });
    const api = h("select", { class: "hm-select" },
      ...["openai-completions", "anthropic-messages", "openai-responses", "google-generative-ai"].map((x) =>
        h("option", { value: x, selected: x === preset.api, text: x })),
    );
    const key = h("input", { class: "hm-input", type: "password", placeholder: t("keyPlaceholder") });
    const models = h("textarea", { class: "hm-textarea", placeholder: t("modelsPlaceholder") });
    models.value = (preset.models || []).join("\n");
    const body = h("div", { class: "hm-form" },
      h("div", { class: "hm-row2" },
        h("div", { class: "hm-field" }, h("label", { text: t("providerName") }), name),
        h("div", { class: "hm-field" }, h("label", { text: t("apiLabel") }), api),
      ),
      h("div", { class: "hm-field" }, h("label", { text: t("baseUrlLabel") }), base),
      preset.keyless ? h("div", { class: "hm-note", text: t("localProviderNote") })
        : h("div", { class: "hm-field" }, h("label", { text: t("keyLabel") }), key, h("div", { class: "hint", text: t("keyPlaceholder") })),
      h("div", { class: "hm-field" }, h("label", { text: t("modelsLabel") }), models),
    );
    openModal({
      title: isCustom ? t("custom") : preset.name,
      sub: presetNoteOf(preset), body,
      footer: [
        actionButton(t("cancel"), closeModal),
        actionButton(t("save"), async (e) => {
          const lines = models.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
          try {
            await withBusy(e.currentTarget, async () => {
              const r = await api("providers/add", {
                method: "POST",
                body: {
                  presetId: preset.id,
                  name: name.value.trim() || preset.name,
                  baseUrl: base.value.trim(),
                  api: api.value,
                  apiKey: key.value,
                  models: lines,
                  fetchModels: !isCustom || lines.length === 0,
                },
              });
              closeModal();
              await reloadView();
              if (r?.provider) await openProviderDetail({ id: r.provider.id, kind: "builtin" });
            });
            toast(t("providerAdded"), "ok");
          } catch (err) { toast(err.message, "err"); }
        }, "primary"),
      ],
    });
  }

  function openAddKey(p) {
    const key = h("input", { class: "hm-input", type: "password", placeholder: t("keyPlaceholder") });
    const name = h("input", { class: "hm-input", placeholder: t("defaultAccount") });
    openModal({
      title: `${t("addKey")} · ${p.name}`,
      body: h("div", { class: "hm-form" },
        h("div", { class: "hm-field" }, h("label", { text: t("keyLabel") }), key),
        h("div", { class: "hm-field" }, h("label", { text: t("providerName") }), name),
        p.keyless ? h("div", { class: "hm-note", text: t("localProviderNote") }) : null,
      ),
      footer: [
        actionButton(t("cancel"), closeModal),
        actionButton(t("save"), async (e) => {
          try {
            await withBusy(e.currentTarget, async () => {
              await api("accounts/add", { method: "POST", body: { provider: p.id, name: name.value.trim() || undefined, apiKey: key.value } });
            });
            closeModal(); toast(t("saved"), "ok"); await reloadView(); await openProviderDetail(p);
          } catch (err) { toast(err.message, "err"); }
        }, "primary"),
      ],
    });
  }

  async function openProviderDetail(p) {
    let detail;
    try { detail = await api(`providers/detail?id=${encodeURIComponent(p.id)}&kind=${encodeURIComponent(p.kind)}`); }
    catch (err) { toast(err.message, "err"); return; }
    const agents = agentsUsingProvider(p);
    const usageBox = h("div", { class: "hm-note", text: t("refreshQuotas") });
    const body = h("div", { style: "display:flex;flex-direction:column;gap:12px" });

    const head = h("div", { class: "hm-wrap" },
      providerIcon(detail.icon || "generic.svg"),
      badge(detail.kind === "plugin" ? t("pluginKind") : t("builtin"), "line"),
      detail.off ? badge(t("providerDisabled"), "amber") : badge(t("providerEnabled"), "green"),
      h("span", { class: "grow" }),
      actionButton(detail.off ? t("enableProvider") : t("disableProvider"), async () => {
        try {
          await api("providers/toggle", { method: "POST", body: { id: detail.id, kind: detail.kind, off: !detail.off } });
          closeModal(); await reloadView();
        } catch (err) { toast(err.message, "err"); }
      }, "small ghost"),
      providerSwitch(!detail.off, async (off) => {
        await api("providers/toggle", { method: "POST", body: { id: detail.id, kind: detail.kind, off } });
        closeModal(); await reloadView();
      }),
    );
    body.append(head);

    if (agents.length) {
      const chips = h("div", { class: "hm-wrap" });
      for (const a of agents) {
        chips.append(h("button", {
          type: "button", class: "hm-badge accent", style: "cursor:pointer",
          onclick: () => openAgentModelPicker(a),
          text: `${a.name} · ${a.modelName || ""}`,
        }));
      }
      body.append(h("div", { class: "hm-note", text: `正在使用：` }), chips);
    }

    // accounts
    const accHead = h("div", { class: "hm-wrap" },
      h("h3", { text: t("accountsTitle") }),
      h("span", { class: "grow" }),
      actionButton(detail.kind === "plugin" ? t("addAccount") : t("addKey"), () => {
        closeModal();
        if (detail.kind === "plugin") openPluginSignIn(detail, { newAccount: true, returnToDetail: true });
        else openAddKey(detail);
      }, "small primary"),
    );
    const accBox = h("div", { class: "hm-choice" });
    if (!detail.accounts.length) accBox.append(h("div", { class: "hm-empty", text: t("noAccounts") }));
    for (const a of detail.accounts) {
      const acts = h("div", { class: "hm-row-actions" });
      if (detail.kind === "plugin") {
        acts.append(actionButton(t("usageBtn"), () => openPluginUsage(detail, a.id), "small"));
        acts.append(actionButton(t("signOut"), async () => {
          try {
            await api("provider/signout", { method: "POST", body: { provider: detail.id, account: a.id } });
            closeModal(); await reloadView(); await openProviderDetail(detail);
          } catch (err) { toast(err.message, "err"); }
        }, "small ghost"));
      } else {
        acts.append(actionButton(a.disabled ? t("enable") : t("disable"), async () => {
          try {
            await api("accounts/disable", { method: "POST", body: { provider: detail.id, account: a.id, disabled: !a.disabled } });
            closeModal(); await reloadView(); await openProviderDetail(detail);
          } catch (err) { toast(err.message, "err"); }
        }, "small ghost"));
        acts.append(actionButton(t("remove"), () => {
          confirmModal(t("remove"), t("confirmRemoveProvider"), async () => {
            await api("accounts/remove", { method: "POST", body: { provider: detail.id, account: a.id } });
            closeModal(); await reloadView(); await openProviderDetail(detail);
          }, true);
        }, "small ghost danger"));
      }
      accBox.append(h("div", { class: "row" },
        h("div", { class: "who" },
          h("div", { class: "name", text: a.name || a.id }),
          h("div", { class: "sub", text: [a.disabled ? t("providerDisabled") : (a.hasKey ? t("signedIn") : t("needsKey")), a.plan || ""].filter(Boolean).join(" · ") }),
        ),
        acts,
      ));
    }
    body.append(h("div", { class: "hm-card" }, accHead, accBox));

    // models
    const modelBox = h("div", { class: "hm-choice" });
    const modelChecks = new Map();
    let modelsDirty = false;
    const markModelsDirty = () => {
      modelsDirty = true;
      saveModelsBtn.disabled = false;
      saveModelsBtn.classList.add("hm-unsaved");
    };
    const saveModelsBtn = actionButton(t("save"), async (e) => {
      if (!modelsDirty) return;
      const states = detail.models.map((m) => ({ id: m.id, off: !!m.off }));
      try {
        await withBusy(e.currentTarget, () => api("providers/models/bulk", {
          method: "POST",
          body: { id: detail.id, kind: detail.kind, states },
        }));
        modelsDirty = false;
        saveModelsBtn.disabled = true;
        saveModelsBtn.classList.remove("hm-unsaved");
        // Update the row immediately from the local selection, then refresh
        // the full snapshot in the background for the Agents model picker.
        const local = (S.state.providers || []).find((p) => p.id === detail.id && p.kind === detail.kind);
        if (local) {
          local.models = detail.models.length;
          local.modelsOn = detail.models.filter((m) => !m.off).length;
        }
        if (S.view === "providers") await render();
        await loadState();
        if (S.view === "providers") await render();
        toast(t("saved"), "ok");
      } catch (err) { toast(err.message, "err"); }
    }, "small primary");
    saveModelsBtn.disabled = true;
    const stageModels = (mode) => {
      if (!detail.models.length) return;
      for (const m of detail.models) {
        if (mode === "invert") m.off = !m.off;
        else m.off = mode === "off";
        const cb = modelChecks.get(m.id);
        if (cb) cb.checked = !m.off;
      }
      markModelsDirty();
    };
    if (!detail.models.length) modelBox.append(h("div", { class: "hm-empty", text: t("noModels") }));
    for (const m of detail.models) {
      const cb = h("input", {
        type: "checkbox", checked: !m.off,
        onchange: (e) => {
          // Stage the edit; nothing is written to HanaAgent until Save.
          m.off = !e.target.checked;
          markModelsDirty();
        },
      });
      modelChecks.set(m.id, cb);
      modelBox.append(h("label", { class: "row", style: "cursor:pointer" },
        cb,
        h("div", { class: "who" },
          h("div", { class: "name", text: m.name || m.id }),
          h("div", { class: "sub", text: [m.id, m.api, m.context ? `${fmtNum(m.context)} ctx` : ""].filter(Boolean).join(" · ") }),
        ),
      ));
    }
    body.append(h("div", { class: "hm-card" },
      h("div", { class: "hm-wrap" },
        h("h3", { text: t("modelsTitle") }),
        h("span", { class: "grow" }),
        actionButton(t("selectAll"), () => stageModels("on"), "small ghost"),
        actionButton(t("invert"), () => stageModels("invert"), "small ghost"),
        saveModelsBtn,
        actionButton(t("refreshModels"), async (e) => {
          try {
            await withBusy(e.currentTarget, () => api("providers/refresh", { method: "POST", body: { id: detail.id, kind: detail.kind } }));
            closeModal(); await reloadView(); await openProviderDetail(detail);
          } catch (err) { toast(err.message, "err"); }
        }, "small"),
      ),
      h("div", { class: "hm-note", text: t("modelsSaveHint") }),
      modelBox,
    ));

    // settings
    if (detail.kind === "builtin") {
      const name = h("input", { class: "hm-input", value: detail.name });
      const base = h("input", { class: "hm-input", value: detail.baseUrl || "" });
      const api = h("select", { class: "hm-select" },
        ...["openai-completions", "anthropic-messages", "openai-responses", "google-generative-ai"].map((x) =>
          h("option", { value: x, selected: x === detail.api, text: x })),
      );
      body.append(h("div", { class: "hm-card" },
        h("h3", { text: t("settings") }),
        h("div", { class: "hm-row2" },
          h("div", { class: "hm-field" }, h("label", { text: t("providerName") }), name),
          h("div", { class: "hm-field" }, h("label", { text: t("apiLabel") }), api),
        ),
        h("div", { class: "hm-field" }, h("label", { text: t("baseUrlLabel") }), base),
        h("div", { class: "hm-wrap" },
          actionButton(t("saveProvider"), async (e) => {
            try {
              await withBusy(e.currentTarget, () => api("providers/update", { method: "POST", body: { id: detail.id, name: name.value.trim(), baseUrl: base.value.trim(), api: api.value } }));
              toast(t("saved"), "ok"); closeModal(); await reloadView();
            } catch (err) { toast(err.message, "err"); }
          }, "primary"),
        ),
      ));
    } else {
      body.append(h("div", { class: "hm-card" },
        h("h3", { text: t("providerInfo") }),
        h("div", { class: "hm-kv" },
          h("span", { class: "k", text: t("source") }), h("span", { class: "v hm-mono", text: detail.spec || detail.id }),
          h("span", { class: "k", text: t("baseUrl") }), h("span", { class: "v hm-mono", text: detail.baseUrl || "—" }),
          h("span", { class: "k", text: t("apiLabel") }), h("span", { class: "v hm-mono", text: detail.api || "—" }),
        ),
      ));
    }

    // quota windows
    body.append(h("div", { class: "hm-card" },
      h("div", { class: "hm-wrap" },
        h("h3", { text: t("providerUsage") }),
        h("span", { class: "grow" }),
        detail.kind === "plugin" ? actionButton(t("refreshQuotas"), async () => {
          usageBox.replaceChildren(h("div", { class: "hm-loading" }, h("span", { class: "hm-spinner" }), t("loading")));
          const rows = [];
          for (const a of detail.accounts) {
            try {
              const u = await api("provider/usage", { method: "POST", body: { provider: detail.id, account: a.id } });
              rows.push(h("div", { style: "display:flex;flex-direction:column;gap:6px" },
                h("b", { text: a.name || a.id }),
                u.plan ? h("div", { class: "hm-note", text: u.plan }) : null,
                u.error ? h("div", { class: "hm-note hm-danger-text", text: u.error }) : null,
                ...(u.windows || []).map((w) => quotaWindow(w)),
              ));
            } catch (err) {
              rows.push(h("div", { class: "hm-note hm-danger-text", text: `${a.name || a.id}: ${err.message}` }));
            }
          }
          usageBox.replaceChildren(...(rows.length ? rows : [h("div", { class: "hm-note", text: t("noUsage") })]));
        }, "small") : null,
      ),
      detail.kind === "plugin" ? usageBox : h("div", { class: "hm-note", text: t("usageOnlyPlugin") }),
    ));

    const footer = [
      actionButton(t("test"), async (e) => {
        try {
          await withBusy(e.currentTarget, async () => {
            const r = await api("providers/test", { method: "POST", body: { id: detail.id, kind: detail.kind } });
            if (!r.ok) throw new Error(r.error || t("testFailed"));
            toast(`${t("testOK")} · ${r.model} · ${fmtMs(r.ms)}`, "ok");
          });
        } catch (err) { toast(err.message, "err"); }
      }),
      actionButton(t("close"), closeModal),
    ];
    footer.push(actionButton(t("removeProvider"), () => {
      closeModal();
      const message = detail.kind === "plugin" ? t("confirmRemovePluginProvider") : t("confirmRemoveProvider");
      confirmModal(t("removeProvider"), message, async () => {
        await api("providers/remove", { method: "POST", body: { id: detail.id, kind: detail.kind } });
        toast(t("removed"), "ok"); await reloadView();
      }, true);
    }, "danger"));
    openModal({ title: detail.name, sub: detail.kind === "plugin" ? detail.spec : detail.baseUrl, body, footer, wide: true });
  }

  async function removeAccount(p, a) {
    try {
      await api("accounts/remove", { method: "POST", body: { provider: p.id, account: a.id } });
      closeModal(); toast(t("removed"), "ok"); await reloadView();
    } catch (err) { toast(err.message, "err"); }
  }

  // ---- plugin provider sign-in --------------------------------------------

  function openPluginSignIn(p, options = {}) {
    const methods = p.methods || [];
    if (!methods.length) {
      toast("这个插件没有提供登录方式，请查看插件诊断。", "err");
      return;
    }
    const methodSel = methods.length > 1
      ? h("select", { class: "hm-select" }, ...methods.map((m, i) => h("option", { value: String(i), text: m.label || `${m.type} ${i + 1}` })))
      : null;
    const form = h("div", { class: "hm-form" });
    const keyInput = h("input", { class: "hm-input", type: "password", placeholder: methods[0].placeholder || t("keyPlaceholder") });
    const promptInputs = new Map();
    const draw = () => {
      form.replaceChildren();
      const idx = methodSel ? Number(methodSel.value) : 0;
      const m = methods[idx];
      if (m.type === "api") {
        form.append(h("div", { class: "hm-field" }, h("label", { text: m.label || t("keyLabel") }), keyInput));
      }
      if (m.type === "oauth") {
        form.append(h("div", { class: "hm-note", text: m.label || t("signInTitle") }));
      }
      for (const prompt of m.prompts || []) {
        const input = prompt.type === "select"
          ? h("select", { class: "hm-select" }, ...(prompt.options || []).map((o) => h("option", { value: o.value, text: o.label })))
          : h("input", { class: "hm-input", type: prompt.type === "password" ? "password" : "text", placeholder: prompt.placeholder || "" });
        promptInputs.set(prompt.key, input);
        form.append(h("div", { class: "hm-field" }, h("label", { text: prompt.message || prompt.key }), input));
      }
      form.append(h("div", { class: "hm-note", text: t("signInHint") }));
    };
    if (methodSel) methodSel.addEventListener("change", draw);
    draw();
    const body = h("div", { class: "hm-form" }, methodSel || null, form);
    const footer = [actionButton(t("cancel"), closeModal)];
    footer.push(actionButton(t("signIn"), async (e) => {
      const idx = methodSel ? Number(methodSel.value) : 0;
      const m = methods[idx];
      const inputs = {};
      for (const [k, v] of promptInputs) if (v.value) inputs[k] = v.value;
      try {
        await withBusy(e.currentTarget, async () => {
          if (m.type === "oauth") {
            const start = await api("provider/oauth/start", { method: "POST", body: { provider: p.id, method: idx, inputs, account: options.newAccount ? "new" : undefined } });
            if (start?.url) {
              try { window.open(start.url, "_blank", "noopener"); } catch {}
            }
            closeModal();
            openOAuthFinish(p, start);
            return;
          }
          const r = await api("provider/signin", { method: "POST", body: { provider: p.id, method: idx, key: keyInput.value, inputs, account: options.newAccount ? "new" : undefined } });
          if (!r?.ok) throw new Error(r?.error || "登录失败");
          closeModal();
          toast(t("saved"), "ok");
          await reloadView();
          if (options.returnToDetail) await openProviderDetail(p);
        });
      } catch (err) { toast(err.message, "err"); }
    }, "primary"));
    openModal({ title: `${t("signInTitle")} · ${p.name}`, body, footer, wide: true });
  }

  function openOAuthFinish(p, start) {
    const instructions = h("div", { class: "hm-note", text: start?.instructions || "" });
    const url = start?.url ? h("div", { class: "hm-code", text: start.url }) : null;
    const code = h("input", { class: "hm-input", placeholder: t("oauthCode") });
    const body = h("div", { class: "hm-form" },
      instructions,
      url,
      start?.method === "code" ? h("div", { class: "hm-field" }, h("label", { text: t("oauthCode") }), code) : null,
      h("div", { class: "hm-note", text: t("signInHint") }),
    );
    openModal({
      title: `${t("signInTitle")} · ${p.name}`, body,
      footer: [
        actionButton(t("cancel"), closeModal),
        actionButton(t("finish"), async (e) => {
          try {
            await withBusy(e.currentTarget, async () => {
              const r = await api("provider/oauth/callback", { method: "POST", body: { session: start.session, code: code.value } });
              if (!r?.ok) throw new Error(r?.error || "sign-in failed");
            });
            closeModal(); toast(t("saved"), "ok"); await reloadView();
          } catch (err) { toast(err.message, "err"); }
        }, "primary"),
      ],
    });
  }

  async function openPluginUsage(p, account) {
    const body = h("div", { class: "hm-loading" }, h("span", { class: "hm-spinner" }), t("loading"));
    openModal({ title: `${t("usageBtn")} · ${p.name}`, body });
    try {
      const accounts = (S.state.providers.find((x) => x.id === p.id)?.accounts || []);
      const rows = [];
      for (const a of accounts) {
        if (account && (a.account || a.id) !== account) continue;
        const u = await api("provider/usage", { method: "POST", body: { provider: p.id, account: a.account || a.id } });
        rows.push(h("div", { class: "hm-card" },
          h("h3", { text: a.name || a.account || a.id }),
          u.plan ? h("div", { class: "hm-note", text: `${u.plan}${u.user ? " · " + u.user : ""}` }) : null,
          u.error ? h("div", { class: "hm-note hm-danger-text", text: u.error }) : null,
          ...(u.windows || []).map((w) => quotaWindow(w)),
        ));
      }
      if (!rows.length) rows.push(h("div", { class: "hm-note", text: t("noUsage") }));
      $("#dialog .hm-dialog-body").replaceChildren(h("div", { style: "display:flex;flex-direction:column;gap:10px" }, ...rows));
    } catch (err) {
      $("#dialog .hm-dialog-body").replaceChildren(h("div", { class: "hm-note hm-danger-text", text: err.message }));
    }
  }

  function quotaWindow(w) {
    const used = Math.max(0, Math.min(100, Number(w.used) || 0));
    const reset = w.resetsAt || w.resetSecs ? (w.resetsAt ? new Date(w.resetsAt).toLocaleString() : `${Math.round(w.resetSecs / 60)}m`) : "";
    return h("div", { class: "hm-card" },
      h("div", { class: "hm-wrap" }, h("b", { text: w.name || t("quota") }), h("span", { class: "hm-muted hm-right", text: `${used.toFixed(0)}%` })),
      h("div", { style: "height:6px;border-radius:4px;background:var(--pill);overflow:hidden" },
        h("div", { style: `height:100%;width:${used}%;background:${used > 90 ? "var(--red)" : used > 70 ? "var(--amber)" : "var(--accent)"}` })),
      h("div", { class: "hm-note", text: [w.display, reset ? `↻ ${reset}` : ""].filter(Boolean).join(" · ") }),
    );
  }

  // ---- routing -------------------------------------------------------------

  async function renderRouting() {
    const s = S.state;
    setActions([actionButton(t("add"), () => openGroupForm(), "primary")]);
    if (!s.groups.length) {
      $("#view").replaceChildren(h("div", { class: "hm-empty" }, h("b", { text: t("routing") }), t("noGroups")));
      return;
    }
    const list = h("div", { class: "list" });
    for (const g of s.groups) {
      list.append(h("div", { class: "row" },
        providerIcon(g.providerIcon),
        h("div", { class: "who" },
          h("div", { class: "name", text: g.name }),
          h("div", { class: "sub", text: `${g.members.map((m) => `${m.providerName} · ${m.name}`).join("  →  ")}` }),
        ),
        badge(g.routing === "round-robin" ? t("roundRobin") : g.routing === "ordered" ? t("ordered") : t("smart")),
        h("div", { class: "hm-row-actions" },
          actionButton(t("edit"), () => openGroupForm(g), "small"),
          actionButton(t("delete"), () => confirmModal(t("delete"), t("confirmRemoveGroup"), async () => {
            await api("groups/remove", { method: "POST", body: { id: g.groupId } });
            toast(t("removed"), "ok"); await reloadView();
          }, true), "small ghost danger"),
        ),
      ));
    }
    $("#view").replaceChildren(
      h("div", { class: "hm-note", text: t("routingSub") }),
      list,
      h("div", { class: "hm-note", text: "HanaAgent 会看到路由组作为一个模型；成员必须使用同一种接口（例如都为 Chat Completions）。" }),
    );
  }

  function openGroupForm(group) {
    const name = h("input", { class: "hm-input", value: group?.name || "" });
    const routing = h("select", { class: "hm-select" },
      h("option", { value: "smart", text: t("smart"), selected: (group?.routing || "smart") === "smart" }),
      h("option", { value: "round-robin", text: t("roundRobin"), selected: group?.routing === "round-robin" }),
      h("option", { value: "ordered", text: t("ordered"), selected: group?.routing === "ordered" }),
    );
    const picked = new Set(group?.members?.map((m) => m.ref) || []);
    const choice = h("div", { class: "hm-choice" });
    for (const m of S.state.models.filter((x) => x.kind !== "group")) {
      choice.append(h("label", { class: "row", style: "cursor:pointer" },
        h("input", { type: "checkbox", checked: picked.has(m.ref), onchange: (e) => { if (e.target.checked) picked.add(m.ref); else picked.delete(m.ref); } }),
        providerIcon(m.providerIcon),
        h("div", { class: "who" }, h("div", { class: "name", text: m.name }), h("div", { class: "sub", text: `${m.providerName} · ${m.api}` })),
      ));
    }
    openModal({
      title: group ? `${t("edit")} · ${group.name}` : t("routing"), wide: true,
      body: h("div", { class: "hm-form" },
        h("div", { class: "hm-row2" },
          h("div", { class: "hm-field" }, h("label", { text: t("groupName") }), name),
          h("div", { class: "hm-field" }, h("label", { text: t("groupRouting") }), routing),
        ),
        h("div", { class: "hm-field" }, h("label", { text: t("groupModels") }), choice),
      ),
      footer: [
        actionButton(t("cancel"), closeModal),
        actionButton(t("save"), async (e) => {
          try {
            await withBusy(e.currentTarget, () => api("groups/save", {
              method: "POST",
              body: { id: group?.groupId, name: name.value.trim(), routing: routing.value, models: [...picked] },
            }));
            closeModal(); toast(t("saved"), "ok"); await reloadView();
          } catch (err) { toast(err.message, "err"); }
        }, "primary"),
      ],
    });
  }

  // ---- gateway -------------------------------------------------------------

  async function renderGateway() {
    const s = S.state;
    const gw = s.gateway;
    setActions([
      actionButton(t("restart"), async (e) => {
        try {
          await withBusy(e.currentTarget, () => api("gateway/restart", { method: "POST", body: {} }));
          toast(t("saved"), "ok"); await reloadView();
        } catch (err) { toast(err.message, "err"); }
      }),
      actionButton(t("refresh"), () => reloadView(), "ghost"),
    ]);
    const keyValue = h("span", { class: "v hm-mono", text: s.gatewayKeyMasked || "—" });
    const keyBtn = actionButton(t("reveal"), async (e) => {
      try {
        const info = await api("gateway?key=1");
        keyValue.textContent = info.gatewayKey || "—";
        e.currentTarget.remove();
      } catch (err) { toast(err.message, "err"); }
    }, "small");
    const card = h("div", { class: "hm-card" },
      h("div", { class: "hm-wrap" },
        badge(gw.running ? t("gatewayRunning") : t("gatewayStopped"), gw.running ? "green" : "red"),
        h("span", { class: "hm-muted", text: t("localOnly") }),
        h("span", { class: "hm-right hm-muted", text: `:${gw.port}` }),
      ),
      h("div", { class: "hm-kv" },
        h("span", { class: "k", text: t("baseUrl") }), h("span", { class: "v hm-mono", text: gw.baseUrl }),
        h("span", { class: "k", text: "OpenAI / Anthropic" }), h("span", { class: "v hm-mono", text: `${gw.baseUrl}/v1` }),
        h("span", { class: "k", text: t("gatewayKey") }), h("span", { class: "v" }, keyValue, keyBtn),
      ),
      h("div", { class: "hm-note", text: t("gatewayHint") }),
      h("div", { class: "hm-wrap" },
        actionButton(t("copy") + " " + t("baseUrl"), async () => { await copy(gw.baseUrl); }),
        actionButton(t("copy") + " " + t("gatewayKey"), async () => {
          try { const info = await api("gateway?key=1"); await copy(info.gatewayKey); } catch (err) { toast(err.message, "err"); }
        }),
        actionButton(t("regenerate"), async () => {
          confirmModal(t("regenerate"), t("revealKeyHint"), async () => {
            await api("gateway/key", { method: "POST", body: {} });
            toast(t("saved"), "ok"); await reloadView();
          });
        }, "ghost"),
      ),
    );
    const stats = h("div", { class: "hm-grid" },
      stat(t("modelsStat"), String(s.models.length), `${s.providers.length} providers`),
      stat(t("calls"), fmtNum(s.stats.requests), t("all")),
      stat(t("inputTokens") + " / " + t("outputTokens"), `${fmtNum(s.stats.inputTokens)} / ${fmtNum(s.stats.outputTokens)}`, ""),
      stat(t("cost"), fmtCost(s.stats.cost), ""),
    );
    const sync = h("div", { class: "hm-card" },
      h("h3", { text: t("syncProvider") }),
      h("div", { class: "hm-kv" },
        h("span", { class: "k", text: t("providerLabel") }), h("span", { class: "v hm-mono", text: "hana-magpie" }),
        h("span", { class: "k", text: "HanaAgent" }), h("span", { class: "v" }, s.hana.online ? badge(`${s.hana.version || ""} :${s.hana.port}`, "green") : badge("离线", "red")),
        h("span", { class: "k", text: t("modelsShort") }), h("span", { class: "v", text: `${s.hana.providerModels ?? 0}` }),
        h("span", { class: "k", text: t("lastSync") || "last sync" }), h("span", { class: "v", text: s.lastSync?.at ? `${fmtTime(s.lastSync.at)} · ${s.lastSync.ok ? t("syncOK") : s.lastSync.error || t("syncFailed")}` : "—" }),
      ),
      h("div", { class: "hm-wrap" },
        actionButton(t("syncProvider"), async (e) => {
          try { await withBusy(e.currentTarget, () => api("sync", { method: "POST", body: {} })); toast(t("syncOK"), "ok"); await reloadView(); } catch (err) { toast(err.message, "err"); }
        }, "primary"),
        actionButton(t("logs"), () => openLogs()),
      ),
    );
    $("#view").replaceChildren(card, stats, sync);
  }

  function stat(k, v, s) {
    return h("div", { class: "hm-stat" }, h("div", { class: "k", text: k }), h("div", { class: "v", text: v }), s ? h("div", { class: "s", text: s }) : null);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t("copied"), "ok");
    } catch {
      const ta = h("textarea", { style: "position:fixed;opacity:0" });
      ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand("copy"); toast(t("copied"), "ok"); } catch { toast(text); }
      ta.remove();
    }
  }

  async function openLogs() {
    const body = h("div", { class: "hm-loading" }, h("span", { class: "hm-spinner" }), t("loading"));
    openModal({ title: t("logs"), body, wide: true });
    try {
      const data = await api("logs?limit=400");
      const pre = h("pre", { class: "hm-code", style: "white-space:pre-wrap;max-height:60vh;overflow:auto;user-select:text", text: data.lines.join("\n") || t("noLogs") });
      $("#dialog .hm-dialog-body").replaceChildren(pre);
    } catch (err) {
      $("#dialog .hm-dialog-body").replaceChildren(h("div", { class: "hm-note hm-danger-text", text: err.message }));
    }
  }

  // ---- usage ---------------------------------------------------------------

  async function renderUsage() {
    setActions([
      h("div", { class: "hm-tabs" },
        ...["today", "7d", "30d"].map((p) => h("button", {
          type: "button", class: S.usagePeriod === p ? "on" : "",
          text: p === "today" ? t("today") : p === "7d" ? t("last7") : t("last30"),
          onclick: () => { S.usagePeriod = p; S.usage = null; renderUsage(); },
        })),
      ),
      actionButton(t("refresh"), () => { S.usage = null; renderUsage(); }),
    ]);
    if (!S.usage) {
      $("#view").replaceChildren(h("div", { class: "hm-loading" }, h("span", { class: "hm-spinner" }), t("loading")));
      try { S.usage = await api(`usage?period=${encodeURIComponent(S.usagePeriod)}`); } catch (err) {
        $("#view").replaceChildren(h("div", { class: "hm-empty", text: err.message })); return;
      }
    }
    const u = S.usage;
    const cards = h("div", { class: "hm-grid" },
      stat(t("calls"), fmtNum(u.totals.calls), `${u.totals.errors} ${t("errors")}`),
      stat(t("inputTokens"), fmtNum(u.totals.input), ""),
      stat(t("outputTokens"), fmtNum(u.totals.output), ""),
      stat(t("cost"), fmtCost(u.totals.cost), `${t("avgLatency")} ${fmtMs(u.totals.avgMs)}`),
    );
    const table = (rows, label) => rows.length ? h("div", { class: "hm-card" },
      h("h3", { text: label }),
      h("table", { class: "hm-table" },
        h("thead", {}, h("tr", {}, h("th", { text: label }), h("th", { class: "num", text: t("calls") }), h("th", { class: "num", text: "输入/输出" }), h("th", { class: "num", text: t("cost") }))),
        h("tbody", {}, ...rows.map((r) => h("tr", {},
          h("td", { text: r.label }),
          h("td", { class: "num", text: fmtNum(r.calls) }),
          h("td", { class: "num", text: `${fmtNum(r.input)} / ${fmtNum(r.output)}` }),
          h("td", { class: "num", text: fmtCost(r.cost) }),
        ))),
      ),
    ) : null;
    const recent = h("div", { class: "hm-card" },
      h("h3", { text: t("recent") }),
      u.recent.length ? h("table", { class: "hm-table" },
        h("thead", {}, h("tr", {}, h("th", { text: t("time") }), h("th", { text: t("model") }), h("th", { text: t("status") }), h("th", { class: "num", text: t("tokens") }), h("th", { class: "num", text: t("latency") }))),
        h("tbody", {}, ...u.recent.slice(0, 40).map((r) => h("tr", {},
          h("td", { class: "muted", text: fmtTime(r.at) }),
          h("td", { text: `${r.providerName || r.provider} · ${r.modelName || r.model}` }),
          h("td", { text: String(r.status) }),
          h("td", { class: "num", text: `${fmtNum(r.input)}/${fmtNum(r.output)}` }),
          h("td", { class: "num", text: fmtMs(r.ms) }),
        ))),
      ) : h("div", { class: "hm-note", text: t("noUsage") }),
    );
    const quotaCard = h("div", { class: "hm-card" },
      h("div", { class: "hm-wrap" }, h("h3", { text: t("quotas") }), actionButton(t("refreshQuotas"), () => loadQuotas(), "small hm-right")),
      h("div", { id: "quotaBox" }, S.quotas ? quotaBody(S.quotas) : h("div", { class: "hm-note", text: t("refreshQuotas") })),
    );
    $("#view").replaceChildren(cards, table(u.providers, t("byProvider")), table(u.models, t("byModel")), quotaCard, recent);
  }

  async function loadQuotas() {
    const box = $("#quotaBox");
    if (!box) return;
    box.replaceChildren(h("div", { class: "hm-loading" }, h("span", { class: "hm-spinner" }), t("loading")));
    try {
      S.quotas = (await api("quotas")).quotas;
      box.replaceChildren(quotaBody(S.quotas));
    } catch (err) {
      box.replaceChildren(h("div", { class: "hm-note hm-danger-text", text: err.message }));
    }
  }

  function quotaBody(quotas) {
    const rows = [];
    for (const p of quotas) {
      for (const a of p.accounts || []) {
        if (!a.windows?.length && !a.error) continue;
        rows.push(h("div", { class: "hm-card" },
          h("div", { class: "hm-wrap" }, h("b", { text: `${p.name} · ${a.name || a.account}` }), a.plan ? badge(a.plan, "accent") : null),
          a.error ? h("div", { class: "hm-note hm-danger-text", text: a.error }) : null,
          ...(a.windows || []).map((w) => quotaWindow(w)),
        ));
      }
    }
    return rows.length ? h("div", { style: "display:flex;flex-direction:column;gap:9px" }, ...rows) : h("div", { class: "hm-note", text: t("noUsage") });
  }

  // ---- plugins -------------------------------------------------------------

  async function renderPlugins() {
    const s = S.state;
    setActions([
      actionButton(t("add"), () => openAddPlugin(), "primary"),
      actionButton(t("refresh"), () => reloadView(), "ghost"),
    ]);
    const installed = h("div", { class: "list" });
    for (const p of s.plugins) {
      installed.append(h("div", { class: `row ${p.off ? "off" : ""}` },
        providerIcon("generic.svg"),
        h("div", { class: "who" },
          h("div", { class: "hm-name-line" },
            h("span", { class: "name", text: p.name || p.spec }),
            p.version ? badge(`v${p.version}`, "line") : null,
            p.off ? badge(t("disable"), "amber") : badge(t("enable"), "green"),
            p.provides?.length ? badge(p.provides.join(", "), "accent") : null,
          ),
          h("div", { class: "sub", text: `${p.source} · ${p.spec}` }),
        ),
        h("div", { class: "hm-row-actions" },
          actionButton(p.off ? t("enable") : t("disable"), async (e) => {
            await withBusy(e.currentTarget, () => api("plugins/toggle", { method: "POST", body: { spec: p.spec, off: !p.off } }));
            toast(t("pluginToggled"), "ok"); await reloadView();
          }, "small"),
          actionButton(t("options"), () => openPluginOptions(p), "small ghost"),
          p.source === "npm" ? actionButton(t("update"), async (e) => {
            await withBusy(e.currentTarget, () => api("plugins/update", { method: "POST", body: { spec: p.spec } }));
            toast(t("saved"), "ok"); await reloadView();
          }, "small ghost") : null,
          actionButton(t("remove"), () => confirmModal(t("remove"), t("confirmRemovePlugin"), async () => {
            await api("plugins/remove", { method: "POST", body: { spec: p.spec } });
            toast(t("pluginRemoved"), "ok"); await reloadView();
          }, true), "small ghost danger"),
        ),
      ));
    }
    if (!s.plugins.length) installed.append(h("div", { class: "hm-empty", text: t("noPlugins") }));

    const marketItems = (S.market?.plugins || []).map((m) => {
      const installedAlready = s.plugins.some((p) => p.spec === m.package);
      return h("div", { class: "hm-card" },
        h("div", { class: "hm-wrap" },
          providerIcon(m.icon || "generic.svg"),
          h("b", { text: m.name || m.package }),
          badge(m.kind === "middleware" ? t("middlewareKind") : t("marketProvider"), "line"),
          h("span", { class: "hm-right" }, installedAlready ? badge(t("installed"), "green") : actionButton(t("install"), (e) => installPlugin(m.package, e), "small primary")),
        ),
        h("div", { class: "hm-note", text: m.summary?.[lang()] || m.summary?.en || m.package }),
        h("div", { class: "hm-note hm-mono", text: m.package }),
      );
    });
    $("#view").replaceChildren(
      h("div", { class: "hm-note", text: t("pluginsSub") }),
      installed,
      h("div", { class: "hm-note", text: t("market") }),
      h("div", { class: "hm-grid" }, ...(marketItems.length ? marketItems : [h("div", { class: "hm-note", text: t("noPlugins") })])),
    );
  }

  function openPluginOptions(p) {
    const ta = h("textarea", { class: "hm-textarea", placeholder: "{}" });
    ta.value = JSON.stringify(p.options || {}, null, 2);
    openModal({
      title: `${t("options")} · ${p.name || p.spec}`, wide: true,
      body: h("div", { class: "hm-form" },
        h("div", { class: "hm-note", text: t("optionsNote") }),
        ta,
      ),
      footer: [
        actionButton(t("cancel"), closeModal),
        actionButton(t("save"), async (e) => {
          let parsed;
          try { parsed = ta.value.trim() ? JSON.parse(ta.value) : {}; } catch (err) { toast(t("invalidJson") + err.message, "err"); return; }
          try {
            await withBusy(e.currentTarget, () => api("plugins/options", { method: "POST", body: { spec: p.spec, options: parsed } }));
            closeModal(); toast(t("saved"), "ok"); await reloadView();
          } catch (err) { toast(err.message, "err"); }
        }, "primary"),
      ],
    });
  }

  function openAddPlugin() {
    const tabBar = h("div", { class: "hm-tabs" });
    const body = h("div", { class: "hm-form" });
    let tab = "market";
    const draw = () => {
      tabBar.replaceChildren(
        h("button", { type: "button", class: tab === "market" ? "on" : "", text: t("market"), onclick: () => { tab = "market"; draw(); } }),
        h("button", { type: "button", class: tab === "npm" ? "on" : "", text: t("npm"), onclick: () => { tab = "npm"; draw(); } }),
        h("button", { type: "button", class: tab === "other" ? "on" : "", text: t("addFrom"), onclick: () => { tab = "other"; draw(); } }),
      );
      body.replaceChildren();
      if (tab === "market") {
        const grid = h("div", { class: "hm-grid" });
        const items = S.market?.plugins || [];
        for (const m of items) {
          const already = S.state.plugins.some((p) => p.spec === m.package);
          grid.append(h("div", { class: "hm-card" },
            h("div", { class: "hm-wrap" },
              providerIcon(m.icon || "generic.svg"),
              h("b", { text: m.name || m.package }),
              h("span", { class: "hm-right" }, already ? badge(t("installed"), "green") : actionButton(t("install"), (e) => installPlugin(m.package, e), "small primary")),
            ),
            h("div", { class: "hm-note", text: m.summary?.[lang()] || m.summary?.en || "" }),
            h("div", { class: "hm-note hm-mono", text: m.package }),
          ));
        }
        body.append(grid);
      } else if (tab === "npm") {
        const input = h("input", { class: "hm-input", placeholder: t("searchNpm") });
        const results = h("div", { class: "hm-choice" });
        const search = async () => {
          results.replaceChildren(h("div", { class: "hm-loading" }, h("span", { class: "hm-spinner" }), t("loading")));
          try {
            const data = await api(`plugins/search?q=${encodeURIComponent(input.value || "opencode-plugin")}`);
            results.replaceChildren();
            for (const p of data.npm || []) {
              results.append(h("div", { class: "row" },
                h("div", { class: "who" }, h("div", { class: "name", text: p.name }), h("div", { class: "sub", text: `${p.version} · ${p.description || ""}` })),
                h("div", { class: "hm-row-actions" }, actionButton(t("install"), (e) => installPlugin(p.name, e), "small primary")),
              ));
            }
            if (!results.childElementCount) results.append(h("div", { class: "hm-empty", text: t("noResults") }));
          } catch (err) { results.replaceChildren(h("div", { class: "hm-note hm-danger-text", text: err.message })); }
        };
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
        body.append(h("div", { class: "hm-wrap" }, input, actionButton(t("searchNpm") || "Search", search)), results);
        search();
      } else {
        const spec = h("input", { class: "hm-input", placeholder: t("specPlaceholder") });
        body.append(
          h("div", { class: "hm-field" },
            h("label", { text: t("addFrom") }),
            spec,
            h("div", { class: "hint", text: "npm: @scope/package · GitHub: owner/repo · folder: C:\\path\\to\\plugin" }),
          ),
          h("div", { class: "hm-note", text: t("folderNote") }),
        );
        body.append(actionButton(t("install"), (e) => installPlugin(spec.value.trim(), e), "primary"));
      }
    };
    draw();
    openModal({ title: t("add"), body: h("div", { class: "hm-form" }, tabBar, body), wide: true });
  }

  async function installPlugin(spec, ev) {
    if (!spec) return;
    try {
      await withBusy(ev?.currentTarget, async () => {
        await api("plugins/add", { method: "POST", body: { spec } });
      });
      closeModal();
      toast(t("pluginInstalled"), "ok");
      await reloadView();
    } catch (err) { toast(err.message, "err"); }
  }

  // ---- settings ------------------------------------------------------------

  async function renderSettings() {
    const s = S.state.settings;
    setActions([]);
    const port = h("input", { class: "hm-input", type: "number", value: s.port, min: "1024", max: "65535" });
    const language = h("select", { class: "hm-select" },
      h("option", { value: "zh", text: "中文", selected: s.language === "zh" }),
      h("option", { value: "en", text: "English", selected: s.language === "en" }),
    );
    const theme = h("select", { class: "hm-select" },
      h("option", { value: "auto", text: t("auto"), selected: s.theme === "auto" }),
      h("option", { value: "dark", text: "深色", selected: s.theme === "dark" }),
      h("option", { value: "light", text: "浅色", selected: s.theme === "light" }),
    );
    const proxy = h("input", { class: "hm-input", value: s.proxy || "", placeholder: "http://127.0.0.1:7890" });
    const registry = h("input", { class: "hm-input", value: s.registry || "", placeholder: t("registryHint") });
    const autoSync = h("input", { type: "checkbox", checked: s.autoSync !== false });
    const form = h("div", { class: "hm-card" },
      h("h3", { text: t("settings") }),
      h("div", { class: "hm-row2" },
        h("div", { class: "hm-field" }, h("label", { text: t("port") }), port, h("div", { class: "hint", text: t("portNote") })),
        h("div", { class: "hm-field" }, h("label", { text: t("language") }), language),
      ),
      h("div", { class: "hm-row2" },
        h("div", { class: "hm-field" }, h("label", { text: t("theme") }), theme),
        h("div", { class: "hm-field" }, h("label", { text: t("proxy") }), proxy, h("div", { class: "hint", text: t("proxyHint") })),
      ),
      h("div", { class: "hm-field" }, h("label", { text: t("registry") }), registry),
      h("label", { class: "hm-wrap", style: "font-size:12px;color:var(--fg-2)" }, autoSync, t("autoSync")),
      h("div", { class: "hm-wrap" }, actionButton(t("save"), async (e) => {
        try {
          await withBusy(e.currentTarget, () => api("settings", {
            method: "POST",
            body: { port: Number(port.value), language: language.value, theme: theme.value, proxy: proxy.value.trim(), registry: registry.value.trim(), autoSync: autoSync.checked },
          }));
          toast(t("settingsSaved"), "ok");
          await loadState(); applyStaticLanguage(); setHeader(); await renderSettings();
        } catch (err) { toast(err.message, "err"); }
      }, "primary")),
    );

    const about = h("div", { class: "hm-card" },
      h("h3", { text: t("about") }),
      h("div", { class: "hm-note", text: t("aboutText") }),
      h("div", { class: "hm-kv" },
        h("span", { class: "k", text: "插件" }), h("span", { class: "v hm-mono", text: "hana-magpie 1.0.0" }),
        h("span", { class: "k", text: "HanaAgent" }), h("span", { class: "v", text: `${S.state.hana.version || "?"} :${S.state.hana.port || "?"}` }),
        h("span", { class: "k", text: t("gateway") }), h("span", { class: "v hm-mono", text: S.state.gateway.baseUrl }),
      ),
      h("div", { class: "hm-sep" }),
      h("h3", { text: t("attribution") }),
      ...(S.state.attribution || []).map((a) => h("div", { class: "hm-note" },
        h("b", { text: a.name }), " — ", a.what, " · ",
        h("a", { href: a.url, target: "_blank", rel: "noopener noreferrer", text: a.url }),
        ` (${a.license})`,
      )),
      h("div", { class: "hm-note", text: "Hana Magpie 是移植版，不是 Magpie 官方项目。Magpie 为 MIT 许可；完整声明见插件目录中的 NOTICE.md。" }),
    );
    $("#view").replaceChildren(form, about);
  }

  // ---- render --------------------------------------------------------------

  async function render() {
    if (!S.state) return;
    setHeader();
    const fn = {
      agents: renderAgents, providers: renderProviders, routing: renderRouting,
      gateway: renderGateway, usage: renderUsage, plugins: renderPlugins, settings: renderSettings,
    }[S.view];
    setActions([]);
    await (fn || renderAgents)();
  }

  async function reloadView() {
    await loadState();
    setHeader();
    if (S.view === "usage") S.usage = null;
    await render();
  }

  // ---- boot ----------------------------------------------------------------

  function ready() {
    try { window.parent.postMessage({ type: "ready" }, "*"); } catch {}
    try { window.parent.postMessage({ type: "hana.magpie.ready" }, "*"); } catch {}
  }

  async function boot() {
    initNav();
    ready();
    const ok = await loadState();
    if (!ok) return;
    setHeader();
    await render();
    setInterval(async () => {
      // keep the gateway/agent badges fresh without disturbing the page
      try {
        const st = await api("state");
        const changed = JSON.stringify(st.gateway) !== JSON.stringify(S.state.gateway)
          || JSON.stringify(st.agents) !== JSON.stringify(S.state.agents)
          || st.plugins.length !== S.state.plugins.length;
        S.state = st;
        if (changed) {
          setHeader();
          if (S.view === "agents" || S.view === "gateway" || S.view === "plugins") await render();
        }
      } catch {}
    }, 15000);
  }

  boot();
})();
