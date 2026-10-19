// Hana Magpie — small shared helpers.
// This file is part of a clean-room port that borrows heavily from magpie
// (https://github.com/yetone/magpie, MIT). See NOTICE.md.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file, fallback) {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text.trim() ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(file, value, mode = 0o600) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { mode });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, mode); } catch {}
}

export function readText(file, fallback = "") {
  try { return fs.readFileSync(file, "utf8"); } catch { return fallback; }
}

export function writeText(file, text, mode = 0o600) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text, { mode });
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, mode); } catch {}
}

export function appendText(file, text) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, text, { mode: 0o600 });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function homeDir() {
  return process.env.HANA_HOME && process.env.HANA_HOME.trim()
    ? process.env.HANA_HOME.trim()
    : path.join(os.homedir(), ".hanako");
}

export function defaultDataDir() {
  return path.join(homeDir(), "plugin-data", "hana-magpie");
}

export function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function randomToken(prefix = "hm") {
  return `${prefix}-${crypto.randomBytes(24).toString("base64url")}`;
}

export function b64url(s) {
  return Buffer.from(String(s), "utf8").toString("base64url");
}

export function unb64url(s) {
  return Buffer.from(String(s), "base64url").toString("utf8");
}

export function sha1(s) {
  return crypto.createHash("sha1").update(String(s)).digest("hex");
}

export function safeId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function asArray(v) {
  return Array.isArray(v) ? v : [];
}

export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function truncate(s, n = 400) {
  const v = typeof s === "string" ? s : String(s ?? "");
  return v.length > n ? v.slice(0, n) + "…" : v;
}

export function jsonResponse(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value ?? null);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

export function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

export async function readRequestBody(req, limit = 32 << 20) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(httpError(413, "request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function readJsonBody(req, limit) {
  const buf = await readRequestBody(req, limit);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    throw httpError(400, "invalid JSON body");
  }
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function nowMs() { return Date.now(); }

export function iso(ms = Date.now()) {
  return new Date(ms).toISOString();
}

export function compactNumber(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(v));
}

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function readDirSafe(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}

export async function copyDir(src, dest) {
  await fsp.cp(src, dest, { recursive: true, force: true, errorOnExist: false });
}

export function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
}

export function isLoopbackAddress(addr = "") {
  const a = String(addr).replace(/^::ffff:/, "");
  return a === "127.0.0.1" || a === "::1" || a === "localhost";
}

export function parseBool(v, fallback = false) {
  if (v === undefined || v === null || v === "") return fallback;
  return v === true || v === "true" || v === "1" || v === 1;
}
