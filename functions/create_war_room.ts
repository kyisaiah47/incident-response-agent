import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import type IncidentsDatastore from "../datastores/incidents.ts";

export const CreateWarRoomDefinition = DefineFunction({
  callback_id: "create_war_room",
  title: "Set up war room",
  description: "Post incident context, invite declarer, save incident record",
  source_file: "functions/create_war_room.ts",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      incident_id: { type: Schema.types.string },
      declared_at: { type: Schema.types.string },
      service: { type: Schema.types.string },
      severity: { type: Schema.types.string },
      description: { type: Schema.types.string },
      declared_by: { type: Schema.slack.types.user_id },
      context_summary: { type: Schema.types.string },
      recent_messages: { type: Schema.types.string },
    },
    required: ["channel_id", "incident_id", "declared_at", "service", "severity", "declared_by"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});

export default SlackFunction(
  CreateWarRoomDefinition,
  async ({ inputs, client }) => {
    const { channel_id, incident_id, service, severity, declared_by, declared_at } = inputs;

    // Invite the person who declared
    await client.conversations.invite({ channel: channel_id, users: declared_by }).catch(() => null);

    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `🚨 ${severity} Incident — ${service}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Service:*\n\`${service}\`` },
          { type: "mrkdwn", text: `*Severity:*\n${severity}` },
          { type: "mrkdwn", text: `*Incident ID:*\n\`INC-${incident_id}\`` },
          { type: "mrkdwn", text: `*Declared by:*\n<@${declared_by}>` },
          { type: "mrkdwn", text: `*Time (UTC):*\n${new Date(declared_at).toUTCString()}` },
        ],
      },
    ];

    if (inputs.description) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*What's happening:*\n${inputs.description}` },
      });
    }

    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📡 Slack Context:*\n${inputs.context_summary || "_No recent activity found._"}`,
      },
    });

    if (inputs.recent_messages) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Recent messages:*\n\`\`\`${inputs.recent_messages}\`\`\`` },
      });
    }

    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "⏳ Paging on-call and fetching metrics… Use the *Resolve Incident* shortcut in this channel when the incident is fixed.",
      },
    });

    await client.chat.postMessage({
      channel: channel_id,
      text: `🚨 ${severity} Incident declared for \`${service}\` — INC-${incident_id}`,
      blocks,
    });

    await client.apps.datastore.put<typeof IncidentsDatastore.definition>({
      datastore: "Incidents",
      item: {
        incident_id,
        service,
        severity,
        channel_id,
        declared_by,
        declared_at,
        status: "active",
      },
    });

    return { outputs: {} };
  },
);
