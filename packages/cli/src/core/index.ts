// Root barrel — re-exports the channel and task public APIs so callers
// can `import { ... } from "../core/index.js"`. Sub-path imports
// (`../core/channel/index.js`, `../core/task/index.js`) remain the
// recommended form for tree-shake-friendly consumption.

export * from "./channel/index.js";
export * from "./task/index.js";
