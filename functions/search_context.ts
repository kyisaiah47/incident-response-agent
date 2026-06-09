import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const SearchContextDefinition = DefineFunction({
  callback_id: "search_context",
  title: "Search Slack context",
  description: "Surface and summarize recent Slack activity about the affected service using AI",
  source_file: "functions/search_context.ts",
  input_parameters: {
    properties: {
      service: { type: Schema.types.string },
      severity: { type: Schema.types.string },
      description: { type: Schema.types.string },
      channel_id: { type: Schema.slack.types.channel_id },
    },
    required: ["service", "channel_id"],
  },
  output_parameters: {
    properties: {
      context_summary: { type: Schema.types.string },
      recent_messages: { type: Schema.types.string },
    },
    required: ["context_summary", "recent_messages"],
  },
});

export default SlackFunction(
  SearchContextDefinition,
  async ({ inputs, client, env }) => {
    const term = inputs.service.toLowerCase();
    const cutoff = Date.now() / 1000 - 60 * 60 * 24;

    const hist = await client.conversations.history({
      channel: inputs.channel_id,
      oldest: String(cutoff),
      limit: 200,
    });

    const matches = (hist.messages || []).filter((m: any) =>
      m.text?.toLowerCase().includes(term)
    );

    const hits = matches.slice(0, 10).map((m: any) => `• ${(m.text || "").substring(0, 200)}`);
    const rawMessages = hits.join("\n");

    const anthropicKey = env.ANTHROPIC_API_KEY;
    let context_summary = hits.length > 0
      ? `Found ${hits.length} recent message(s) mentioning \`${inputs.service}\`.`
      : `No recent messages mentioning \`${inputs.service}\` in this channel.`;

    const contextForClaude = rawMessages || inputs.description || "";

    if (anthropicKey && contextForClaude) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `You are an SRE assistant. A ${inputs.severity || "SEV2"} incident has been declared for the service "${inputs.service}".

${rawMessages ? `Recent Slack messages:\n${rawMessages}` : `Incident description: ${inputs.description}`}

Write a 2-3 sentence intel brief for the incident response team. Be direct, specific, and actionable. Focus on likely blast radius and what to check first.`,
          }],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const aiSummary = data.content?.[0]?.text || "";
        if (aiSummary) context_summary = aiSummary;
      }
    }

    return { outputs: { context_summary, recent_messages: rawMessages } };
  },
);
