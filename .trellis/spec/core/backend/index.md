# Core Backend Guidelines

These guidelines apply to the core modules under `packages/cli/src/core/`
(merged into the single `trellis-kerminal` package at 0.7.0).

## Purpose

The core modules own reusable SDK/domain primitives that must stay
independent of CLI rendering and process-control concerns.

## Source Map

| Area | Path | Purpose |
| --- | --- | --- |
| Root exports | `packages/cli/src/core/index.ts` | Core root barrel (channel + task). Keep this small. |
| Channel API | `packages/cli/src/core/channel/` | Durable channel/event APIs, reducers, workers, inbox, runtime contracts. |
| Mem API | `packages/cli/src/core/mem/` | Persisted AI session readers, search, filtering, dialogue extraction, and project aggregation. |
| Task API | `packages/cli/src/core/task/` | Reusable task record, schema, phase, and path helpers. |
| Testing API | `packages/cli/src/core/testing/` | Public test helpers intended for package consumers. |
| Tests | `packages/cli/test/core/` | Core-owned unit/integration coverage. |

## Contracts

- Core APIs must not print terminal output, call `process.exit`, parse CLI argv,
  or depend on Chalk / Commander / Inquirer.
- CLI code must import core through the public entry points such as
  `../core/channel/index.js`, not deep paths under `src/core/*/internal/`.
- There is one package and one version; core and CLI ship together.
- Detailed boundary rules currently live in
  `.trellis/spec/cli/backend/trellis-core-sdk.md`; keep this file and that
  boundary spec consistent.

## Pre-Development Checklist

- Read `.trellis/spec/cli/backend/trellis-core-sdk.md` before editing
  `packages/cli/src/core/**` or moving logic between CLI and core.
- Read `.trellis/spec/cli/unit-test/conventions.md` before adding or changing
  core tests.
- For channel changes, also read
  `.trellis/spec/cli/backend/commands-channel.md`.
- For mem changes, also read `.trellis/spec/cli/backend/commands-mem.md`.

## Quality Check

Run the package checks that match the change:

```bash
pnpm -C packages/cli lint
pnpm -C packages/cli typecheck
pnpm -C packages/cli test
```
