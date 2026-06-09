# Architecture

```mermaid
flowchart TD
    DT["🔗 Declare Trigger\n(link trigger)"]
    RT["🔗 Resolve Trigger\n(link trigger)"]

    DW["IncidentDeclaredWorkflow"]
    RW["IncidentResolvedWorkflow"]

    SC["search_context"]
    PI["prepare_incident"]
    CC["CreateChannel\n(Slack native function)"]
    WR["create_war_room"]
    PO["page_oncall"]
    FM["fetch_metrics"]
    DP["draft_postmortem"]

    SLACK_API["Slack API\n(search, history, channels)"]
    PD["PagerDuty REST API"]
    DD["Datadog Monitors API"]
    AI["Anthropic AI\n(Claude)"]
    DS["Slack Datastore\n(Incidents)"]

    DT --> DW
    RT --> RW

    DW --> SC
    DW --> PI
    PI --> CC
    CC --> WR
    WR --> PO
    WR --> FM

    RW --> DP

    SC --> SLACK_API
    SC --> AI
    WR --> DS
    PO --> PD
    FM --> DD
    DP --> SLACK_API
    DP --> DS
    DP --> AI
```
