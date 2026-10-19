// Installing magpie / OpenCode provider plugins without Bun.
//
// magpie asks Bun to add npm packages and git repositories and to run the
// plugin host. HanaAgent runs on Node, so this module does the same job with
// Node APIs: fetch a registry tarball or a GitHub archive, unpack it with
// lib/tar.js, and provide the two packages provider plugins commonly import
// (@opencode-ai/plugin and zod). Folder plugins are loaded in place, as
// magpie does for `magpie plugin add ./dir`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, readJson, writeJson, safeId, rmrf, copyDir, randomId } from "./util.js";
import { extractTarGz } from "./tar.js";

const UA = "hana-magpie/1.0 (+https://github.com/liliMozi/openhanako)";

function registryBase(store) {
  return (store.config.registry && String(store.config.registry).trim().replace(/\/+$/, "")) || "https://registry.npmjs.org";
}

async function fetchJson(url, timeout = 30000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBuffer(url, timeout = 120000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export function parseSpec(raw) {
  const spec = String(raw || "").trim();
  if (!spec) throw new Error("empty plugin spec");
  if (/^https?:\/\//i.test(spec) || /^git\+/i.test(spec)) {
    const m = /(?:github\.com\/|git\+https?:\/\/github\.com\/)([^/\s#]+)\/([^/\s#]+?)(?:\.git)?(?:#([^\s]+))?$/i.exec(spec);
    if (m) return { kind: "git", owner: m[1], repo: m[2], ref: m[3] || "", spec: `${m[1]}/${m[2]}${m[3] ? "#" + m[3] : ""}` };
    return { kind: "url", url: spec, spec };
  }
  if (/^(?:[A-Za-z]:[\\/]|\.{0,2}[\\/]|~[\\/])/.test(spec) || fs.existsSync(path.resolve(spec))) {
    return { kind: "folder", dir: path.resolve(spec.replace(/^~/, process.env.USERPROFILE || process.env.HOME || "~")), spec };
  }
  if (/^github:/i.test(spec)) {
    const rest = spec.slice(7);
    const [repoPart, ref = ""] = rest.split("#");
    const [owner, repo] = repoPart.split("/");
    if (!owner || !repo) throw new Error(`invalid GitHub spec: ${spec}`);
    return { kind: "git", owner, repo, ref, spec: `${owner}/${repo}${ref ? "#" + ref : ""}` };
  }
  if (spec.startsWith("@")) {
    // scoped npm: @scope/name[@version]
    const at = spec.indexOf("@", 1);
    if (at > 0) return { kind: "npm", name: spec.slice(0, at), version: spec.slice(at + 1), spec };
    return { kind: "npm", name: spec, version: "", spec };
  }
  if (/^[^\s@/]+\/[^\s@/]+(?:#[^\s]+)?$/.test(spec) && !spec.includes(":")) {
    const [repoPart, ref = ""] = spec.split("#");
    const [owner, repo] = repoPart.split("/");
    return { kind: "git", owner, repo, ref, spec: `${owner}/${repo}${ref ? "#" + ref : ""}` };
  }
  const at = spec.lastIndexOf("@");
  if (at > 0) return { kind: "npm", name: spec.slice(0, at), version: spec.slice(at + 1), spec };
  return { kind: "npm", name: spec, version: "", spec };
}

function flattenPackageRoot(dir) {
  // npm tarballs have a single "package/" root; GitHub archives have
  // "<repo>-<ref>/". extractTarGz strips one segment, so this is only a
  // fallback when a package brought no package.json at its root.
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (entries.length === 1) {
    const inner = path.join(dir, entries[0].name);
    if (fs.existsSync(path.join(inner, "package.json"))) {
      for (const e of fs.readdirSync(inner)) fs.renameSync(path.join(inner, e), path.join(dir, e));
      fs.rmdirSync(inner);
    }
  }
}

function safeDirName(name) {
  return safeId(String(name).replace(/^@/, "").replace(/\//g, "-")) || "plugin-" + randomId(4);
}

function ensureShims(store) {
  const nm = path.join(store.pluginsDir, "node_modules");
  const oc = path.join(nm, "@opencode-ai", "plugin");
  const zod = path.join(nm, "zod");
  if (!fs.existsSync(path.join(oc, "index.js"))) {
    ensureDir(oc);
    writeJson(path.join(oc, "package.json"), { name: "@opencode-ai/plugin", version: "0.0.0-hana-magpie", type: "module", main: "./index.js", exports: { ".": "./index.js" } });
    fs.writeFileSync(path.join(oc, "index.js"), [
      "// Minimal stand-in for OpenCode's plugin helpers. Provider plugins use",
      "// `tool` only to declare agent tools; Hana Magpie does not run tools from",
      "// provider plugins, but the import must resolve for the module to load.",
      "const schema = new Proxy(function schema() {}, {",
      "  get: (t, k) => k === 'then' ? undefined : schema,",
      "  apply: () => schema,",
      "});",
      "export const tool = (definition) => definition;",
      "tool.schema = schema;",
      "export default { tool };",
      "",
    ].join("\n"));
  }
  if (!fs.existsSync(path.join(zod, "index.js"))) {
    ensureDir(zod);
    writeJson(path.join(zod, "package.json"), { name: "zod", version: "0.0.0-hana-magpie", type: "module", main: "./index.js", exports: { ".": "./index.js" } });
    fs.writeFileSync(path.join(zod, "index.js"), [
      "// A tiny, permissive Zod-shaped stand-in. Provider plugins use z only to",
      "// describe tool arguments, which this host does not execute.",
      "const chain = new Proxy(function z() {}, {",
      "  get(t, k) {",
      "    if (k === 'then') return undefined;",
      "    if (k === 'parse') return (v) => v;",
      "    if (k === 'safeParse') return (v) => ({ success: true, data: v });",
      "    return chain;",
      "  },",
      "  apply() { return chain; },",
      "});",
      "export const z = chain;",
      "export default z;",
      "export const object = chain;",
      "export const string = chain;",
      "export const number = chain;",
      "export const boolean = chain;",
      "export const array = chain;",
      "export const optional = chain;",
      "export const enumType = chain;",
      "export const union = chain;",
      "export const literal = chain;",
      "export const record = chain;",
      "export const any = chain;",
      "export const unknown = chain;",
      "export const nullable = chain;",
      "export const coerce = chain;",
      "",
    ].join("\n"));
  }
}

async function installNpmPackage(store, name, version, destDir, depth, seen) {
  const reg = registryBase(store);
  const metaUrl = `${reg}/${name.startsWith("@") ? "@" + encodeURIComponent(name.slice(1)).replace("%2F", "/") : encodeURIComponent(name)}`;
  let meta;
  try {
    meta = await fetchJson(metaUrl);
  } catch (err) {
    const mirror = "https://registry.npmmirror.com";
    if (!reg.includes("npmmirror")) meta = await fetchJson(`${mirror}/${name.startsWith("@") ? "@" + encodeURIComponent(name.slice(1)).replace("%2F", "/") : encodeURIComponent(name)}`);
    else throw err;
  }
  const resolved = version && meta.versions?.[version]
    ? version
    : (meta["dist-tags"]?.latest || Object.keys(meta.versions || {}).pop());
  const info = meta.versions?.[resolved];
  if (!info) throw new Error(`${name}@${version || "latest"} not found on the registry`);
  const buf = await fetchBuffer(info.dist.tarball);
  ensureDir(destDir);
  extractTarGz(buf, destDir, { strip: 1 });
  flattenPackageRoot(destDir);
  writeFileIfMissing(path.join(destDir, "package.json"), JSON.stringify({
    name: info.name || name,
    version: info.version || resolved,
    type: "module",
    main: "./index.mjs",
  }, null, 2));
  await installDependencies(store, destDir, depth, seen);
  return { name: info.name || name, version: info.version || resolved };
}

function writeFileIfMissing(file, content) {
  if (fs.existsSync(file)) return;
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

async function installDependencies(store, pkgDir, depth, seen) {
  if (depth <= 0) return;
  const pkg = readJson(path.join(pkgDir, "package.json"), {});
  const deps = { ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}) };
  for (const [name, range] of Object.entries(deps)) {
    if (name === "@opencode-ai/plugin" || name === "zod") continue;
    if (seen.has(name) || seen.size > 80) continue;
    seen.add(name);
    const target = path.join(pkgDir, "node_modules", ...name.split("/"));
    if (fs.existsSync(path.join(target, "package.json"))) continue;
    try {
      await installNpmPackage(store, name, "", target, depth - 1, seen);
    } catch (err) {
      store.log("warn", `dependency ${name} of ${pkg.name || pkgDir} not installed: ${err?.message || err}`);
    }
  }
}

function findPackageJson(dir) {
  const p = path.join(dir, "package.json");
  if (fs.existsSync(p)) return readJson(p, null);
  return null;
}

export async function installPlugin(store, rawSpec, options = {}, { link = false } = {}) {
  ensureShims(store);
  const parsed = parseSpec(rawSpec);
  let name = parsed.spec;
  let version = "";
  let source = parsed.kind;
  let target;

  if (parsed.kind === "folder") {
    if (!fs.existsSync(parsed.dir)) throw new Error(`no such folder: ${parsed.dir}`);
    const pkg = findPackageJson(parsed.dir);
    name = pkg?.name || path.basename(parsed.dir);
    version = pkg?.version || "";
    target = link ? parsed.dir : path.join(store.pluginsDir, safeDirName(name));
    if (!link) {
      rmrf(target);
      ensureDir(target);
      await copyDir(parsed.dir, target);
      // Copying a directory into a child of itself would recurse; reject
      // that case rather than filling the disk.
    }
    name = findPackageJson(target)?.name || name;
  } else if (parsed.kind === "npm") {
    name = parsed.name;
    const dir = path.join(store.pluginsDir, safeDirName(name));
    rmrf(dir);
    const got = await installNpmPackage(store, parsed.name, parsed.version, dir, 2, new Set());
    version = got.version;
    name = got.name;
    target = dir;
  } else if (parsed.kind === "git") {
    const dir = path.join(store.pluginsDir, safeDirName(`${parsed.owner}-${parsed.repo}`));
    rmrf(dir);
    const refs = parsed.ref ? [parsed.ref] : [];
    if (!parsed.ref) {
      try {
        const info = await fetchJson(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, 15000);
        if (info.default_branch) refs.push(info.default_branch);
      } catch {}
      refs.push("main", "master");
    }
    let lastErr;
    for (const ref of [...new Set(refs)]) {
      try {
        const url = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/tar.gz/${encodeURIComponent(ref)}`;
        const buf = await fetchBuffer(url);
        ensureDir(dir);
        extractTarGz(buf, dir, { strip: 1 });
        flattenPackageRoot(dir);
        lastErr = null;
        version = ref;
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw new Error(`could not download ${parsed.owner}/${parsed.repo}: ${lastErr.message}`);
    const pkg = findPackageJson(dir);
    name = pkg?.name || `${parsed.owner}/${parsed.repo}`;
    version = pkg?.version || version;
    await installDependencies(store, dir, 2, new Set());
    target = dir;
  } else {
    throw new Error(`unsupported plugin source: ${rawSpec}`);
  }

  const pkg = findPackageJson(target) || {};
  const entry = {
    spec: parsed.spec || name,
    name: pkg.name || name,
    version: pkg.version || version || "",
    source,
    target: path.resolve(target),
    options: options && Object.keys(options).length ? options : undefined,
    off: false,
    addedAt: Date.now(),
    magpie: pkg.magpie || undefined,
  };
  store.putPlugin(entry);
  return entry;
}

export function pluginEntryFile(entry) {
  const dir = entry.target;
  if (!dir || !fs.existsSync(dir)) return null;
  const pkg = readJson(path.join(dir, "package.json"), null);
  const pick = (v) => (typeof v === "string" ? v : v?.import ?? v?.default);
  const candidates = [];
  if (pkg) {
    const ex = pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports) ? pkg.exports : undefined;
    if (ex) candidates.push(pick(ex["./server"]), pick(ex["."]));
    candidates.push(pkg.main);
    if (typeof pkg.exports === "string") candidates.push(pkg.exports);
  }
  candidates.push("index.ts", "index.tsx", "index.js", "index.mjs", "index.cjs");
  for (const c of candidates) {
    if (!c) continue;
    const p = path.resolve(dir, c);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

export function removePluginFiles(store, entry) {
  try {
    if (entry.target && entry.target.startsWith(path.resolve(store.pluginsDir) + path.sep)) {
      rmrf(entry.target);
    }
  } catch {}
}

export function pluginHostList(store) {
  return store.plugins()
    .filter((p) => !p.off)
    .map((p) => ({
      spec: p.spec,
      target: p.target,
      options: p.options || store.config.pluginOptions?.[p.spec] || undefined,
      gateway: p.packageGateway,
    }))
    .filter((p) => p.target && fs.existsSync(p.target));
}

export async function searchNpm(store, query, size = 20) {
  const reg = registryBase(store);
  const url = `${reg}/-/v1/search?text=${encodeURIComponent(query || "opencode-plugin")}&size=${Math.min(50, size)}`;
  const data = await fetchJson(url, 20000);
  return (data.objects || []).map((o) => {
    const p = o.package || {};
    return {
      name: p.name,
      version: p.version,
      description: p.description || "",
      date: p.date,
      keywords: p.keywords || [],
      links: p.links || {},
      score: o.score?.final || 0,
    };
  }).filter((p) => p.name);
}

export function loadMarket(store) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "market.magpie.json");
  const market = readJson(file, { plugins: [] });
  const items = (market.plugins || []).filter((p) => {
    // Provider plugins are what this host runs. Magpie's gateway middleware
    // and page/tool entries are a separate runtime this port does not claim.
    const kind = p.kind || "provider";
    return kind === "provider" && Array.isArray(p.providers) && p.providers.length > 0;
  }).map((p) => ({
    package: p.package,
    name: p.name,
    icon: p.icon || "",
    providers: p.providers || [],
    summary: p.summary || {},
    kind: p.kind || "provider",
    community: true,
    installed: !!store.pluginBySpec(p.package),
  }));
  return { version: market.version || 1, plugins: items };
}

export function compareVersions(a, b) {
  const pa = String(a || "0").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "0").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

export async function checkPluginUpdate(store, entry) {
  if (entry.source !== "npm") return null;
  try {
    const reg = registryBase(store);
    const name = entry.name || entry.spec;
    const meta = await fetchJson(`${reg}/${name.startsWith("@") ? "@" + encodeURIComponent(name.slice(1)).replace("%2F", "/") : encodeURIComponent(name)}`, 15000);
    const latest = meta["dist-tags"]?.latest;
    if (latest && compareVersions(latest, entry.version)) return { latest, current: entry.version };
  } catch {}
  return null;
}
