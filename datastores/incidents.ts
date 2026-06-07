import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const IncidentsDatastore = DefineDatastore({
  name: "Incidents",
  primary_key: "incident_id",
  attributes: {
    incident_id: { type: Schema.types.string },
    service: { type: Schema.types.string },
    severity: { type: Schema.types.string },
    channel_id: { type: Schema.types.string },
    declared_by: { type: Schema.slack.types.user_id },
    declared_at: { type: Schema.types.string },
    status: { type: Schema.types.string },
  },
});

export default IncidentsDatastore;
