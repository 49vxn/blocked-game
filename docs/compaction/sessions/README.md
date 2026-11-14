# Session handoffs

Chain-numbered handoffs written by `.agents/skills/before-compaction/SKILL.md`.
One file per compaction, context reset or handoff. Never edit an old handoff;
write the next number.

- Naming: `YYYY-MM-DD-NN.md` (NN is the next number for that date).
- Checker: `bun scripts/before-compaction.ts check <file>`.
- The latest handoff is the entry point after a reset; `docs/STATE.md` remains
  the source of truth for runtime and `tasks/README.md` for work status.
- Raw collector output stays in `.agents/handoff/<timestamp>/` (local, ignored);
  this folder contains only the curated handoff.

## Index

| Chain | At | Trigger | Summary | File |
|---|---|---|---|---|
| 01 | 2026-11-03 09:42 NZDT | context checkpoint | Built the pre-compaction skill + collector; 439/42 green, both hosts 1.6.7 | [2026-11-03-01.md](2026-11-03-01.md) |
| 02 | 2026-11-03 09:45 NZDT | context checkpoint | Removed Freebuff auth; anonymous production host/join verified; Citadel, clock, pillar fix, workspace cleanup | [2026-11-03-02.md](2026-11-03-02.md) |
