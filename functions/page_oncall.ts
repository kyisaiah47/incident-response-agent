import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const PageOncallDefinition = DefineFunction({
  callback_id: "page_oncall",
  title: "Page on-call",
  description: "Create a PagerDuty incident for the on-call engineer",
  source_file: "functions/page_oncall.ts",
  input_parameters: {
    properties: {
      service: { type: Schema.types.string },
      severity: { type: Schema.types.string },
      incident_id: { type: Schema.types.string },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["service", "severity", "incident_id", "channel_id"],
  },
  output_parameters: {
    properties: {
      pagerduty_url: { type: Schema.types.string },
      pagerduty_incident_id: { type: Schema.types.string },
    },
    required: ["pagerduty_url", "pagerduty_incident_id"],
  },
});

export default SlackFunction(
  PageOncallDefinition,
  async ({ inputs, client, env }) => {
    const pdToken = env.PAGERDUTY_TOKEN;
    const pdServiceId = env.PAGERDUTY_SERVICE_ID;
    const pdFromEmail = env.PAGERDUTY_FROM_EMAIL || "oncall@example.com";

    let pdUrl = "https://app.pagerduty.com";
    let pdIncidentId = "NOT_CONFIGURED";

    if (pdToken && pdServiceId) {
      const urgency = ["SEV1", "P1", "CRITICAL"].includes(inputs.severity.toUpperCase())
        ? "high"
        : "low";

      const resp = await fetch("https://api.pagerduty.com/incidents", {
        method: "POST",
        headers: {
          "Authorization": `Token token=${pdToken}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.pagerduty+json;version=2",
          "From": pdFromEmail,
        },
        body: JSON.stringify({
          incident: {
            type: "incident",
            title: `[INC-${inputs.incident_id}] ${inputs.severity} — ${inputs.service}`,
            service: { id: pdServiceId, type: "service_reference" },
            urgency,
            body: {
              type: "incident_body",
              details: `Slack war room: slack://channel?id=${inputs.channel_id}`,
            },
          },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        pdUrl = data.incident.html_url;
        pdIncidentId = data.incident.id;
      }
    }

    await client.chat.postMessage({
      channel: inputs.channel_id,
      text: `📟 On-call paged via PagerDuty`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: pdIncidentId === "NOT_CONFIGURED"
              ? "📟 *PagerDuty:* Not configured — add `PAGERDUTY_TOKEN` and `PAGERDUTY_SERVICE_ID` env vars."
              : `📟 *PagerDuty incident created:* <${pdUrl}|INC-${inputs.incident_id}>\nOn-call engineer has been paged.`,
          },
        },
      ],
    });

    return { outputs: { pagerduty_url: pdUrl, pagerduty_incident_id: pdIncidentId } };
  },
);
