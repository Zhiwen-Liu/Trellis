/**
 * Kerminal configurator.
 *
 * Kerminal is a class-2 pull-based platform (agentCapable, no shipped
 * session-start hook, no project-level hooks/settings Trellis may write).
 * The Kerminal agent reads the project `AGENTS.md` (Trellis writes the
 * managed block at init) and loads skills by name through its skill tool,
 * discovering them from the project roots `<projectRoot>/.kerminal/skills`
 * and `<projectRoot>/.agents/skills` (agentskills.io shared standard).
 * Three output paths:
 * - `.agents/skills/` — workflow + bundled skills, written via the NEUTRAL
 *   resolver so the files stay byte-identical to Codex/Gemini/Pi/dsh/Kimi
 *   writes into the same shared root.
 * - `.kerminal/skills/` — Kerminal-private user-invocable entry skills
 *   (`trellis-start` / `trellis-continue` / `trellis-finish-work`),
 *   platform-resolved (`--platform kerminal`, `trellis-<name>` skill refs),
 *   in Kerminal's own project skill root.
 * - `.kerminal/KERMINAL.md` — operator guide; also gives the platform a
 *   configDir-owned tracked file so `trellis platforms` / `uninstall`
 *   can detect and scope Kerminal.
 *
 * Kerminal ships no project-level sub-agent definition surface, so no
 * trellis-implement / trellis-check / trellis-research agent prompts are
 * written; implement/check/research run inline through the workflow skills.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { AI_TOOLS } from "../types/ai-tools.js";
import { getKerminalGuide } from "../templates/kerminal/index.js";
import {
  collectSkillTemplates,
  resolveAllAsSkills,
  resolveBundledSkills,
  resolveSkillsNeutral,
  renderTemplateMap,
  writeTemplateMap,
  type PlatformConfigureOptions,
} from "./shared.js";

/**
 * Command templates that become user-invocable Kerminal skills
 * (`trellis-start` / `trellis-continue` / `trellis-finish-work`). Kerminal has
 * no slash-command palette, so the session-boundary commands are delivered
 * as SKILL.md files in `.kerminal/skills/`.
 */
const KERMINAL_COMMAND_SKILL_NAMES = new Set([
  "trellis-start",
  "trellis-continue",
  "trellis-finish-work",
]);

/** Session-boundary commands resolved as Kerminal skills (Kerminal-private
 *  root, so platform-specific `{{CLI_FLAG}}` / `{{CMD_REF}}` resolution is
 *  correct). */
function resolveKerminalCommandSkills(): ReturnType<typeof resolveAllAsSkills> {
  const ctx = AI_TOOLS.kerminal.templateContext;
  return resolveAllAsSkills(ctx).filter((skill) =>
    KERMINAL_COMMAND_SKILL_NAMES.has(skill.name),
  );
}

/**
 * The Kerminal file set — written at init and diffed by `trellis update`.
 */
export function collectKerminalTemplates(): Map<string, string> {
  const ctx = AI_TOOLS.kerminal.templateContext;
  const files = new Map<string, string>();

  // 1. Workflow + bundled skills → shared `.agents/skills/` (neutral
  //    rendering, byte-identical to Codex/Gemini/Pi/dsh/Kimi writes).
  for (const [filePath, content] of collectSkillTemplates(
    ".agents/skills",
    resolveSkillsNeutral(ctx),
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }

  // 2. Commands-as-skills → `.kerminal/skills/` (Kerminal-native project
  //    root).
  for (const [filePath, content] of collectSkillTemplates(
    ".kerminal/skills",
    resolveKerminalCommandSkills(),
  )) {
    files.set(filePath, content);
  }

  // 3. Operator guide → `.kerminal/KERMINAL.md`.
  files.set(".kerminal/KERMINAL.md", getKerminalGuide());

  return files;
}

/**
 * Configure Kerminal by writing `collectKerminalTemplates`, plus the one
 * piece of behavior a `Map<path, content>` cannot carry: Kerminal only loads
 * project-level instruction files (AGENTS.md, `.kerminal/`,
 * `.agents/skills/`) from directories it recognizes as a project — a
 * directory containing `.git`. In a non-git directory Trellis files are
 * written but never read, so init offers to run `git init` (interactive) or
 * warns (non-interactive) instead of failing silently.
 */
export async function configureKerminal(
  cwd: string,
  options?: PlatformConfigureOptions,
): Promise<void> {
  const files = renderTemplateMap(collectKerminalTemplates());
  await writeTemplateMap(cwd, files);

  let hasGit = true;
  try {
    hasGit = fs.existsSync(path.join(cwd, ".git"));
  } catch {
    return;
  }
  if (hasGit) return;
  if (process.env.VITEST || process.env.TRELLIS_QUIET) return;

  const interactive =
    Boolean(process.stdin.isTTY) && options?.nonInteractive !== true;
  if (interactive) {
    const confirmed = await confirm(
      `Kerminal only loads project-level configuration (AGENTS.md, ` +
        `.kerminal/, .agents/skills/) in a directory containing .git. ` +
        `Run \`git init\` in ${cwd} now? (Y/n) `,
    );
    if (confirmed) {
      const result = spawnSync("git", ["init"], { cwd, encoding: "utf-8" });
      if (result.status === 0) {
        process.stderr.write("✓ Initialized empty git repository\n");
        return;
      }
      process.stderr.write(
        `⚠️  git init failed (${(result.stderr ?? "").trim()}). ` +
          "Run `git init` manually, or Kerminal will ignore the Trellis " +
          "files that were just written.\n",
      );
      return;
    }
  }
  process.stderr.write(
    "⚠️  Kerminal only reads project-level configuration (AGENTS.md, " +
      ".kerminal/, .agents/skills/) in a directory containing .git. " +
      "Run `git init` in this project root, or Kerminal will ignore the " +
      "Trellis files that were just written.\n",
  );
}

/** Minimal readline yes/no prompt, defaulting to yes on empty input. */
function confirm(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(!/^n(o)?$/i.test(answer.trim()));
    });
  });
}
