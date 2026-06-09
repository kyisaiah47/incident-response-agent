import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const SearchEventsDefinition = DefineFunction({
  callback_id: "search_events",
  title: "Real-time event search",
  description: "Search Datadog Events in real-time for recent activity related to the affected service",
  source_file: "functions/search_events.ts",
  input_parameters: {
    properties: {
      service: { type: Schema.types.string },
      severity: { type: Schema.types.string },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["service", "channel_id"],
  },
  output_parameters: {
    properties: {
      events_summary: { type: Schema.types.string },
      event_count: { type: Schema.types.integer },
    },
    required: ["events_summary", "event_count"],
  },
});

export default SlackFunction(
  SearchEventsDefinition,
  async ({ inputs, client, env }) => {
    const ddApiKey = env.DATADOG_API_KEY;
    const ddAppKey = env.DATADOG_APP_KEY;
    const ddSite = env.DATADOG_SITE || "datadoghq.com";

    const now = Math.floor(Date.now() / 1000);
    const lookback = now - 60 * 60 * 6; // last 6 hours

    let eventCount = 0;
    let eventsSummary = "";

    if (ddApiKey && ddAppKey) {
      // Datadog Events v2 real-time search API
      const resp = await fetch(`https://api.${ddSite}/api/v2/events/search`, {
        method: "POST",
        headers: {
          "DD-API-KEY": ddApiKey,
          "DD-APPLICATION-KEY": ddAppKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            query: `service:${inputs.service} OR tags:service:${inputs.service}`,
            from: new Date(lookback * 1000).toISOString(),
            to: new Date(now * 1000).toISOString(),
          },
          sort: "-timestamp",
          page: { limit: 10 },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const events: any[] = data.data || [];
        eventCount = events.length;

        if (events.length > 0) {
          const lines = events.slice(0, 5).map((e) => {
            const attrs = e.attributes || {};
            const title = attrs.title || attrs.message || "Untitled event";
            const ts = attrs.timestamp
              ? new Date(attrs.timestamp).toUTCString()
              : "unknown time";
            const priority = attrs.priority || "normal";
            return `• *[${priority.toUpperCase()}]* ${title} — ${ts}`;
          });
          eventsSummary = lines.join("\n");
        } else {
          eventsSummary = `No Datadog events found for \`${inputs.service}\` in the last 6 hours.`;
        }
      } else {
        const errText = await resp.text();
        eventsSummary = `Datadog Events search error (${resp.status}): ${errText.slice(0, 200)}`;
      }
    } else {
      eventsSummary = "_Datadog not configured — add `DATADOG_API_KEY` and `DATADOG_APP_KEY` env vars._";
    }

    await client.chat.postMessage({
      channel: inputs.channel_id,
      text: `🔍 Real-time search: ${eventCount} Datadog event(s) for \`${inputs.service}\``,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🔍 *Real-time Event Search — \`${inputs.service}\` (last 6h):*\n${eventsSummary}`,
          },
        },
      ],
    });

    return { outputs: { events_summary: eventsSummary, event_count: eventCount } };
  },
);
