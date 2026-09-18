# Core Module Boundary

> Boundary and coding rules for `src/core/` inside the single `trellis-kerminal`
> package. (This doc formerly described the `@zhiwenliu/trellis-core` package
> boundary; the SDK was merged into the CLI package at 0.7.0.)

---

## Overview

TrellisKerminal ships one npm package (`trellis-kerminal`, source under
`packages/cli/`). Inside it, code is split into two layers:

| Layer | Location | Responsibility |
|---|---|---|
| Core | `packages/cli/src/core/` | Reusable domain logic, task record APIs, mem retrieval, and typed contracts. |
| CLI | everything else under `packages/cli/src/` | CLI argument parsing, terminal rendering, command wiring, process exit behavior, template installation, migrations, and release scripts. |

The CLI should be a thin shell around core where a capability needs to be
shared with other integrations. Core code must stay independent of terminal
UX and CLI process control.

---

## Module boundary

Core owns:

- task record helpers that are useful outside the CLI
- structured types shared by CLI code and tests
- pure validation and normalization logic that should not depend on Commander or Chalk
- the `mem` retrieval domain under `packages/cli/src/core/mem/`: persisted-session readers (Claude Code / Codex / OpenCode), search and relevance scoring, dialogue-context extraction, brainstorm-phase slicing, and project aggregation

CLI owns:

- command definitions and option parsing (including `tl mem` argv parsing)
- help text and terminal output (including `tl mem` row formatting and `--json` shaping)
- prompts, confirmations, exit codes, and `process.exit`
- the OpenCode-unavailable stderr notice for `tl mem` (a presentation concern, not a core one)
- template copying, template paths, migration manifest application, and update UX
- release scripts and CI-specific orchestration

When logic starts in the CLI but is needed by another integration or
embedding app, move the reusable part into `src/core/` and leave only CLI
rendering and option translation in the CLI layer.

---

## Import rules

CLI code must import core through the core public entry points:

```ts
import { loadTaskRecord } from "../core/task/index.js";
```

Do not deep-import core internals:

```ts
// forbidden
import { loadTaskRecord } from "../core/task/records.js";
```

### Public entry points

Core exposes domains as explicit directories, not from one root barrel:

```ts
import { loadTaskRecord } from "../core/task/index.js";
import { searchMemSessions } from "../core/mem/index.js";
```

`mem` is public as the `src/core/mem/` module only. It is intentionally
**not** re-exported from the `src/core/index.ts` root barrel — that keeps the
root API small and stops `DialogueTurn` / `SearchHit` / `MemFilter` from
leaking into the root surface. The `mem` public API is `listMemSessions`,
`searchMemSessions`, `readMemContext`, `extractMemDialogue`,
`listMemProjects`, plus their input/output types and `MemSessionNotFoundError`.
Anything under `packages/cli/src/core/mem/internal/` (JSONL/path helpers) is
private and must not be deep-imported by CLI code.

The `mem` domain follows the same core API rules as the rest of core: no
`zod`, no `console.*`, no `process.exit`. Structured search/context/extract
results carry a `warnings` array; list/projects preserve their historical
array return types and expose warnings through an optional `onWarning`
callback. The CLI decides how to surface warnings and what exit code to use.

---

## Core API design

Core APIs return structured values and throw typed, domain-specific errors
when callers need to handle failures.

Core APIs must not:

- call `process.exit`
- print terminal output
- depend on Chalk, Commander, Inquirer, or CLI-only helpers
- read CLI argv directly
- assume the current working directory unless the API contract says so

Prefer small composable functions over one function that parses options,
mutates storage, and formats output. The CLI can compose the pieces for
user-facing commands.

---

## Storage and state

State transitions should have one owner. When core owns a persisted shape, the
schema, its validation, and the typed I/O helpers all live in core — the task
record is the current example (`core/task/schema.ts` defines the shape;
`loadTaskRecord` / `writeTaskRecord` in `core/task/records.ts` read and write
it). CLI commands call those APIs and render results.

Do not duplicate shape or validation rules across command files. Add a core
helper instead, then use it from the CLI.

---

## Build and typecheck contract

Core is plain source inside the package — no separate build step. One
`tsc` run compiles `src/**/*` (including `src/core/**`) and one `tsc --noEmit`
typechecks it:

```bash
pnpm -C packages/cli build
pnpm -C packages/cli typecheck
```

---

## Versioning contract

There is one package and one version. `bump-versions.js` updates
`packages/cli/package.json`; CI verifies the package version matches the git
tag, publishes the single package, and verifies it on npm.

Release/versioning details live in `release-process.md`.

---

## Tests

Core behavior should be tested under `packages/cli/test/core/` when the
behavior can run without CLI rendering. CLI tests should cover option
parsing, terminal output, command orchestration, and integration with
template/migration flows.

If a CLI test duplicates a pure core test, move the pure assertion to the
core suite and keep only the CLI-specific behavior in the CLI test.

`mem` is the worked example of this rule: the pure retrieval/search/phase/adapter
tests live in `packages/cli/test/core/mem/**`, while
`packages/cli/test/commands/mem-*.test.ts` keeps only CLI-wrapper coverage —
argv parsing, `--json` output shape, exit behavior, and the OpenCode warning.

## Boundary: core task schema vs .trellis Python scripts

`packages/cli/src/core/task/schema.ts` is the single TS-side source of truth
for the `task.json` shape (including `meta: Record<string, unknown>` with its
own validation). The `.trellis/scripts/` Python layer implements *behavior*
on top of that shape (create/list/set-meta/validate/journal rendering) and
has NO parallel implementation in core — jsonl validation, list tree
rendering, and journal rendering exist only in Python.

Rule of thumb when changing task behavior:

- New/changed `task.json` **field or shape** → update `schema.ts` AND the
  Python writers together.
- New **behavior** on existing fields (flags, rendering, warnings) → Python
  (template + dogfood copies) only; core needs nothing.
- The only template code with a genuine dual implementation is sub-agent
  context injection (Python shared hook ↔ Pi extension) — see the Context
  Injection Limits Contract in platform-integration.md.
