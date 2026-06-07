import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const FetchMetricsDefinition = DefineFunction({
  callback_id: "fetch_metrics",
  title: "Fetch Datadog metrics",
  description: "Fetch active Datadog monitors for the affected service",
  source_file: "functions/fetch_metrics.ts",
  input_parameters: {
    properties: {
      service: { type: Schema.types.string },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["service", "channel_id"],
  },
  output_parameters: {
    properties: {
      alert_count: { type: Schema.types.integer },
      metrics_summary: { type: Schema.types.string },
    },
    required: ["alert_count", "metrics_summary"],
  },
});

export default SlackFunction(
  FetchMetricsDefinition,
  async ({ inputs, client, env }) => {
    const ddApiKey = env.DATADOG_API_KEY;
    const ddAppKey = env.DATADOG_APP_KEY;
    const ddSite = env.DATADOG_SITE || "datadoghq.com";

    let alertCount = 0;
    let metricsSummary = "";

    if (ddApiKey && ddAppKey) {
      const resp = await fetch(
        `https://api.${ddSite}/api/v1/monitor?name=${encodeURIComponent(inputs.service)}&monitor_tags=service:${encodeURIComponent(inputs.service)}`,
        {
          headers: {
            "DD-API-KEY": ddApiKey,
            "DD-APPLICATION-KEY": ddAppKey,
          },
        },
      );

      if (resp.ok) {
        const monitors: any[] = await resp.json();
        const alerting = monitors.filter((m) =>
          m.overall_state === "Alert" || m.overall_state === "Warn"
        );
        alertCount = alerting.length;
        metricsSummary = alerting.length > 0
          ? alerting.slice(0, 5).map((m) => `• *${m.name}* — ${m.overall_state}`).join("\n")
          : "No active Datadog alerts for this service.";
      } else {
        metricsSummary = `Datadog API error: ${resp.status}`;
      }
    } else {
      metricsSummary = "_Datadog not configured — add `DATADOG_API_KEY` and `DATADOG_APP_KEY` env vars._";
    }

    await client.chat.postMessage({
      channel: inputs.channel_id,
      text: `📊 Datadog: ${alertCount} active alert(s) for \`${inputs.service}\``,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📊 *Datadog Monitors — \`${inputs.service}\`:*\n${metricsSummary}`,
          },
        },
      ],
    });

    return { outputs: { alert_count: alertCount, metrics_summary: metricsSummary } };
  },
);
