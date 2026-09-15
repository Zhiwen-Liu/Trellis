/**
 * Public surface for the core mem module — reusable retrieval and
 * dialogue-context extraction over persisted Claude Code / Codex / Devin CLI /
 * OpenCode sessions.
 *
 * This module is intentionally NOT re-exported from the `src/core/`
 * root barrel. Import it explicitly:
 *
 *   import { searchMemSessions } from "../core/mem/index.js";
 *
 * v1 scope: persisted-session search and context extraction only. It does not
 * read channel / forum / thread event logs and has no cursor / pagination.
 */

export {
  listMemSessions,
  searchMemSessions,
  extractMemDialogue,
  MemSessionNotFoundError,
} from "./sessions.js";

export { readMemContext } from "./context.js";

export { listMemProjects } from "./projects.js";

export { MEM_SOURCE_KINDS } from "./types.js";

export type {
  MemSourceKind,
  MemSourceFilter,
  MemPhase,
  DialogueRole,
  DialogueTurn,
  MemFilter,
  MemSessionInfo,
  SearchExcerpt,
  SearchHit,
  MemWarning,
  MemSearchMatch,
  MemSearchResult,
  MemContextTurn,
  MemContextResult,
  BrainstormWindow,
  MemDialogueGroup,
  MemExtractResult,
  MemProjectSummary,
  ListMemSessionsOptions,
  SearchMemSessionsOptions,
  ReadMemContextOptions,
  ExtractMemDialogueOptions,
  ListMemProjectsOptions,
} from "./types.js";
