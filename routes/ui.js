// The page shell. HanaAgent renders it in a WebView/iframe tab; every asset
// is served by HanaAgent's own plugin-assets route (with its short-lived
// cookie), so this page is reached through HanaAgent and nowhere else.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function shell() {
  try {
    return fs.readFileSync(path.join(ROOT, "assets", "index.html"), "utf8");
  } catch (err) {
    return `<!doctype html><meta charset="utf-8"><title>Magpie</title>
<body style="font:14px system-ui;padding:24px">Hana Magpie assets are missing: ${String(err.message).replace(/</g, "&lt;")}</body>`;
  }
}

export default function (app) {
  const page = (c) => c.html(shell(), 200, {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self' 'unsafe-inline' data: blob:; connect-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-src 'self'",
  });
  app.get("/ui", page);
  app.get("/ui/", page);
}

