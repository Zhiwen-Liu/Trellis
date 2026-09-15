/**
 * File-based advisory lock primitive — CLI compat re-export.
 *
 * The implementation lives in `core/channel/internal/store/lock.ts` (O_EXCL
 * creation, pid forensic + stale-lock recovery). This module keeps
 * `commands/channel/*` import paths stable.
 */

export * from "../../../core/channel/internal/store/lock.js";
