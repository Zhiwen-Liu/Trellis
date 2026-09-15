/**
 * Channel paths — CLI compat re-export.
 *
 * The implementation lives in `core/channel/internal/store/paths.ts`; this
 * module keeps `commands/channel/*` import paths stable. CLI-only code must
 * import through this shim, never from core's internal path directly.
 */

export * from "../../../core/channel/internal/store/paths.js";
