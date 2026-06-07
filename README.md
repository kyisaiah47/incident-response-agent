# Incident Response Agent

**Slack-native incident management — built for the [Slack Agent Builder Challenge](https://slackagentbuilder.devpost.com/).**

Track: New Slack Agent · Deno + Slack Functions SDK

---

## What it does

Incident Response Agent turns Slack into a complete incident command center. Two triggers cover the full lifecycle:

**Declare Incident** — a modal collects service, severity (SEV1/2/3), and description, then automatically:
1. Searches Slack for recent messages and context about the affected service
2. Generates a unique incident ID and creates a dedicated war room channel (e.g. `inc-sev1-api-gateway-0607-1423`)
3. Pages the on-call engineer via PagerDuty
4. Fetches active Datadog monitors for the service and posts them to the war room
5. Posts a full context brief so the team hits the ground running

**Resolve Incident** — captures root cause and fix, then drafts a complete postmortem from the war room conversation history.

Every incident is persisted in a Slack Datastore.

## Architecture

```
Declare trigger (link trigger)
    │
    ▼
IncidentDeclaredWorkflow
    ├── search_context     → Slack search API (recent messages about service)
    ├── prepare_incident   → generate incident ID + war room channel name
    ├── CreateChannel      → Slack native function (Enterprise Grid-safe)
    ├── create_war_room    → post context brief, invite declarer, save to datastore
    ├── page_oncall        → PagerDuty REST API
    └── fetch_metrics      → Datadog monitors API

Resolve trigger (link trigger)
    │
    ▼
IncidentResolvedWorkflow
    └── draft_postmortem   → reads war room history, generates postmortem doc
```

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Deno |
| Framework | Slack Functions SDK (`deno-slack-sdk`) |
| Persistence | Slack Datastore |
| Alerting | PagerDuty API |
| Monitoring | Datadog API |

## Getting started

### Prerequisites

- [Slack CLI](https://api.slack.com/automation/cli/install) installed and logged in
- A Slack workspace on a paid plan
- PagerDuty and Datadog API keys (optional — agent degrades gracefully without them)

### 1. Clone and install

```bash
git clone https://github.com/kyisaiah47/incident-response-agent
cd incident-response-agent
slack app link
```

### 2. Set environment variables

```bash
slack env add PAGERDUTY_API_KEY your_key
slack env add DATADOG_API_KEY your_key
slack env add DATADOG_APP_KEY your_key
```

### 3. Run locally

```bash
slack run
```

### 4. Create triggers

```bash
slack trigger create --trigger-def triggers/declare_trigger.ts
slack trigger create --trigger-def triggers/resolve_trigger.ts
```

Post the shortcut URLs into any channel to use them.

### 5. Deploy to production

```bash
slack deploy
```

## Severity levels

| Level | Meaning |
|---|---|
| SEV1 | Critical — full outage |
| SEV2 | Major — degraded service |
| SEV3 | Minor — partial impact |
