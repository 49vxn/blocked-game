# Agent workspace layout

The project root is the integrator checkout. Writers never edit it directly.

```text
.agents/
  worker1/
    0021-clache-kevcraft-brand/
      workspace/          worker1's active full copy
      BRIEF.md
      PROMPT.md
  worker2/
    START-HERE.md         headless reviewer, no workspace
  worker3/
    0015-bot-tactics-technoblade-archive-2026-11-02/
                          integrated evidence/archive; no active workspace
  notes/
    opencodeagent4/       OpenCode session notes and probes, not source
  mailbox/                worker/integrator reports
  logs/                   local server, reviewer and probe logs
  skills/                 autonomous mission protocol
  buffy/                  integrator mission evidence
```

## Rules

- A writer opens **its own `workspace`** as the Freebuff project.
- The reviewer is headless and never gets a workspace.
- Scratch notes go under `.agents/notes/`; they never belong in the root.
- `_attic/` holds retired copies, old bundles and failed wiring attempts.
- `bots.ts` is read-only outside a reviewed integration.
- One writer per file; integration is serial.
- No agent restarts the LAN server or deploys without the integrator/human.

## Current state

- `worker1/0021` — active brand split, 12 changed files.
- `worker2` — headless GLM-5.3-Flash Free `#max` reviewer.
- `worker3/0015` — integrated; archive only, no workspace.
- `dist` and both hosts run 1.6.7.
