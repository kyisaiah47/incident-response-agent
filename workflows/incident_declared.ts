import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { SearchContextDefinition } from "../functions/search_context.ts";
import { SearchEventsDefinition } from "../functions/search_events.ts";
import { PrepareIncidentDefinition } from "../functions/prepare_incident.ts";
import { CreateWarRoomDefinition } from "../functions/create_war_room.ts";
import { PageOncallDefinition } from "../functions/page_oncall.ts";
import { FetchMetricsDefinition } from "../functions/fetch_metrics.ts";

const IncidentDeclaredWorkflow = DefineWorkflow({
  callback_id: "incident_declared",
  title: "Declare Incident",
  description: "Opens war room, pages on-call, surfaces Slack + Datadog context",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel: { type: Schema.slack.types.channel_id },
      user: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "channel", "user"],
  },
});

// Step 1: Collect incident details
const form = IncidentDeclaredWorkflow.addStep(Schema.slack.functions.OpenForm, {
  title: "🚨 Declare Incident",
  interactivity: IncidentDeclaredWorkflow.inputs.interactivity,
  submit_label: "Declare",
  fields: {
    elements: [
      {
        name: "service",
        title: "Affected Service",
        type: Schema.types.string,
        description: "e.g. api-gateway, payments-service, auth",
      },
      {
        name: "severity",
        title: "Severity",
        type: Schema.types.string,
        enum: ["SEV1", "SEV2", "SEV3"],
        choices: [
          { value: "SEV1", title: "SEV1 — Critical (full outage)" },
          { value: "SEV2", title: "SEV2 — Major (degraded service)" },
          { value: "SEV3", title: "SEV3 — Minor (partial impact)" },
        ],
        default: "SEV2",
      },
      {
        name: "description",
        title: "What's happening?",
        type: Schema.types.string,
        long: true,
        description: "Brief description of symptoms",
      },
    ],
    required: ["service", "severity"],
  },
});

// Step 2: Search Slack for recent context about the service
const contextStep = IncidentDeclaredWorkflow.addStep(SearchContextDefinition, {
  service: form.outputs.fields.service,
  severity: form.outputs.fields.severity,
  description: form.outputs.fields.description,
  channel_id: IncidentDeclaredWorkflow.inputs.channel,
});

// Step 3: Generate incident ID, channel name, and resolve workspace team_id
const prepareStep = IncidentDeclaredWorkflow.addStep(PrepareIncidentDefinition, {
  service: form.outputs.fields.service,
  severity: form.outputs.fields.severity,
  channel_id: IncidentDeclaredWorkflow.inputs.channel,
});

// Step 4: Create the war room channel via built-in (handles Enterprise Grid)
const createChannelStep = IncidentDeclaredWorkflow.addStep(
  Schema.slack.functions.CreateChannel,
  {
    channel_name: prepareStep.outputs.channel_name,
    team_id: prepareStep.outputs.team_id,
    manager_ids: [IncidentDeclaredWorkflow.inputs.user],
    is_private: false,
  },
);

// Step 5: Post context, invite declarer, save to datastore
IncidentDeclaredWorkflow.addStep(CreateWarRoomDefinition, {
  channel_id: createChannelStep.outputs.channel_id,
  incident_id: prepareStep.outputs.incident_id,
  declared_at: prepareStep.outputs.declared_at,
  service: form.outputs.fields.service,
  severity: form.outputs.fields.severity,
  description: form.outputs.fields.description,
  declared_by: IncidentDeclaredWorkflow.inputs.user,
  context_summary: contextStep.outputs.context_summary,
  recent_messages: contextStep.outputs.recent_messages,
});

// Step 6: Page on-call via PagerDuty
IncidentDeclaredWorkflow.addStep(PageOncallDefinition, {
  service: form.outputs.fields.service,
  severity: form.outputs.fields.severity,
  incident_id: prepareStep.outputs.incident_id,
  channel_id: createChannelStep.outputs.channel_id,
});

// Step 7: Real-time search Datadog Events for service activity (last 6h)
IncidentDeclaredWorkflow.addStep(SearchEventsDefinition, {
  service: form.outputs.fields.service,
  severity: form.outputs.fields.severity,
  channel_id: createChannelStep.outputs.channel_id,
});

// Step 8: Fetch Datadog monitors and post to war room
IncidentDeclaredWorkflow.addStep(FetchMetricsDefinition, {
  service: form.outputs.fields.service,
  channel_id: createChannelStep.outputs.channel_id,
});

export default IncidentDeclaredWorkflow;
