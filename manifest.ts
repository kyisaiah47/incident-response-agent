import { Manifest } from "deno-slack-sdk/mod.ts";
import IncidentDeclaredWorkflow from "./workflows/incident_declared.ts";
import IncidentResolvedWorkflow from "./workflows/incident_resolved.ts";
import IncidentsDatastore from "./datastores/incidents.ts";

export default Manifest({
  name: "Incident Response Agent",
  description: "Declare incidents, auto-create war rooms, page on-call, real-time event search, surface Slack + Datadog context, and generate AI postmortems",
  icon: "assets/default_new_app_icon.png",
  workflows: [IncidentDeclaredWorkflow, IncidentResolvedWorkflow],
  outgoingDomains: [
    "api.pagerduty.com",
    "api.datadoghq.com",
    "api.datadoghq.eu",
    "api.anthropic.com",
  ],
  datastores: [IncidentsDatastore],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "channels:manage",
    "channels:history",
    "channels:read",
    "channels:join",
    "groups:write",
    "datastore:read",
    "datastore:write",
  ],
});
