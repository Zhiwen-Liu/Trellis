# Quick Start

TrellisKerminal brings the Trellis engineering framework (specs, tasks, and
memory persisted in your repo) to Kerminal projects. It ships as a single npm
package, `trellis-kerminal`.

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.9
- **Kerminal** installed and on your PATH

## Install

```bash
npm install -g trellis-kerminal@latest
```

This provides the `trellis` command (alias `tl`).

## Initialize a project

```bash
cd your-repo
trellis init --kerminal -u your-name
```

Kerminal only reads project-level configuration in a directory containing
`.git`. If your project is not a git repo yet, `trellis init` offers to run
`git init` for you (and warns about the requirement in non-interactive runs).

The init writes:

- `.kerminal/skills/` — entry skills (`trellis-start`, `trellis-continue`,
  `trellis-finish-work`) and the Trellis agent prompts used for sub-agent
  dispatch (`trellis-implement`, `trellis-check`, `trellis-research`)
- `.agents/skills/` — shared workflow skills (`trellis-brainstorm`,
  `trellis-before-dev`, `trellis-check`, `trellis-break-loop`,
  `trellis-update-spec`) plus bundled meta skills
- `.kerminal/KERMINAL.md` — the operator guide
- `.trellis/` — specs, task tracking, workspace memory, and the Python
  scripts the skills invoke
- `AGENTS.md` — a Trellis-managed block pointing the agent at the `.trellis/`
  knowledge base

## Your first task

Open the project root in Kerminal and describe what you want in natural
language. The agent loads the `trellis-start` skill, which reads the current
task state and routes the work:

1. **Start** — load `trellis-start`; unclear requirements route to
   `trellis-brainstorm`, which asks questions one at a time and writes the
   task PRD under `.trellis/tasks/`.
2. **Implement** — when the PRD is clear, load `trellis-before-dev`; the agent
   dispatches a `trellis-implement` sub-agent that writes the code.
3. **Check** — when coding is done, load `trellis-check`; a check sub-agent
   reviews the diff against your specs and runs lint / type-check / tests.
4. **Finish** — say "finish the trellis task" (Kerminal has no slash palette,
   so `/trellis:finish-work` becomes a plain request) and the agent loads
   `trellis-finish-work`, which archives the task and updates the workspace
   journals. Learnings worth keeping route to `trellis-update-spec`.

You can ask for any of these skills by name at any time (e.g. "load
trellis-start").

## Updating

```bash
# Upgrade the global CLI package
npm install -g trellis-kerminal@latest

# Refresh the Trellis files inside a project (templates, scripts, skills)
trellis update
```

- `trellis update` refreshes what Trellis writes into your project; it never
  touches your specs' content or your tasks.
- `trellis upgrade` is a convenience wrapper that runs the npm global install
  for you.

See the [Kerminal reference](./kerminal.md) for how the platform integration
works.
