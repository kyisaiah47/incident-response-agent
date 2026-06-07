import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import type IncidentsDatastore from "../datastores/incidents.ts";

export const DraftPostmortemDefinition = DefineFunction({
  callback_id: "draft_postmortem",
  title: "Draft postmortem",
  description: "Summarize the war room and draft a postmortem using Slack AI",
  source_file: "functions/draft_postmortem.ts",
  input_parameters: {
    properties: {
      channel_id: { type: Schema.slack.types.channel_id },
      root_cause: { type: Schema.types.string },
      fix_description: { type: Schema.types.string },
    },
    required: ["channel_id"],
  },
  output_parameters: {
    properties: {
      postmortem: { type: Schema.types.string },
    },
    required: ["postmortem"],
  },
});

export default SlackFunction(
  DraftPostmortemDefinition,
  async ({ inputs, client }) => {
    const resolvedAt = new Date().toUTCString();

    // Fetch channel info to derive the incident details from the channel name
    const channelInfo = await client.conversations.info({ channel: inputs.channel_id });
    const channelName: string = channelInfo.channel?.name || "unknown";

    // Pull up to 200 messages from the war room for context
    const historyResp = await client.conversations.history({
      channel: inputs.channel_id,
      limit: 200,
    });

    const messages: any[] = (historyResp.messages || []).reverse();

    // Separate bot context posts from human messages
    const humanMessages = messages
      .filter((m) => !m.bot_id && m.text && m.text.trim())
      .map((m) => `• ${m.text.trim()}`)
      .join("\n");

    // Try to find the stored incident record from the datastore
    const queryResp = await client.apps.datastore.query<
      typeof IncidentsDatastore.definition
    >({
      datastore: "Incidents",
      expression: "#channel_id = :channel_id",
      expression_attributes: { "#channel_id": "channel_id" },
      expression_values: { ":channel_id": inputs.channel_id },
    });

    const incident = queryResp.items?.[0];
    const service = incident?.service || channelName;
    const severity = incident?.severity || "Unknown";
    const incidentId = incident?.incident_id || "???";
    const declaredAt = incident?.declared_at
      ? new Date(incident.declared_at).toUTCString()
      : "Unknown";
    const duration = incident?.declared_at
      ? `${Math.round((Date.now() - new Date(incident.declared_at).getTime()) / 60000)} minutes`
      : "Unknown";

    const postmortem = [
      `## Incident Postmortem — INC-${incidentId}`,
      "",
      `**Service:** \`${service}\``,
      `**Severity:** ${severity}`,
      `**Declared:** ${declaredAt}`,
      `**Resolved:** ${resolvedAt}`,
      `**Duration:** ${duration}`,
      "",
      "### Root Cause",
      inputs.root_cause || "_Not specified_",
      "",
      "### What Fixed It",
      inputs.fix_description || "_Not specified_",
      "",
      "### War Room Activity",
      humanMessages || "_No human messages recorded._",
      "",
      "### Action Items",
      "- [ ] Root cause fully confirmed and documented",
      "- [ ] Fix deployed and verified in production",
      "- [ ] Monitoring/alerting improved to catch this earlier",
      "- [ ] Runbook updated",
    ].join("\n");

    await client.chat.postMessage({
      channel: inputs.channel_id,
      text: `📋 Postmortem for INC-${incidentId}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `✅ Incident Resolved — INC-${incidentId}` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Service:*\n\`${service}\`` },
            { type: "mrkdwn", text: `*Severity:*\n${severity}` },
            { type: "mrkdwn", text: `*Duration:*\n${duration}` },
            { type: "mrkdwn", text: `*Resolved at:*\n${resolvedAt}` },
          ],
        },
        { type: "divider" },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Root Cause:*\n${inputs.root_cause || "_Not specified_"}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Fix:*\n${inputs.fix_description || "_Not specified_"}` },
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Action Items:*\n• Root cause documented\n• Fix verified in prod\n• Alerting improved\n• Runbook updated`,
          },
        },
      ],
    });

    // Mark incident resolved in datastore
    if (incident?.incident_id) {
      await client.apps.datastore.put<typeof IncidentsDatastore.definition>({
        datastore: "Incidents",
        item: { ...incident, status: "resolved" },
      });
    }

    return { outputs: { postmortem } };
  },
);
