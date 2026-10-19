// Hana Magpie lifecycle. The gateway and the provider-plugin host belong to
// one server object; routes reach the same object through lib/server.js.
//
// The server is kept in this module, not on the plugin instance: HanaAgent
// serialises plugin descriptors on install, and an instance field pointing at
// the live gateway/catalog graph is a circular structure.

import { getServer } from "./lib/server.js";

let server = null;

export default class HanaMagpiePlugin {
  async onload() {
    server = await getServer(this.ctx);
    await server.start();
    this.ctx.log.info("hana-magpie started on", server.gateway.baseUrl);
  }

  async onunload() {
    try {
      await server?.stop();
    } catch (err) {
      this.ctx?.log?.warn?.("hana-magpie stop:", err?.message || err);
    }
  }
}
