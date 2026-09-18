import { describe, expect, it } from "vitest";
import {
  scriptsInit,
  commonInit,
  commonPaths,
  commonDeveloper,
  commonGitContext,
  commonTaskQueue,
  commonTaskUtils,
  commonActiveTask,
  getDeveloperScript,
  initDeveloperScript,
  taskScript,
  getContextScript,
  addSessionScript,
  workflowMdTemplate,
  gitignoreTemplate,
  getAllScripts,
  configYamlTemplate,
} from "../../src/templates/trellis/index.js";

// =============================================================================
// Template Constants — module-level string exports
// =============================================================================

describe("trellis template constants", () => {
  const allTemplates = {
    scriptsInit,
    commonInit,
    commonPaths,
    commonDeveloper,
    commonGitContext,
    commonTaskQueue,
    commonTaskUtils,
    commonActiveTask,
      getDeveloperScript,
    initDeveloperScript,
    taskScript,
    getContextScript,
    addSessionScript,
    workflowMdTemplate,
    gitignoreTemplate,
  };

  function inProgressBreadcrumb(): string {
    const inProgressMatch = /\[workflow-state:in_progress\]([\s\S]*?)\[\/workflow-state:in_progress\]/.exec(
      workflowMdTemplate,
    );
    if (!inProgressMatch) {
      throw new Error("in_progress breadcrumb block must exist in workflow.md");
    }
    return inProgressMatch[1];
  }

  function workflowStateBreadcrumb(status: string): string {
    const match = new RegExp(
      `\\[workflow-state:${status}\\]([\\s\\S]*?)\\[/workflow-state:${status}\\]`,
    ).exec(workflowMdTemplate);
    if (!match) {
      throw new Error(`${status} breadcrumb block must exist in workflow.md`);
    }
    return match[1];
  }

  function stepSection(step: string): string {
    const pattern = new RegExp(
      `#### ${step.replace(".", "\\.")}[^\\n]*\\n([\\s\\S]*?)(?=\\n#### |\\n### |$)`,
    );
    const match = pattern.exec(workflowMdTemplate);
    if (!match) {
      throw new Error(`workflow.md step ${step} must exist`);
    }
    return match[1];
  }

  function platformBlock(section: string, openingMarker: string): string {
    const normalizedSection = section.replace(/\r\n/g, "\n");
    const escaped = openingMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const closingMarker = openingMarker.replace("[", "[/");
    const escapedClosing = closingMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}\\n([\\s\\S]*?)\\n${escapedClosing}`);
    const match = pattern.exec(normalizedSection);
    if (!match) {
      throw new Error(`workflow.md block ${openingMarker} must exist`);
    }
    return match[0];
  }

  it("all templates are non-empty strings", () => {
    for (const [name, content] of Object.entries(allTemplates)) {
      expect(content.length, `${name} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("Python scripts contain valid Python syntax indicators", () => {
    // scriptsInit (__init__.py) only has docstrings, so use scripts with actual code
    const pyScripts = [
      commonInit,
      commonPaths,
      commonActiveTask,
      getDeveloperScript,
      taskScript,
    ];
    for (const script of pyScripts) {
      expect(
        script.includes("import") ||
        script.includes("def ") ||
        script.includes("class ") ||
        script.includes("#"),
      ).toBe(true);
    }
  });

  it("scriptsInit is a Python docstring module", () => {
    expect(scriptsInit).toContain('"""');
  });

  it("workflowMdTemplate is markdown", () => {
    expect(workflowMdTemplate).toContain("#");
  });

  it("workflow.md routes every platform through the Kerminal block", () => {
    const implement = stepSection("2.1");
    const kerminalBlock = platformBlock(implement, "[Kerminal]");

    expect(kerminalBlock).toContain("Active task: <task path>");
    expect(kerminalBlock).toContain("auto-injects the project `AGENTS.md`");
    // No other platform's guidance remains in the shipped template.
    expect(implement).not.toContain("The pull-based sub-agent definition auto-handles");
    expect(implement).not.toContain("SubagentStart");
  });

  it("[issue-237] workflow.md in_progress breadcrumb self-exempts implement/check sub-agents", () => {
    // The in_progress breadcrumb may be injected into sub-agent turns on some
    // hosts, so its main-session dispatch guidance must not recursively apply
    // to a sub-agent that is already doing the requested work.
    const block = inProgressBreadcrumb();
    expect(block).toContain("Main-session default");
    expect(block).toContain("Sub-agent self-exemption");
    expect(block).toContain("already running as `trellis-implement`");
    expect(block).toContain("do NOT spawn another `trellis-implement`");
    expect(block).toContain("already running as `trellis-check`");
    expect(block).toContain("do NOT spawn another `trellis-check`");
    expect(block).toContain("main session only");
  });

  it("[issue-237] workflow.md Phase 2 dispatch steps require prompt recursion guards", () => {
    expect(workflowMdTemplate).toContain("**Dispatch prompt guard**");
    expect(workflowMdTemplate).toContain(
      "already `trellis-implement` and must implement directly",
    );
    expect(workflowMdTemplate).toContain(
      "without spawning another `trellis-implement` / `trellis-check`",
    );
    expect(workflowMdTemplate).toContain(
      "already `trellis-check` and must review/fix directly",
    );
    expect(workflowMdTemplate).toContain(
      "without spawning another `trellis-check` / `trellis-implement`",
    );
  });

  it("workflow.md documents parent child task tree responsibilities", () => {
    expect(workflowMdTemplate).toContain("### Parent / Child Task Trees");
    expect(workflowMdTemplate).toContain(
      "several independently verifiable deliverables",
    );
    expect(workflowMdTemplate).toContain(
      "Parent/child structure is not a dependency system",
    );
    expect(workflowMdTemplate).toContain("--parent <parent-dir>");
    expect(workflowMdTemplate).toContain("task.py add-subtask <parent> <child>");
    expect(workflowMdTemplate).toContain(
      "start the child that owns the next independently verifiable deliverable",
    );
  });

  it("workflow.md step 1.1 includes parent child split guidance", () => {
    const step = stepSection("1.1");
    expect(step).toContain("When considering a parent/child split");
    expect(step).toContain("Parent tasks own source requirements");
    expect(step).toContain("Child tasks own actual deliverables");
    expect(step).toContain(
      "Parent/child structure is not a dependency system",
    );
    expect(step).toContain("Do not start the parent unless");
  });

  it("workflow.md planning breadcrumbs mention parent child split guidance", () => {
    const planning = workflowStateBreadcrumb("planning");
    expect(planning).toContain("Multi-deliverable scope");
    expect(planning).toContain("parent task plus independently verifiable child tasks");
    expect(planning).toContain("not implied by tree position");
  });

  it("workflow.md ships a task_error breadcrumb that repairs the existing task", () => {
    const taskError = workflowStateBreadcrumb("task_error");
    expect(taskError).toContain("Do not create or activate another task");
    expect(taskError).toContain("repair its task.json");
    expect(taskError).toContain("valid JSON object with a non-empty status");
  });

  it("gitignoreTemplate contains ignore patterns", () => {
    expect(gitignoreTemplate).toContain(".developer");
    expect(gitignoreTemplate).toContain("__pycache__");
  });
});

// =============================================================================
// getAllScripts — pure function assembling pre-loaded strings
// =============================================================================

describe("getAllScripts", () => {
  it("returns a Map", () => {
    const scripts = getAllScripts();
    expect(scripts).toBeInstanceOf(Map);
  });

  it("contains expected script entries", () => {
    const scripts = getAllScripts();
    expect(scripts.has("__init__.py")).toBe(true);
    expect(scripts.has("common/__init__.py")).toBe(true);
    expect(scripts.has("common/paths.py")).toBe(true);
    expect(scripts.has("common/active_task.py")).toBe(true);
    expect(scripts.has("task.py")).toBe(true);
    expect(scripts.has("get_developer.py")).toBe(true);
  });

  it("has at least one entry", () => {
    const scripts = getAllScripts();
    expect(scripts.size).toBeGreaterThan(0);
  });

  it("all values are non-empty strings", () => {
    const scripts = getAllScripts();
    for (const [key, value] of scripts) {
      expect(value.length, `${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("values match the exported constants", () => {
    const scripts = getAllScripts();
    expect(scripts.get("__init__.py")).toBe(scriptsInit);
    expect(scripts.get("common/__init__.py")).toBe(commonInit);
    expect(scripts.get("task.py")).toBe(taskScript);
  });

  it("does not contain multi_agent entries", () => {
    const scripts = getAllScripts();
    for (const [key] of scripts) {
      expect(key, `${key} should not be a multi_agent script`).not.toContain("multi_agent");
    }
  });
});

// =============================================================================
// getAllAgents — channel runtime agent definitions dispatched at init/update.
// agent-loader.ts loads `.trellis/agents/<name>.md` and requires `---` YAML
// frontmatter at the top with a flat `name: <name>` field. These tests pin the
// contract so a future template edit can't silently break channel spawn.
// =============================================================================

// =============================================================================
// config.yaml — context_injection section (issue #441)
// =============================================================================

describe("configYamlTemplate: context_injection section", () => {
  it("documents the context_injection block, fully commented out", () => {
    expect(configYamlTemplate).toContain("context_injection:");
    expect(configYamlTemplate).toContain("#   max_file_bytes: 32768");
    expect(configYamlTemplate).toContain("#   max_artifact_bytes: 65536");
    expect(configYamlTemplate).toContain("#   max_total_bytes: 131072");
    // Every context_injection line must be commented — the section ships
    // inert by default (matches the codex.dispatch_mode precedent).
    const lines = configYamlTemplate.split("\n");
    const start = lines.findIndex((l) => l.includes("context_injection:"));
    expect(start).toBeGreaterThan(-1);
    for (const line of lines.slice(start, start + 4)) {
      expect(line.trimStart().startsWith("#")).toBe(true);
    }
  });
});
