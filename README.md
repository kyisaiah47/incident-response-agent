<div align="center">

<img src="assets/banner.png" alt="banner" width="100%" />

# 🚨 Incident Response Agent

**Slack-native incident command center — declare, manage, and postmortem in one workflow.**

![Deno](https://img.shields.io/badge/Deno-000000?style=for-the-badge&logo=deno&logoColor=white)
![Slack](https://img.shields.io/badge/Slack-4A154B?style=for-the-badge&logo=slack&logoColor=white)
![PagerDuty](https://img.shields.io/badge/PagerDuty-06AC38?style=for-the-badge&logo=pagerduty&logoColor=white)
![Datadog](https://img.shields.io/badge/Datadog-632CA6?style=for-the-badge&logo=datadog&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

</div>

<br/>

Incident Response Agent turns Slack into a full incident command center using the [Slack Agent Builder](https://slackagentbuilder.devpost.com/) framework. A single **Declare** trigger spins up a dedicated war room channel, pages on-call, and posts a live context brief in seconds. When the smoke clears, a **Resolve** trigger reads the war room history and auto-drafts a complete postmortem — no context-switching required.

## ✨ Features

- **One-click war room creation** — generates a unique incident channel (e.g. `inc-sev1-api-gateway-0607-1423`) automatically
- **Automatic context brief** — searches Slack for recent messages about the affected service and posts them to the war room before anyone types a word
- **PagerDuty paging** — on-call engineer is paged the moment an incident is declared
- **Live Datadog monitor feed** — active monitors for the impacted service are pulled and posted to the war room on declaration
- **AI-generated postmortems** — Resolve trigger reads the full war room conversation and drafts a structured postmortem doc
- **Graceful degradation** — PagerDuty and Datadog integrations are optional; the agent works without them

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Deno |
| Framework | Slack Functions SDK (`deno-slack-sdk`) |
| Persistence | Slack Datastore |
| Alerting | PagerDuty API |
| Monitoring | Datadog API |

## 🚀 Getting Started

### Prerequisites

- [Slack CLI](https://api.slack.com/automation/cli/install) installed and authenticated
- Slack workspace on a paid plan
- PagerDuty and Datadog API keys (optional)

### Install & run

```bash
git clone https://github.com/kyisaiah47/incident-response-agent
cd incident-response-agent
slack app link

# Set optional integrations
slack env add PAGERDUTY_API_KEY your_key
slack env add DATADOG_API_KEY your_key
slack env add DATADOG_APP_KEY your_key

# Run locally
slack run

# Create link triggers
slack trigger create --trigger-def triggers/declare_trigger.ts
slack trigger create --trigger-def triggers/resolve_trigger.ts
```

Post the shortcut URLs into any channel to start using the agent.

### Deploy to production

```bash
slack deploy
```

## 📄 License

MIT
