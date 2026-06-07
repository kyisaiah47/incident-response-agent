import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const PrepareIncidentDefinition = DefineFunction({
  callback_id: "prepare_incident",
  title: "Prepare incident",
  description: "Generate incident ID, channel name, and resolve workspace team ID",
  source_file: "functions/prepare_incident.ts",
  input_parameters: {
    properties: {
      service: { type: Schema.types.string },
      severity: { type: Schema.types.string },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["service", "severity", "channel_id"],
  },
  output_parameters: {
    properties: {
      channel_name: { type: Schema.types.string },
      incident_id: { type: Schema.types.string },
      declared_at: { type: Schema.types.string },
      team_id: { type: Schema.types.string },
    },
    required: ["channel_name", "incident_id", "declared_at", "team_id"],
  },
});

export default SlackFunction(PrepareIncidentDefinition, async ({ inputs, client }) => {
  const incidentId = crypto.randomUUID().substring(0, 8).toUpperCase();
  const now = new Date();
  const ts = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const safeName = inputs.service.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 25);
  const channelName = `inc-${inputs.severity.toLowerCase()}-${safeName}-${ts}`;

  // Get workspace team_id (T...) from the triggering channel — auth.test returns
  // the enterprise ID (E...) for org-level installs which CreateChannel rejects.
  const chanInfo = await client.conversations.info({ channel: inputs.channel_id });
  const teamId: string = (chanInfo.channel as any)?.context_team_id ||
    (chanInfo.channel as any)?.shared_team_ids?.[0] || "";

  return {
    outputs: {
      channel_name: channelName,
      incident_id: incidentId,
      declared_at: now.toISOString(),
      team_id: teamId,
    },
  };
});
