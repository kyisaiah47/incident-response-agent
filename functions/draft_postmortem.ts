import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import type IncidentsDatastore from "../datastores/incidents.ts";

export const DraftPostmortemDefinition = DefineFunction({
  callback_id: "draft_postmortem",
  title: "Draft postmortem",
  description: "Summarize the war room and draft an AI-generated postmortem using Claude",
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
  async ({ inputs, client, env }) => {
    const resolvedAt = new Date().toUTCString();

    const channelInfo = await client.conversations.info({ channel: inputs.channel_id });
    const channelName: string = channelInfo.channel?.name || "unknown";

    const historyResp = await client.conversations.history({
      channel: inputs.channel_id,
      limit: 200,
    });

    const messages: any[] = (historyResp.messages || []).reverse();
    const humanMessages = messages
      .filter((m) => !m.bot_id && m.text && m.text.trim())
      .map((m) => `• ${m.text.trim()}`)
      .join("\n");

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

    let postmortem = "";
    const anthropicKey = env.ANTHROPIC_API_KEY;

    if (anthropicKey) {
      const prompt = `You are an SRE writing a concise incident postmortem. Based on the following information, write a structured postmortem in plain text (no markdown headers, use clear sections).

Incident ID: INC-${incidentId}
Service: ${service}
Severity: ${severity}
Duration: ${duration}
Declared: ${declaredAt}
Resolved: ${resolvedAt}
Root Cause: ${inputs.root_cause || "Not specified"}
Fix: ${inputs.fix_description || "Not specified"}

War Room Activity:
${humanMessages || "No human messages recorded."}

Write a postmortem with these sections: Summary, Timeline, Root Cause, Resolution, Action Items. Be concise and specific. Action items should be concrete and actionable.`;

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        postmortem = data.content?.[0]?.text || "";
      }
    }

    if (!postmortem) {
      postmortem = [
        `Incident Postmortem — INC-${incidentId}`,
        `Service: ${service} | Severity: ${severity} | Duration: ${duration}`,
        `Root Cause: ${inputs.root_cause || "Not specified"}`,
        `Fix: ${inputs.fix_description || "Not specified"}`,
        `War Room Activity:\n${humanMessages || "No human messages recorded."}`,
        `Action Items:\n- Root cause documented\n- Fix verified in prod\n- Alerting improved\n- Runbook updated`,
      ].join("\n\n");
    }

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
            { type: "mrkdwn", text: `*Resolved:*\n${resolvedAt}` },
          ],
        },
        { type: "divider" },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*🤖 AI-Generated Postmortem:*\n\`\`\`${postmortem}\`\`\`` },
        },
      ],
    });

    if (incident?.incident_id) {
      await client.apps.datastore.put<typeof IncidentsDatastore.definition>({
        datastore: "Incidents",
        item: { ...incident, status: "resolved" },
      });
    }

    return { outputs: { postmortem } };
  },
);
