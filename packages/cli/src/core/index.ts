// Root barrel — re-exports the task public API so callers can
// `import { ... } from "../core/index.js"`. Sub-path imports
// (`../core/task/index.js`) remain the recommended form for
// tree-shake-friendly consumption.

export * from "./task/index.js";
