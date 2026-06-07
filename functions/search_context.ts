import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const SearchContextDefinition = DefineFunction({
  callback_id: "search_context",
  title: "Search Slack context",
  description: "Surface recent Slack messages about the affected service",
  source_file: "functions/search_context.ts",
  input_parameters: {
    properties: {
      service: { type: Schema.types.string },
      severity: { type: Schema.types.string },
    },
    required: ["service"],
  },
  output_parameters: {
    properties: {
      context_summary: { type: Schema.types.string },
      recent_messages: { type: Schema.types.string },
    },
    required: ["context_summary", "recent_messages"],
  },
});

// Channels to scan for recent service-related activity
const WATCH_CHANNELS = ["general", "engineering", "alerts", "incidents", "oncall", "deployments"];

export default SlackFunction(
  SearchContextDefinition,
  async ({ inputs, client }) => {
    const term = inputs.service.toLowerCase();
    const hits: string[] = [];
    const channelsFound: string[] = [];
    const cutoff = Date.now() / 1000 - 60 * 60 * 24; // last 24 hours

    // Resolve channel names to IDs
    const listResp = await client.conversations.list({ limit: 200, exclude_archived: true });
    const allChannels: any[] = listResp.channels || [];

    const targets = allChannels.filter((c: any) =>
      WATCH_CHANNELS.some((name) => c.name?.includes(name)) ||
      c.name?.includes(term)
    );

    for (const channel of targets.slice(0, 8)) {
      const hist = await client.conversations.history({
        channel: channel.id,
        oldest: String(cutoff),
        limit: 100,
      });

      const matches = (hist.messages || []).filter((m: any) =>
        m.text?.toLowerCase().includes(term) && !m.bot_id
      );

      for (const m of matches.slice(0, 3)) {
        hits.push(`[#${channel.name}] ${(m.text || "").substring(0, 150)}`);
        if (!channelsFound.includes(channel.name)) channelsFound.push(channel.name);
      }

      if (hits.length >= 10) break;
    }

    if (hits.length === 0) {
      return {
        outputs: {
          context_summary: `No recent Slack activity mentioning \`${inputs.service}\` in the last 24h.`,
          recent_messages: "",
        },
      };
    }

    return {
      outputs: {
        context_summary: `Found *${hits.length}* recent messages about \`${inputs.service}\` in: ${channelsFound.map((c) => `#${c}`).join(", ")}`,
        recent_messages: hits.join("\n"),
      },
    };
  },
);
