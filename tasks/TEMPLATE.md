# Task NNNN — short title

Status: backlog | ready | blocked | in-progress | review | done
Owner: unassigned
Created: YYYY-MM-DD
Depends on: <task ids, frozen interfaces or human decision>

## Goal

One observable result. Say who experiences it and what changes for them.

## Source of truth

- Spec/design: <link>
- Relevant research: <link>
- Decisions already made: <link>

## Ownership

- Workspace: `.agents/<agent>/NNNN-short-title/`
- Files allowed to change: <exact paths>
- Off-limits: <exact paths or "everything else">
- Shared interface owner: <name or "integrator">

## Contract

- Inputs/outputs:
- Behavior and edge cases:
- Performance or compatibility constraints:
- What must not change:
- Out of scope:

## Acceptance checks

- [ ] Observable behavior: ...
- [ ] Edge case: ...
- [ ] Focused test: `bun test tests/<file>.test.ts`
- [ ] Typecheck: `bun run typecheck`
- [ ] Full suite if core: `bun test`
- [ ] Build if client/server: `bun run build:node`
- [ ] Live/browser check if UI or controls: ...

## Test-first steps

1. Add/update the test in: <paths>
2. Run: `<command>`
3. Confirm it fails for the expected reason.
4. Implement the smallest change that passes.
5. Rerun the focused test and typecheck.
6. Do not weaken or rewrite the accepted assertion to get green.

## Review checklist

- [ ] Only allowed files changed.
- [ ] Behavior matches the contract and edge cases.
- [ ] Tests are present and meaningful; no weakened assertions.
- [ ] No unrelated refactor, rename, dependency or formatting noise.
- [ ] No secrets, `dist/`, logs or generated files.
- [ ] Reported commands match actual output.
- [ ] Performance claims measured in the same environment.
- [ ] Known gaps listed.

## Completion report

- Task:
- Status: done | blocked | needs-review
- Files changed:
- Commands run: <command> -> pass/fail, key output
- What was verified:
- What was not verified:
- Known risks:
- Next action:
