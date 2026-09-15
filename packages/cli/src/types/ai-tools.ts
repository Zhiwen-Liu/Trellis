/**
 * AI Tool Types and Registry
 *
 * Defines supported AI coding tools and which command templates they can use.
 *
 * This fork evolves the Kerminal integration only. Upstream Trellis (0.6.x)
 * supported 23 platforms; the registry here is collapsed to the single
 * Kerminal entry while keeping the registry shape (AIToolConfig /
 * TemplateContext / derived helpers) intact.
 */

/**
 * Supported AI coding tools
 */
export type AITool = "kerminal";

/**
 * Template directory categories
 */
export type TemplateDir = "common" | "kerminal";

/**
 * CLI flag names for platform selection
 * Must match keys in InitOptions (src/commands/init.ts)
 */
export type CliFlag = "kerminal";

/**
 * Template context for placeholder resolution.
 * Controls how common templates are rendered per platform.
 */
export interface TemplateContext {
  /** Prefix for cross-referencing other commands/skills */
  cmdRefPrefix:
    | "/trellis:"
    | "/trellis-"
    | "$"
    | "/"
    | "/skill trellis-"
    | "/skill:trellis-"
    | "trellis-";
  /** Description of AI executor actions shown in role tables */
  executorAI:
    | "Bash scripts or Task calls"
    | "Bash scripts or tool calls"
    | "Bash scripts or Agent calls"
    | "Bash scripts or file reads";
  /** Label for user-invocable actions */
  userActionLabel:
    | "Slash commands"
    | "Skills"
    | "Workflows"
    | "Prompts"
    | "Commands";
  /** Platform supports spawning sub-agents with isolated context */
  agentCapable: boolean;
  /** Platform has hook system (SessionStart, PreToolUse) */
  hasHooks: boolean;
  /**
   * CLI flag value for this platform (e.g. "kerminal").
   * Substituted into template commands via {{CLI_FLAG}} so rendered skill /
   * command files can pass `--platform <flag>` to scripts that need to know
   * the invoking platform, removing the need to re-detect at runtime.
   * Duplicates the top-level `AIToolConfig.cliFlag` for convenience — the
   * invariant is maintained in `AI_TOOLS` config blocks.
   */
  cliFlag: CliFlag;
}

/**
 * Configuration for an AI tool
 */
export interface AIToolConfig {
  /** Display name of the tool */
  name: string;
  /** Command template directory names to include */
  templateDirs: TemplateDir[];
  /** Config directory name in the project root (e.g., ".kerminal") */
  configDir: string;
  /**
   * Whether the platform supports the shared `.agents/skills/` layer
   * (agentskills.io open standard). When true, `.agents/skills` is added
   * to the platform's managed paths automatically.
   */
  supportsAgentSkills?: boolean;
  /** Additional managed paths beyond configDir */
  extraManagedPaths?: string[];
  /** CLI flag name for --flag options (e.g., "kerminal" for --kerminal) */
  cliFlag: CliFlag;
  /** Whether this tool is checked by default in interactive init prompt */
  defaultChecked: boolean;
  /** Whether this tool uses Python hooks (affects Windows encoding detection) */
  hasPythonHooks: boolean;
  /**
   * Optional user-global compatibility plugin for platform versions where
   * project-level integration is unavailable. Trellis may surface a manual
   * installation hint, but leaves installation and lifecycle management to
   * the platform UI.
   */
  globalHookPlugin?: {
    name: string;
    marketplaceUrl: string;
  };
  /** Template context for placeholder resolution in common templates */
  templateContext: TemplateContext;
}

/**
 * Registry of all supported AI tools and their configurations.
 * This is the single source of truth for platform data.
 *
 * Kerminal — class-2 pull-based platform with sub-agent support.
 *
 * Kerminal is a skills-first terminal agent: it reads the project
 * `AGENTS.md` (Trellis writes the managed block at init) and loads skills
 * by name through its skill tool. It discovers skills from the shared
 * `.agents/skills/` root (agentskills.io standard), so workflow/bundled
 * skills go there via the neutral resolver. User-invocable entry skills
 * (`trellis-start` / `trellis-continue` / `trellis-finish-work`) and the
 * Trellis agent prompts (trellis-implement / trellis-check /
 * trellis-research) live under `.kerminal/skills/` — Kerminal's own
 * project skill root — platform-resolved (`--platform kerminal`, bare
 * `trellis-<name>` refs).
 *
 * Kerminal has no project-level hook system Trellis may write, so context
 * is pull-based: skills read `.trellis/` files directly, `trellis-start`
 * stays user-invocable, and no session-start payload is shipped. It also
 * has no project-level sub-agent registry: the main session dispatches
 * trellis-implement / trellis-check / trellis-research by loading the
 * matching agent skill and spawning a generic sub-agent whose prompt is
 * the skill content. Kerminal auto-injects the project `AGENTS.md` into
 * spawned sub-agents; task context is pulled through the pull-based
 * prelude.
 */
export const AI_TOOLS: Record<AITool, AIToolConfig> = {
  kerminal: {
    name: "Kerminal",
    templateDirs: ["common", "kerminal"],
    configDir: ".kerminal",
    supportsAgentSkills: true,
    cliFlag: "kerminal",
    defaultChecked: true,
    hasPythonHooks: false,
    templateContext: {
      cmdRefPrefix: "trellis-",
      executorAI: "Bash scripts or tool calls",
      userActionLabel: "Skills",
      agentCapable: true,
      hasHooks: false,
      cliFlag: "kerminal",
    },
  },
};

/**
 * Get the configuration for a specific AI tool
 */
export function getToolConfig(tool: AITool): AIToolConfig {
  return AI_TOOLS[tool];
}

/**
 * Get all managed paths for a specific tool.
 */
export function getManagedPaths(tool: AITool): string[] {
  const config = AI_TOOLS[tool];
  const paths = [config.configDir];
  if (config.supportsAgentSkills) {
    paths.push(".agents/skills");
  }
  if (config.extraManagedPaths) {
    paths.push(...config.extraManagedPaths);
  }
  return paths;
}

/**
 * Get template directories for a specific tool
 */
export function getTemplateDirs(tool: AITool): TemplateDir[] {
  return AI_TOOLS[tool].templateDirs;
}
