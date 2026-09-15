/**
 * Canonical task.json shape — single source of truth shared by all TS
 * writers. The canonical types and factory now live in the
 * core task API (`src/core/task/`); this module re-exports them under
 * the legacy `TaskJson` / `emptyTaskJson` names for CLI call sites.
 *
 * New code should prefer `TrellisTaskRecord` / `emptyTaskRecord` from
 * `../core/task/index.js` directly.
 */

import { emptyTaskRecord, type TrellisTaskRecord } from "../core/task/index.js";

export type TaskJson = TrellisTaskRecord;

export const emptyTaskJson = emptyTaskRecord;
