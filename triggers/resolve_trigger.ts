import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import IncidentResolvedWorkflow from "../workflows/incident_resolved.ts";

const resolveTrigger: Trigger<typeof IncidentResolvedWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Resolve Incident",
  description: "Close the incident and generate a postmortem from this channel",
  workflow: `#/workflows/${IncidentResolvedWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: { value: TriggerContextData.Shortcut.interactivity },
    channel: { value: TriggerContextData.Shortcut.channel_id },
    user: { value: TriggerContextData.Shortcut.user_id },
  },
};

export default resolveTrigger;
