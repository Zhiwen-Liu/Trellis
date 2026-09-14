/**
 * Kerminal template module.
 *
 * Kerminal is a class-2 pull-based, skills-only platform:
 * - Workflow + bundled skills go to the shared `.agents/skills/` root via
 *   the neutral resolver (byte-identical to Codex/Gemini/Pi/dsh writes).
 * - User-invocable entry points (`trellis-start` / `trellis-continue` /
 *   `trellis-finish-work`, loaded by the Kerminal agent through its skill
 *   tool) live under `.kerminal/skills/<name>/SKILL.md` — Kerminal's own
 *   project skill root.
 * - Operator guide `.kerminal/KERMINAL.md`.
 *
 * Kerminal has no shipped session-start hook, so `trellis-start` is kept as a
 * user-invocable skill. Kerminal ships no project-level sub-agent definition
 * surface, so no trellis-implement / trellis-check / trellis-research agent
 * prompts are written; implement/check/research run inline through the
 * workflow skills.
 */

import { createTemplateReader } from "../template-utils.js";

const { readTemplate } = createTemplateReader(import.meta.url);

/** Operator guide copied to `.kerminal/KERMINAL.md`. */
export function getKerminalGuide(): string {
  return readTemplate("KERMINAL.md");
}
