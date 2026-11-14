# Agent notes: tasks

Executable work contracts and the live board.

- `README.md` — statuses, the board and ownership rules.
- `TEMPLATE.md` — copy this for every new task.
- `NNNN-slug.md` — one contract per task.

Rules:

- Do not start implementation without a filled contract.
- The contract owns the allowed file list; everything else is off-limits.
- One writer per file across all active tasks.
- A task is not done until the diff is reviewed, applied and verified.
- Use the same task id for the agent workspace:
  `.agents/<agent>/<task-id>/workspace`.

Current important contracts:

The live board (`README.md`) is the source of truth; do not duplicate statuses here.

- `0002` is blocked/superseded by Q-030. `0011` is ready and unstarted.
- `0013`–`0024` are done except `0021`, which is blocked on workspace drift
  (see `../URGENT.md`).
