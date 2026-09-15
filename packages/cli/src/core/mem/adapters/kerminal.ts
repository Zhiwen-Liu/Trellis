/**
 * Persisted Kerminal session reader.
 *
 * Kerminal stores Codex-format rollout JSONL under
 * `~/.kerminal/sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl` with
 * `originator: kerminal_cli_rs` — same event schema (`session_meta`,
 * `response_item`, `event_msg`, `compacted`). The parsing engine therefore
 * lives in `codex.ts` as the parameterized rollout reader; this module binds
 * it to the Kerminal root and platform tag.
 */

import { searchInDialogue } from "../search.js";
import type {
  DialogueTurn,
  MemFilter,
  MemSessionInfo,
  MemWarning,
  SearchHit,
  TaskPyEvent,
} from "../types.js";
import {
  collectRolloutTurnsAndEvents,
  listRolloutSessions,
  KERMINAL_READER,
} from "./codex.js";

export function kerminalListSessions(f: MemFilter): MemSessionInfo[] {
  return listRolloutSessions(KERMINAL_READER, f);
}

export function kerminalExtractDialogue(
  s: MemSessionInfo,
  warnings?: MemWarning[],
): DialogueTurn[] {
  return collectRolloutTurnsAndEvents(KERMINAL_READER, s, warnings).turns;
}

export function kerminalSearch(s: MemSessionInfo, kw: string): SearchHit {
  // No warnings sink: search fans out over the whole corpus and a per-session
  // notice would be printed thousands of times.
  return searchInDialogue(kerminalExtractDialogue(s), kw);
}

export function collectKerminalTurnsAndEvents(
  s: MemSessionInfo,
  warnings?: MemWarning[],
): {
  turns: DialogueTurn[];
  events: TaskPyEvent[];
} {
  return collectRolloutTurnsAndEvents(KERMINAL_READER, s, warnings);
}
