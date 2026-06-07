import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { DraftPostmortemDefinition } from "../functions/draft_postmortem.ts";

const IncidentResolvedWorkflow = DefineWorkflow({
  callback_id: "incident_resolved",
  title: "Resolve Incident",
  description: "Closes the incident, drafts postmortem from war room conversation",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel: { type: Schema.slack.types.channel_id },
      user: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "channel", "user"],
  },
});

// Step 1: Collect resolution details
const form = IncidentResolvedWorkflow.addStep(Schema.slack.functions.OpenForm, {
  title: "✅ Resolve Incident",
  interactivity: IncidentResolvedWorkflow.inputs.interactivity,
  submit_label: "Resolve Incident",
  fields: {
    elements: [
      {
        name: "root_cause",
        title: "Root Cause",
        type: Schema.types.string,
        long: true,
        description: "What caused the incident?",
      },
      {
        name: "fix_description",
        title: "What fixed it?",
        type: Schema.types.string,
        long: true,
        description: "What action resolved the incident?",
      },
    ],
    required: ["root_cause", "fix_description"],
  },
});

// Step 2: Draft postmortem from war room history
IncidentResolvedWorkflow.addStep(DraftPostmortemDefinition, {
  channel_id: IncidentResolvedWorkflow.inputs.channel,
  root_cause: form.outputs.fields.root_cause,
  fix_description: form.outputs.fields.fix_description,
});

export default IncidentResolvedWorkflow;
