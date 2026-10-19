// Minimal, dependency-free tar.gz extractor used to install provider plugins
// from npm and from GitHub. It handles the ustar/PAX archives those services
// serve and refuses paths that would escape the destination directory.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function readString(buf, off, len) {
  const slice = buf.subarray(off, off + len);
  const zero = slice.indexOf(0);
  return slice.subarray(0, zero === -1 ? slice.length : zero).toString("utf8");
}

function readOctal(buf, off, len) {
  const s = readString(buf, off, len).trim();
  if (!s) return 0;
  const n = parseInt(s.replace(/[^0-7]/g, ""), 8);
  return Number.isFinite(n) ? n : 0;
}

function parsePax(text) {
  const out = {};
  let i = 0;
  while (i < text.length) {
    const space = text.indexOf(" ", i);
    if (space === -1) break;
    const len = parseInt(text.slice(i, space), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = text.slice(space + 1, i + len - 1);
    const eq = record.indexOf("=");
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

export function extractTarGz(buffer, destDir, { strip = 1, filter = null } = {}) {
  const tar = zlib.gunzipSync(buffer);
  fs.mkdirSync(destDir, { recursive: true });
  const destRoot = path.resolve(destDir);
  let offset = 0;
  let pax = {};
  let longName = "";
  let count = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    let name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    if (prefix) name = prefix + "/" + name;
    if (longName) { name = longName; longName = ""; }
    if (pax.path) { name = pax.path; delete pax.path; }
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) break;
    const data = tar.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === "x") { pax = { ...pax, ...parsePax(data.toString("utf8")) }; continue; }
    if (type === "g") { continue; }
    if (type === "L") { longName = readString(data, 0, data.length); continue; }
    if (type === "K") continue;
    if (!name || name.endsWith("/") && type === "5") {
      // directory
    }
    const parts = name.split("/").filter(Boolean);
    if (parts.some((p) => p === ".." || p === ".")) continue;
    const stripped = parts.slice(strip);
    if (!stripped.length) continue;
    const rel = stripped.join("/");
    if (filter && !filter(rel)) continue;
    const target = path.resolve(destRoot, rel);
    if (!target.startsWith(destRoot + path.sep) && target !== destRoot) continue;
    if (type === "5") {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    if (type === "2" || type === "1") {
      // Symlinks and hardlinks are not needed by provider plugins and are a
      // path-escape risk; skip them.
      continue;
    }
    if (type !== "0" && type !== "\0" && type !== "7") continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data, { mode: 0o644 });
    count++;
  }
  return count;
}

export function extractTarGzFile(file, destDir, options) {
  return extractTarGz(fs.readFileSync(file), destDir, options);
}
