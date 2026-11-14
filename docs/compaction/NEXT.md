# Next steps and paste-ready prompts

## Priority order

1. Refresh chain-02 handoff/index if any file changed after validation.
2. Review and rebase/integrate worker1/0021 on 1.6.7.
3. Wire `DuelController`/`BedAssault` into `bots.ts` in a new reviewed contract.
4. Visible Technoblade lobby tier/UI; then bridge-aware navigation and planner.
5. Run the 0026 lag baseline; implement 0025 autobridge repair after approval.

## Worker open path — full, not shortened

```text
C:\Users\Kevin\.config\freebuff-desktop\local-projects\18fdee7d-1e3d-4a0e-8a37-9d9f0199b731\.agents\worker1\0021-clache-kevcraft-brand\workspace
```

Open that **workspace** folder as the Freebuff project. Do not open the main
checkout for a writer. worker2 is headless and has no folder. worker3's 0015 is
integrated and its workspace is empty/closed.

## worker1 prompt

```text
Read AGENT.md, HANDOFF.md, AGENTS.md, tasks/0021-clache-kevcraft-brand.md and
.agents/worker1/START-HERE.md. You are worker1. Work only in
C:\Users\Kevin\.config\freebuff-desktop\local-projects\18fdee7d-1e3d-4a0e-8a37-9d9f0199b731\.agents\worker1\0021-clache-kevcraft-brand\workspace
and only in the paths the contract allows. Follow the test-first steps.
Do not apply or integrate the diff, deploy, or restart any server. Report the
task id, files, exact commands with pass/fail, what you verified, what you did
not, and risks.
```

## Headless worker2 reviewer

No Freebuff chat. Start the loopback server if it is not already running:

```bash
CLI="$APPDATA/ai.opencode.desktop/cli/2.1.4-x64/opencode-cli.exe"
mkdir -p .agents/logs
"$CLI" serve --hostname 127.0.0.1 --port 4096 --print-logs \
  > .agents/logs/opencode-serve.log 2>&1 &
```

Then run the review after a fresh passing check:

```bash
PASS=$(sed -n 's/^server password //p' .agents/logs/opencode-serve.log | tail -1)
OPENCODE_SERVER_PASSWORD="$PASS" \
OPENCODE_MODEL='opencode/glm-5.3-flash-free#max' \
OPENCODE_AGENT='plan' \
bun run workflow review-external worker1 0021-clache-kevcraft-brand
```

The changed files are inlined and tools are disabled. A missing or empty report
is a failure. The report is advisory; the integrator still reads the diff.

## Current local build

- `http://127.0.0.1:3002` is the feedback server. LAN `:3000` (PID 3572) runs 1.6.7 at `http://10.47.1.88:3000`.
- Aquarium, Archway and Citadel are in the arena rotation.
- Online play is anonymous; there is no Freebuff sign-in or auth requirement.
- Spiral Tower parkour has 10 checkpoints; `?map=classic` keeps the tutorial.
- Ender/team chests work at the base stations; home forge splits among standing
  teammates; Expert guards closer; invisibility hides from bots; Bedrock bridge
  is manual (hold use + sneak + back).

## Recovered parkour scope

- Local default: Spiral Tower, 10 ordered checkpoints, three rounds, timer,
  chase camera, keyboard look.
- `?map=classic`: older five-checkpoint quartz spiral.
- No imported/copied Minecraft or Bloxd map assets; layouts only as references.
- Next: real browser playtest; then course variants/hub extraction.

## Upgrade Rush

- Implemented in 1.6.7: 2–8 FFA, 25 kills/10 min, 10 tiers, kill heals 6,
  death resets and removes own blocks, original Citadel/Aquarium/Archway rotation.
- Bots remain out of scope in 0011. A new contract is required for “+1 with bots
  and blocks.”
