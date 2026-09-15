<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

**Session start / resume**: this platform has no session-start hook, so load the entry skills explicitly:

- Starting a session (or when the user opens a new one) → load the `trellis-start` skill (`.kerminal/skills/trellis-start/SKILL.md`) and follow its steps.
- The user wants to resume the current task → load `trellis-continue` (`.kerminal/skills/trellis-continue/SKILL.md`).
- The user says "finish the trellis task" or the session is wrapping up → load `trellis-finish-work` (`.kerminal/skills/trellis-finish-work/SKILL.md`).

Additional project-scoped helpers live in:
- `.agents/skills/` — reusable Trellis skills (brainstorm, before-dev, check, break-loop, update-spec, bundled skills)
- `.kerminal/skills/` — Kerminal entry skills and Trellis agent prompts (trellis-implement / trellis-check / trellis-research are skills here: load the skill content and spawn a generic sub-agent with it)

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
