// A small agent-facing window into the plugin, the counterpart of magpie's
// `magpie quota` / `magpie provider` commands. Read-only: it never changes
// providers or agent models.

import { getServer } from "../lib/server.js";

export const name = "status";
export const description = "Hana Magpie status: gateway address, providers, models and which HanaAgent agents use it.";
export const parameters = {
  type: "object",
  properties: {
    includeModels: { type: "boolean", description: "Include the full model list." },
  },
  additionalProperties: false,
};
export const sessionPermission = { readOnly: true };

export async function execute(input = {}, ctx = {}) {
  const server = await getServer(ctx);
  await server.start();
  const state = await server.state();
  const out = {
    gateway: {
      running: state.gateway.running,
      baseUrl: state.gateway.baseUrl,
      port: state.gateway.port,
    },
    hana: state.hana,
    providers: state.providers.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      models: p.models,
      accounts: p.accounts.length,
      connected: p.connected,
      error: p.error || undefined,
    })),
    groups: state.groups.map((g) => ({ id: g.groupId, name: g.name, routing: g.routing, members: g.members.length })),
    agents: state.agents.map((a) => ({ id: a.id, name: a.name, onMagpie: a.onMagpie, model: a.modelName })),
    usage: server.usageSummary("today").totals,
  };
  if (input.includeModels) out.models = state.models.map((m) => ({ id: m.key, name: m.name, provider: m.providerName, api: m.api }));
  return JSON.stringify(out, null, 2);
}
