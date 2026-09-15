# Uninstall Scrubbers

How `trellis uninstall` removes Trellis-managed content from **shared config files** so that Trellis-emitted fields are removed while user-added neighbors stay intact.

The scrubbers live in `utils/uninstall-scrubbers.ts`. They are pure functions — they do no I/O, take a file's content as input, and return new content plus a `fullyEmpty` flag. Shared dispatch/planning lives in `utils/managed-removal.ts`; `commands/uninstall.ts:uninstall` retains permanent-removal UX and execution policy (see `commands-uninstall.md`).

> **0.7.0 single-platform note**: the Kerminal-only registry collapse removed the per-platform configurators (Claude, Codex, Cursor, OpenCode, Pi, …) and their scrubbers with them. What remains is the one structured file TrellisKerminal still writes into user projects: `AGENTS.md`. The legacy scrubbers can be found in git history (≤ 0.6.20) if a legacy-project migration ever needs them again.

---

## Overview

### Why paragraph-level, not whole-file delete

TrellisKerminal writes exactly one **shared** file: `AGENTS.md`. Trellis owns the managed block inside it; the user (and other tooling) may add arbitrary content around it. Deleting the file outright would destroy user instructions, and leaving it alone would leave a stale Trellis block pointing at deleted `.trellis/` scripts.

The scrubber walks the file's structure, drops only the Trellis-owned block, and reports whether anything meaningful remains.

### Contract with the caller

The caller (`utils/managed-removal.ts:buildManagedRemovalPlan`) is responsible for:

- Reading the file off disk and passing its raw text to the scrubber.
- Comparing `fullyEmpty` from the result: if `true`, the file is queued for deletion; if `false`, the new content is written back.

Scrubbers themselves never touch the filesystem. They never log. They return.

---

## Scrubber interface

```ts
interface ScrubResult {
  content: string;     // post-scrub text to write back
  fullyEmpty: boolean; // true → caller should delete the file instead of writing
}
```

### Universal invariants

Every scrubber holds the following:

- **Input may be malformed** — if the managed markers are absent or mismatched, return `{ content, fullyEmpty: false }`. The caller's outer flow then writes the file back unchanged. We never half-rewrite.
- **Output is canonicalized** — blank-line runs left by removals collapse, trailing blanks trim, and the result ends with a single newline when non-empty.
- **No throws** — scrubbers must not propagate exceptions; surface "I couldn't scrub this" via `fullyEmpty: false` plus original `content`.
- **No side effects** — no `fs.*`, no `console.*`, no network. Pure function over the input text.

---

## The one scrubber

### `utils/uninstall-scrubbers.ts:scrubManagedMarkdownBlock`

Signature: `(content: string, startMarker: string, endMarker: string) → ScrubResult`.

Removes the Trellis-managed block delimited by `TRELLIS_BLOCK_START` / `TRELLIS_BLOCK_END` (the same markers `AGENTS.md` was written with, defined in `utils/managed-paths.ts`):

1. Locate `startMarker`. If absent → return input unchanged.
2. Locate `endMarker` **after** the start. If absent → malformed pair; return input unchanged.
3. Splice out `[start, end + endMarker.length)`.
4. Collapse `\n{3,}` runs to `\n\n`, trim trailing whitespace, re-add a single trailing newline if anything remains.
5. `fullyEmpty` iff the normalized result has no non-whitespace content.

Everything outside the block — user instructions, other tools' managed blocks, blank gaps — survives byte-for-byte (modulo blank-line collapsing adjacent to the removed block).

---

## Fails-closed planning gate

`utils/managed-removal.ts:buildManagedRemovalPlan` adds a strictness guard on top: in `strictPaths` mode, if a structured file looks modified but the scrubber changed nothing (`!result.fullyEmpty && result.content === content`), the planner throws `Cannot prove Trellis content was removed from structured file: <path>`. This catches the case where the file contains a Trellis marker pair the scrubber could not confidently remove — uninstall aborts instead of silently shipping a stale block.

---

## Testing

`test/utils/uninstall-scrubbers.test.ts` covers: managed block removed / user markdown preserved · `fullyEmpty` when only the block remains · malformed marker pairs untouched · marker-free files untouched. `test/utils/managed-removal.test.ts` covers the planner gate and the symlink/strict-path policy.
