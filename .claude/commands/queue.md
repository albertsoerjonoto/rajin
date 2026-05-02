---
description: Manage .claude/queue.md - add, list, or pop the next task
argument-hint: "[add <task>] | [list] | [next]"
---

Operate on `.claude/queue.md`.

If the user typed `/queue add <task>`:
- Insert `- [ ] <task>` at the top of the `## Next up` section (newest first).
- Save and confirm with the new top entry.

If the user typed `/queue list`:
- Print the current queue (Next up + Stuck + last 5 of Done).
- No edits.

If the user typed `/queue next` (or no args):
- Print the top "Next up" task.
- Don't pop — `/loop-once` does the popping.

If the user typed `/queue done <PR-url>`:
- Move the top "Next up" item to `## Done` with the PR link.

Don't reorder existing items unless explicitly asked.
