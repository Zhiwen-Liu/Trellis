---
name: contribute
description: "Guide for contributing to TrellisKerminal. Covers the single-repo layout, where docs and skill templates live, keeping README languages in sync, and submitting PRs to the fork. Use when someone wants to add or update documentation, add or modify a bundled/workflow skill template, or submit a PR to this project."
---

# Contributing to TrellisKerminal

TrellisKerminal is the Kerminal-only distribution of upstream
[mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis). Unlike upstream,
everything lives in **this one repo** — there is no separate docs repo and no
`marketplace/` submodule.

| What | Where in this repo |
|------|-------------------|
| User documentation | `docs/` (plain Markdown) |
| Readme / marketing | `README.md` + `README_CN.md` (root) |
| Workflow skills (`trellis-brainstorm`, `trellis-before-dev`, `trellis-check`, `trellis-break-loop`, `trellis-update-spec`) | `packages/cli/src/templates/common/skills/` |
| Bundled skills (`trellis-meta`, `trellis-spec-bootstrap`, `trellis-session-insight`, `trellis-channel`) | `packages/cli/src/templates/common/bundled-skills/` |
| Entry command skills (`trellis-start`, `trellis-continue`, `trellis-finish-work`) | `packages/cli/src/templates/common/commands/` |
| Kerminal platform files (`.kerminal/` content, incl. agent prompts) | `packages/cli/src/templates/kerminal/` |
| Shared `.trellis/` runtime (scripts, `workflow.md`, agents, task templates) | `packages/cli/src/templates/trellis/` |
| Spec markdown templates (seeded by `trellis init`) | `packages/cli/src/templates/markdown/spec/` |

## Golden Rule: Templates First

The copies at the repo root — `.kerminal/`, `.agents/skills/trellis-*`,
`.trellis/workflow.md`, `.trellis/scripts/` — are **generated dogfood output**,
not sources of truth.

1. Change the template under `packages/cli/src/templates/`.
2. Rebuild: `pnpm build` (runs `copy-templates` into `dist/`).
3. Run tests: `pnpm test` (template suites live in `packages/cli/test/templates/`).
4. Refresh this repo's own install: `trellis update`.

Editing the generated copies directly means the next `trellis update`
overwrites your work.

## Contributing Documentation

- Pages live in `docs/` as plain Markdown — edit them directly.
- `README.md` and `README_CN.md` must stay in sync: any change to one
  language needs the same change in the other.
- Keep the fork positioning accurate: TrellisKerminal = Kerminal-only,
  single npm package `trellis-kerminal`. Link upstream
  (mindfold-ai/Trellis) only for attribution, never as the place to file
  issues/PRs.

## Contributing a Skill or Workflow Change

1. Locate the template directory (table above).
2. Follow the existing skill format: `SKILL.md` with YAML frontmatter
   (`name`, `description`), optional `references/` for detail docs.
3. Platform-tagged content: `workflow.md` and step details are filtered by
   `--platform kerminal`; when adding platform blocks, tag them
   `[Kerminal]` / `[/Kerminal]`.
4. Rebuild + test (`pnpm build && pnpm test`), then refresh the dogfood
   install (`trellis update`) and inspect the generated diff.

## Contributing a Spec Template

Spec seeds for *user projects* live in
`packages/cli/src/templates/markdown/spec/`. This repo's own specs live in
`.trellis/spec/` and are project-local knowledge, not shipped templates —
update them via the `trellis-update-spec` workflow rather than editing
indexes by hand.

## Development Setup

```bash
pnpm install        # workspace deps
pnpm build          # tsc + copy-templates
pnpm test           # vitest (unit + integration + template tests)
pnpm lint           # ESLint
pnpm -C packages/cli lint:py   # basedpyright for Python templates/scripts
```

## Submitting a PR

1. Fork [Zhiwen-Liu/TrellisKerminal](https://github.com/Zhiwen-Liu/TrellisKerminal) and clone your fork.
2. Branch from `main`: `git checkout -b feat/your-change`.
3. Make the change in `packages/cli/src/templates/` (or `docs/`, `README*`).
4. Run checks: `pnpm lint && pnpm typecheck && pnpm test`.
5. Commit with a conventional message, e.g. `docs(readme): ...`,
   `feat(kerminal): ...`, `fix(cli): ...`.
6. Push and open a PR against `main`.

## Checklist Before PR

- [ ] Change made in the template source, not the generated copy
- [ ] `pnpm build && pnpm test` pass
- [ ] Dogfood install refreshed with `trellis update` (for template changes)
- [ ] README.md and README_CN.md updated in sync (for user-facing changes)
- [ ] No references to removed upstream structure (docs repo, `marketplace/`,
      other AI platforms) introduced
- [ ] Conventional commit message
