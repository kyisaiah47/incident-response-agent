import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import IncidentDeclaredWorkflow from "../workflows/incident_declared.ts";

const declareTrigger: Trigger<typeof IncidentDeclaredWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Declare Incident",
  description: "Open the incident declaration form",
  workflow: `#/workflows/${IncidentDeclaredWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: { value: TriggerContextData.Shortcut.interactivity },
    channel: { value: TriggerContextData.Shortcut.channel_id },
    user: { value: TriggerContextData.Shortcut.user_id },
  },
};

export default declareTrigger;
