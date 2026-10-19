# NOTICE — Hana Magpie

Hana Magpie is a port of Magpie's model layer into HanaAgent. It is **not**
the original Magpie and is not affiliated with or endorsed by the Magpie or
HanaAgent projects. This file lists what was borrowed and under which license.

## magpie — https://github.com/yetone/magpie

License: MIT (see `assets/LICENSE.magpie.txt`).

Borrowed directly:

- `lib/host.vendor.mjs` — magpie's `internal/plugin/host.js`, vendored with
  only these Node-compatibility changes:
  - the header comment was extended,
  - `Bun.inspect` became `node:util.inspect`,
  - `Bun.$` became a small `node:child_process` shell helper,
  - Bun's `spawn`/`spawnSync` stdio wrapper became a no-op (Node leaves the
    plugin's child-process stdio alone),
  - a `module.registerHooks` + `stripTypeScriptTypes` loader was added so
    `.ts` provider plugins load under Node.
- `lib/market.magpie.json` — magpie's `internal/plugin/market.json`, the
  provider-plugin market list.
- `assets/app.css`, `assets/plugins.css`, `assets/icons/*` — magpie's window
  styles and provider icons.
- The page's sidebar/topbar layout, row and dialog structure, and wording are
  derived from magpie's window.
- Provider presets in `lib/presets.js` are a small curated subset of magpie's
  `internal/provider/presets.go`.
- The gateway behaviour (account scoping, `chat.headers`, model rewriting,
  failover, usage shape, `GET /v1/models`, loopback trust) follows magpie's
  gateway and plugin protocol.

Borrowed in spirit / reimplemented for Node:

- `lib/host-client.js` is a Node reimplementation of the parent side of the
  protocol implemented in magpie's `internal/plugin/host.go` (`init`,
  `providers`, `apiKey`, `authorize`, `callback`, `load`, `fetch`, `usage`,
  `reload`, `signOut`, fetch `head` / `chunk` / `credit` streaming).
- `lib/installer.js` replaces magpie's `bun add` / git install with Node
  fetch + tar extraction; the plugin layout and `plugins.json` shape follow
  magpie.
- `lib/catalog.js` / `lib/gateway.js` / `lib/server.js` follow magpie's
  provider, routing-group and gateway semantics but are new code.

Magpie is Copyright (c) yetone and contributors, MIT.

## OpenCode plugin API — https://opencode.ai/docs/plugins/

License: MIT (OpenCode).

Hana Magpie implements the OpenCode v1 provider-plugin hooks that Magpie runs
(`config`, `auth`, `auth.loader`, `auth.usage`, `auth.refresh`,
`provider.models`, `chat.headers`). Provider plugins written for OpenCode and
Magpie are loaded unmodified.

## HanaAgent / OpenHanako — https://github.com/liliMozi/openhanako

License: Apache-2.0.

Hana Magpie is a HanaAgent plugin. It uses HanaAgent's documented plugin
system (full-access plugin, `index.js` lifecycle, `routes/*.js`, page
contribution, `assets/` serving) and HanaAgent's local HTTP API (`/api/config`,
`/api/agents/:id/config`, `/api/models`). No HanaAgent source file is copied
into this plugin.

## magpie-community/plugins — https://github.com/magpie-community/plugins

License: MIT.

The market list points at community provider plugins. Each installed plugin
keeps its own license and README in its plugin folder; installing one is the
user's choice.

## Icons

Provider logos in `assets/icons/` come from magpie's `internal/gui/assets/icons`
(the same set magpie uses), Copyright their respective vendors. They are used
only to identify the provider they belong to.

## This plugin

Hana Magpie's own code is MIT — see `LICENSE`.
