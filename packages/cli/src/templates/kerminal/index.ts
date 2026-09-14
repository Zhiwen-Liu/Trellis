/**
 * Kerminal template module.
 *
 * Kerminal is a class-2 pull-based platform with sub-agent support:
 * - Workflow + bundled skills go to the shared `.agents/skills/` root via
 *   the neutral resolver (byte-identical to Codex/Gemini/Pi/dsh writes).
 * - User-invocable entry points (`trellis-start` / `trellis-continue` /
 *   `trellis-finish-work`) and the Trellis agent prompts
 *   (trellis-implement / trellis-check / trellis-research) live under
 *   `.kerminal/skills/<name>/SKILL.md`. Kerminal has no project-level
 *   sub-agent registry, so the main session loads an agent skill and spawns
 *   a generic sub-agent whose prompt is the skill content.
 * - Operator guide `.kerminal/KERMINAL.md`.
 *
 * Kerminal has no shipped session-start hook, so `trellis-start` is kept as a
 * user-invocable skill. Kerminal auto-injects the project `AGENTS.md` into
 * spawned sub-agents; task context is pulled through the pull-based prelude.
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";

const { readTemplate, listMdAgents } = createTemplateReader(import.meta.url);

/** Operator guide copied to `.kerminal/KERMINAL.md`. */
export function getKerminalGuide(): string {
  return readTemplate("KERMINAL.md");
}

/** Trellis agent prompts (trellis-implement, trellis-check, trellis-research),
 *  installed as Kerminal skills for generic sub-agent dispatch. */
export function getAllAgents(): AgentTemplate[] {
  return listMdAgents();
}
