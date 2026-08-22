# Development Graph

Topology used by the Orchestrator + subagents to build the product. Node and edge
contracts live in `contracts/node-contracts/` and `contracts/edge-contracts/`; live
execution state in `state/graph-state.json`.

Current shape (refined as decisions land):

```text
Orchestrator/Architect → Wayfinder map → Grill/Domain Model → Research (×5)
  → Domain Model → Stage Normalization → Product Architecture
  → Node/Edge Contracts → Implementation → Verification → Validation
  → Testing → Deployment
```
