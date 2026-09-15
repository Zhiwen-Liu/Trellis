# Trellis on Kerminal

Kerminal is a **class-2 pull-based** Trellis host: no session-start hook
auto-injects workflow context, so the agent loads the Trellis skills on demand
through its skill tool (prompted by the Trellis block in `AGENTS.md`).

| Capability | Status |
| --- | --- |
| Skills (`.agents/skills/trellis-*/SKILL.md`) | Works — Kerminal discovers this shared root natively |
| Entry skills (`.kerminal/skills/trellis-*/SKILL.md`) | Works — Kerminal's own project skill root |
| Context hooks | None — pull-based: skills read `.trellis/` files directly |
| Sub-agents | Works — generic dispatch: load an agent skill, spawn a sub-agent with its content; spawned agents auto-inject `AGENTS.md` |

## Quick start

```bash
trellis init --kerminal -u your-name
kerminal   # open a session in the project root
```

In Kerminal:

1. Describe the work in natural language. For a new task the agent should load
   the `trellis-start` skill, which reads the current task state from
   `.trellis/` and routes to `trellis-brainstorm` (unclear requirements),
   `trellis-before-dev` (about to write code), `trellis-check` (done coding),
   or `trellis-update-spec` (learned something worth capturing).
2. Entry skills are `trellis-start` / `trellis-continue` /
   `trellis-finish-work` in `.kerminal/skills/`. You can also ask for them by
   name at any time (e.g. "load trellis-start").
3. `/trellis:finish-work` is a slash-command convention from other hosts —
   Kerminal has no slash palette, so say "finish the trellis task" instead,
   and the agent loads `trellis-finish-work`.

## File map

- `.agents/skills/` — auto-triggered workflow skills (`trellis-before-dev`,
  `trellis-brainstorm`, `trellis-check`, `trellis-break-loop`,
  `trellis-update-spec`) plus the bundled `trellis-meta` /
  `trellis-spec-bootstrap` / `trellis-session-insight` skills. Byte-identical
  to Codex / Gemini CLI / Pi / dsh writes into the same shared root.
- `.kerminal/skills/` — Kerminal-private entry skills (`trellis-start` /
  `trellis-continue` / `trellis-finish-work`) and the Trellis agent prompts
  (`trellis-implement` / `trellis-check` / `trellis-research`) used for
  generic sub-agent dispatch.
- `.trellis/` — specs, tasks, workspace memory, and the shared scripts the
  skills invoke (`get_context.py`, `task.py`, ...).
- `AGENTS.md` — Trellis-managed instructions block pointing the agent at the
  `.trellis/` knowledge base.

## Notes

- Kerminal only reads project-level configuration (`AGENTS.md`, `.kerminal/`,
  `.agents/skills/`) in a directory containing `.git`. Run `git init` in the
  project root before launching a Kerminal session; `trellis init --kerminal`
  offers to run `git init` interactively and warns in non-interactive runs.
- Sub-agent dispatch: Kerminal has no project-level sub-agent registry, so
  the main session loads an agent skill (e.g. `trellis-implement`) and
  spawns a generic sub-agent whose prompt is the skill content, starting
  with `Active task: <path>`. Spawned sub-agents automatically receive the
  project `AGENTS.md`; task context is pulled via the pull-based prelude.
- Skill scripts pass `--platform kerminal` to `get_context.py`; the value is
  used as a platform-scoped context key.
