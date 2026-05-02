---
paths: ".claude/**"
---

# Skill / Slash Command Rules

## Skill description = trigger, not summary

The first line of a skill's frontmatter is what the harness uses to decide *when* to fire it. Write the trigger condition, not a flat description.

Bad:  `description: "Run QA tests on a web app"`
Good: `description: "Run when the user says 'qa', 'test this', 'find bugs', or after a perf-relevant deploy"`

## Folder layout, not single file

If a skill needs more than ~60 lines of guidance, split into:

```
.claude/skills/my-skill/
  SKILL.md        # entry point (trigger + high-level flow)
  references/     # detailed sub-docs loaded on demand
  scripts/        # shell helpers the skill invokes
  examples/       # input/output exemplars
```

## Goals not steps

Tell the skill *what done looks like*. Don't railroad the model with a 30-step bash chain — give it constraints and let it solve. Bash blocks don't share state across `Run` calls anyway.

## Detect, don't hardcode

- `main` vs `master`: `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`
- Package manager: check for `pnpm-lock.yaml`, `yarn.lock`, then `package-lock.json`
- Project type: read `package.json`, don't assume framework

## Gotchas section

Every skill SKILL.md ends with a `## Gotchas` section. Capture the bug-once-seen-again-recognized lessons, not the obvious flow.

## Token ceiling

If your SKILL.md crosses ~1.5K tokens, split. The harness loads it eagerly when the trigger fires; bloat costs every invocation.
