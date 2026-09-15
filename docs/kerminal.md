# TrellisKerminal on Kerminal — Platform Reference

Kerminal is a **class-2 pull-based** Trellis host: no session-start hook
auto-injects workflow context. Instead, the agent loads Trellis skills on
demand through its skill tool, prompted by the Trellis block in `AGENTS.md`.
This document is the reference for that integration.

| Capability | Status |
| --- | --- |
| Skills (`.agents/skills/trellis-*/SKILL.md`) | Works — Kerminal discovers this shared root natively |
| Entry skills (`.kerminal/skills/trellis-*/SKILL.md`) | Works — Kerminal's own project skill root |
| Context hooks | None — pull-based: skills read `.trellis/` files directly |
| Sub-agents | Works — generic dispatch: load an agent skill, spawn a sub-agent with its content; spawned agents auto-inject `AGENTS.md` |

## What `trellis init --kerminal` writes

- **`.kerminal/skills/`** — Kerminal-private entry skills:
  - `trellis-start` / `trellis-continue` / `trellis-finish-work` — the
    user-invocable entry points.
  - `trellis-implement` / `trellis-check` / `trellis-research` — the Trellis
    agent prompts, installed as skills so the main session can dispatch them
    to generic sub-agents.
- **`.agents/skills/`** — the shared workflow skills written into the
  cross-platform root: `trellis-before-dev`, `trellis-brainstorm`,
  `trellis-check`, `trellis-break-loop`, `trellis-update-spec`, plus the
  bundled `trellis-meta`, `trellis-spec-bootstrap`, and
  `trellis-session-insight` skills.
- **`.kerminal/KERMINAL.md`** — the operator guide (this reference's source).
- **`.trellis/`** — specs (`.trellis/spec/`), tasks (`.trellis/tasks/`),
  workspace memory (`.trellis/workspace/`), and the shared Python scripts the
  skills invoke (`get_context.py`, `task.py`, ...).
- **`AGENTS.md`** — a Trellis-managed instructions block pointing the agent at
  the `.trellis/` knowledge base.

Kerminal only reads project-level configuration (`AGENTS.md`, `.kerminal/`,
`.agents/skills/`) in a directory containing `.git`. Run `git init` in the
project root before launching a Kerminal session; `trellis init --kerminal`
offers to run `git init` interactively and warns in non-interactive runs.

## The pull-based model

- **No hooks.** Kerminal has no session-start hook, so nothing is injected
  automatically. Every workflow skill begins by pulling its context: it reads
  `.trellis/workflow.md`, the current task state, and the relevant spec files
  directly.
- **`trellis-start` stays user-invocable.** Because there is no hook to load
  it, the entry skill remains a first-class skill the user (or the agent)
  loads explicitly — by name, or when the Trellis block in `AGENTS.md`
  prompts it.
- Skill scripts pass `--platform kerminal` to `get_context.py`; the value is
  used as a platform-scoped context key.

## Sub-agent dispatch (generic)

Kerminal has no project-level sub-agent registry, so dispatch is generic:

1. The main session loads an agent skill (e.g. `trellis-implement` from
   `.kerminal/skills/trellis-implement/SKILL.md`).
2. It spawns a generic sub-agent whose initial message is the skill content,
   prefixed with:
   - `Active task: <path from task.py current>` as the **first line**.
   - A statement that the spawned agent is already `trellis-implement` (or
     `trellis-check`) and must do the work directly.
3. Spawned sub-agents automatically receive the project `AGENTS.md`; task
   context (active task path, specs, artifacts) is pulled via the pull-based
   prelude inside the skill.

### Recursion guard

Agent prompts carry a recursion guard: a `trellis-implement` /
`trellis-check` sub-agent must NOT spawn another `trellis-implement` or
`trellis-check`. If workflow breadcrumbs or the parent prompt say to
dispatch, that instruction is treated as already satisfied by the current
role. Only the main session dispatches Trellis implement/check agents; if a
sub-agent thinks more parallel work is needed, it reports that recommendation
instead of spawning.

## Context curation contract (jsonl)

Sub-agents do not read the whole spec tree. During the brainstorm phase, the
main session curates two jsonl files in the task directory:

- `implement.jsonl` — `{"file": ..., "reason": ...}` entries pointing at the
  `.trellis/spec/**/*.md` and task research files the implementer needs.
- `check.jsonl` — the same shape for the checker.

Rules:

- Curate spec and research documents only — never code files (code is read
  during implementation).
- The implement/check prelude loads exactly these files; entries pointing at
  missing paths fall back to `prd.md` with a stderr warning.
- A task stays in PLANNING status until at least one curated entry exists.

## Updating and uninstalling

- `npm install -g trellis-kerminal@latest` — upgrade the global CLI.
- `trellis upgrade` — the same thing via the CLI (channel-aware tag defaults,
  `--tag`, `--dry-run`).
- `trellis update` — refresh the Trellis-managed files inside a project
  (skills, agent prompts, `.trellis/` scripts and workflow.md, `AGENTS.md`
  managed block). Your spec content and tasks are never overwritten.
- `trellis uninstall` — permanently remove Trellis-managed surfaces from a
  project (asks before deleting anything it did not write itself).
