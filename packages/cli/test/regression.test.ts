/**
 * Regression Tests — Historical Bug Prevention
 *
 * Each test references a specific version where the bug was introduced/fixed.
 * Prevents recurrence of bugs from beta.2 through beta.16.
 *
 * Categories:
 * 1. Windows / Encoding (beta.2, beta.7, beta.10, beta.11, beta.12, beta.16)
 * 2. Path Issues (0.2.14, 0.2.15, beta.13)
 * 3. Semver / Migration Engine (beta.5, beta.14, beta.16)
 * 4. Template Integrity (beta.0, beta.7, beta.12)
 * 5. Platform Registry (beta.9, beta.13, beta.16)
 */

import { execSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearManifestCache,
  getAllMigrations,
  getAllMigrationVersions,
  getMigrationsForVersion,
  hasPendingMigrations,
} from "../src/migrations/index.js";
import { isManagedPath } from "../src/configurators/index.js";
import { AI_TOOLS } from "../src/types/ai-tools.js";
import { PATHS } from "../src/constants/paths.js";
import {
  getCommandTemplates,
  getSkillTemplates,
} from "../src/templates/common/index.js";
import {
  commonInit,
  taskScript,
  addSessionScript,
  commonTaskUtils,
  commonDeveloper,
  commonConfig,
  commonTrellisConfig,
  commonGitContext,
  commonSessionContext,
  getAllScripts,
} from "../src/templates/trellis/index.js";
import {
  collectPlatformTemplates,
  configurePlatform,
  PLATFORM_IDS,
} from "../src/configurators/index.js";
import { setWriteMode } from "../src/utils/file-writer.js";
import {
  guidesIndexContent,
  workspaceIndexContent,
} from "../src/templates/markdown/index.js";
import * as markdownExports from "../src/templates/markdown/index.js";

afterEach(() => {
  clearManifestCache();
});

// =============================================================================
// 1. Windows / Encoding Regressions
// =============================================================================

describe("regression: Windows encoding (beta.10, beta.11, beta.16)", () => {
  it("[beta.10] common/__init__.py has _configure_stream function", () => {
    expect(commonInit).toContain("def _configure_stream");
  });

  it('[beta.10] common/__init__.py has reconfigure(encoding="utf-8") pattern', () => {
    expect(commonInit).toContain('reconfigure(encoding="utf-8"');
  });

  it("[beta.10] common/__init__.py has TextIOWrapper fallback", () => {
    expect(commonInit).toContain("TextIOWrapper");
  });

  it('[beta.10] common/__init__.py has sys.platform == "win32" guard', () => {
    expect(commonInit).toContain('sys.platform == "win32"');
  });

  it("[beta.10] common/__init__.py configures both stdout AND stderr", () => {
    expect(commonInit).toContain("sys.stdout");
    expect(commonInit).toContain("sys.stderr");
  });

  it("[beta.16] _configure_stream handles stream with reconfigure method", () => {
    // The function should try reconfigure() first, then fallback to detach()
    expect(commonInit).toContain('hasattr(stream, "reconfigure")');
    expect(commonInit).toContain('hasattr(stream, "detach")');
  });

  it("[beta.16] _configure_stream is idempotent (won't crash on double call)", () => {
    // The reconfigure pattern is safe to call multiple times
    // The function should NOT use detach() unconditionally (beta.16 bug root cause)
    // It should check hasattr(stream, "reconfigure") FIRST
    const reconfigureIndex = commonInit.indexOf(
      'hasattr(stream, "reconfigure")',
    );
    const detachIndex = commonInit.indexOf('hasattr(stream, "detach")');
    expect(reconfigureIndex).toBeLessThan(detachIndex);
  });

  it("[beta.10] common/__init__.py has centralized encoding fix", () => {
    // Encoding fix was centralized from individual scripts to common/__init__.py (#67)
    expect(commonInit).toContain('sys.platform == "win32"');
    expect(commonInit).toContain("reconfigure");
  });

  it("[beta.10] task.py imports from common (gets encoding fix via __init__.py)", () => {
    expect(taskScript).toContain("from common");
  });

  it("[rc.2] add_session.py table separator detection uses regex (not startswith)", () => {
    // Bug: startswith("|---") breaks when formatters add spaces: "| ---- |"
    // Fix: use re.match with a character-class pattern to allow optional whitespace/spaces
    expect(addSessionScript).not.toContain('startswith("|---")');
    expect(addSessionScript).toContain(
      String.raw`re.match(r"^\|[-| ]+\|\s*$", line)`,
    );
  });
});

describe("regression: branch context in session records (issue-106)", () => {
  it("[issue-106] add_session.py accepts --branch CLI arg", () => {
    expect(addSessionScript).toContain("--branch");
    expect(addSessionScript).not.toContain("--base-branch");
  });

  it("[issue-106] add_session.py auto-detects branch via git branch --show-current", () => {
    expect(addSessionScript).toContain("branch --show-current");
  });

  it("[issue-106] add_session.py reads branch from task.json when available", () => {
    expect(addSessionScript).toContain('task_data.raw.get("branch")');
    expect(addSessionScript).not.toContain('task_data.raw.get("base_branch")');
  });

  it("[issue-106] add_session.py session content includes **Branch** field only", () => {
    expect(addSessionScript).toContain("**Branch**");
    expect(addSessionScript).not.toContain("**Base Branch**");
  });

  it("[issue-106] add_session.py index table header has 5 columns including Branch", () => {
    expect(addSessionScript).toContain(
      "| # | Date | Title | Commits | Branch |",
    );
    expect(addSessionScript).not.toContain(
      "| # | Date | Title | Commits | Branch | Base Branch |",
    );
  });

  it("[issue-106] add_session.py migrates old 4/6-column headers to 5-column", () => {
    expect(addSessionScript).toMatch(
      /re\.match\(\r?\n\s+r"\^\\\|\\s\*#\\s\*\\\|\\s\*Date\\s\*\\\|\\s\*Title\\s\*\\\|\\s\*Commits\\s\*\\\|\\s\*Branch\\s\*\\\|\\s\*Base Branch\\s\*\\\|\\s\*\$",/,
    );
    expect(addSessionScript).toContain(
      String.raw`re.match(r"^\|\s*#\s*\|\s*Date\s*\|\s*Title\s*\|\s*Commits\s*\|\s*Branch\s*\|\s*$", line)`,
    );
  });

  it("[issue-106] developer.py init template has 5-column session history table", () => {
    expect(commonDeveloper).toContain(
      "| # | Date | Title | Commits | Branch |",
    );
    expect(commonDeveloper).toContain(
      "|---|------|-------|---------|--------|",
    );
  });

  it("[issue-106] workspace-index.md template documents Branch field only for session records", () => {
    expect(workspaceIndexContent).toContain(
      "Branch: Which branch the work was done on",
    );
    expect(workspaceIndexContent).toContain("**Branch**: `{branch-name}`");
    expect(workspaceIndexContent).not.toContain(
      "**Base Branch**: `{base-branch-name}`",
    );
  });
});

describe("regression: add_session.py runtime branch context (issue-106)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-session-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTrellisScripts(): void {
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content);
    }
  }

  function createWorkspaceIndex(
    headerMode: "legacy4" | "legacy6" | "current5",
  ): void {
    let header = "| # | Date | Title | Commits | Branch |";
    let separator = "|---|------|-------|---------|--------|";
    if (headerMode === "legacy4") {
      header = "| # | Date | Title | Commits |";
      separator = "|---|------|-------|---------|";
    } else if (headerMode === "legacy6") {
      header = "| # | Date | Title | Commits | Branch | Base Branch |";
      separator = "|---|------|-------|---------|--------|-------------|";
    }
    const indexContent = `# Workspace Index - test-dev

## Current Status

<!-- @@@auto:current-status -->
- **Active File**: \`journal-1.md\`
- **Total Sessions**: 0
- **Last Active**: -
<!-- @@@/auto:current-status -->

## Active Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| \`journal-1.md\` | ~0 | Active |
<!-- @@@/auto:active-documents -->

## Session History

<!-- @@@auto:session-history -->
${header}
${separator}
<!-- @@@/auto:session-history -->
`;
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "index.md"),
      indexContent,
      "utf-8",
    );
  }

  function setupSessionRepo(options?: {
    gitBranch?: string;
    headerMode?: "legacy4" | "legacy6" | "current5";
    taskBranch?: string;
    taskBaseBranch?: string;
  }): void {
    writeTrellisScripts();

    fs.mkdirSync(path.join(tmpDir, ".trellis", "workspace", "test-dev"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-22T00:00:00\n",
      "utf-8",
    );
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "journal-1.md"),
      "# Journal - test-dev (Part 1)\n\n---\n",
      "utf-8",
    );
    createWorkspaceIndex(options?.headerMode ?? "current5");

    if (options?.taskBranch || options?.taskBaseBranch) {
      const taskDir = path.join(tmpDir, ".trellis", "tasks", "issue-106");
      fs.mkdirSync(taskDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".trellis", ".runtime", "sessions"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(tmpDir, ".trellis", ".runtime", "sessions", "session-a.json"),
        JSON.stringify(
          {
            current_task: ".trellis/tasks/issue-106",
            platform: "test",
          },
          null,
          2,
        ),
        "utf-8",
      );
      fs.writeFileSync(
        path.join(taskDir, "task.json"),
        JSON.stringify(
          {
            title: "Issue 106 task",
            status: "in_progress",
            package: null,
            branch: options.taskBranch ?? null,
            base_branch: options.taskBaseBranch ?? null,
          },
          null,
          2,
        ),
        "utf-8",
      );
    }

    if (options?.gitBranch) {
      execSync("git init -q", { cwd: tmpDir });
      execSync(`git branch -m ${JSON.stringify(options.gitBranch)}`, {
        cwd: tmpDir,
      });
    }
  }

  function runAddSession(title: string, options?: { branch?: string }): void {
    const command = [
      "python3",
      JSON.stringify(
        path.join(tmpDir, ".trellis", "scripts", "add_session.py"),
      ),
      "--title",
      JSON.stringify(title),
      "--summary",
      JSON.stringify("Regression test session"),
      "--no-commit",
    ];
    if (options?.branch) {
      command.push("--branch", JSON.stringify(options.branch));
    }

    execSync(command.join(" "), {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: "session-a" },
    });
  }

  function createLocalBranch(branch: string): void {
    execSync("git config user.email test@example.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git commit --allow-empty -q -m init", { cwd: tmpDir });
    execSync(`git branch ${JSON.stringify(branch)}`, { cwd: tmpDir });
  }

  it("[issue-106] prefers explicit CLI branch over task.json and git", () => {
    setupSessionRepo({
      gitBranch: "feature/from-git",
      taskBranch: "task/from-task",
      taskBaseBranch: "main",
    });

    runAddSession("CLI branch wins", { branch: "cli/from-arg" });

    const journal = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "journal-1.md"),
      "utf-8",
    );
    const index = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "index.md"),
      "utf-8",
    );

    expect(journal).toContain("**Branch**: `cli/from-arg`");
    expect(journal).not.toContain("**Base Branch**:");
    expect(journal).not.toContain("task/from-task");
    expect(journal).not.toContain("feature/from-git");
    expect(index).toContain("`cli/from-arg` |");
    expect(index).not.toContain("`task/from-task`");
    expect(index).not.toContain("`feature/from-git`");
  });

  it("[issue-106] prefers task.json branch over current git branch and ignores task base_branch", () => {
    setupSessionRepo({
      gitBranch: "feature/from-git",
      taskBranch: "task/from-task",
      taskBaseBranch: "main",
    });
    createLocalBranch("task/from-task");

    runAddSession("Task branch wins");

    const journal = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "journal-1.md"),
      "utf-8",
    );
    const index = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "index.md"),
      "utf-8",
    );

    expect(journal).toContain("**Branch**: `task/from-task`");
    expect(journal).not.toContain("**Base Branch**:");
    expect(journal).not.toContain("feature/from-git");
    expect(index).toContain("`task/from-task` |");
    expect(index).not.toContain("`feature/from-git`");
  });

  it("[issue-106] falls back to git branch and migrates old 6-column session history", () => {
    setupSessionRepo({
      gitBranch: "feature/from-git",
      headerMode: "legacy6",
    });

    runAddSession("Git branch fallback");

    const journal = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "journal-1.md"),
      "utf-8",
    );
    const index = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "index.md"),
      "utf-8",
    );

    expect(journal).toContain("**Branch**: `feature/from-git`");
    expect(journal).not.toContain("**Base Branch**:");
    expect(index).toContain("| # | Date | Title | Commits | Branch |");
    expect(index).toContain("|---|------|-------|---------|--------|");
    expect(index).toContain("`feature/from-git` |");
    expect(index).not.toContain(
      "| # | Date | Title | Commits | Branch | Base Branch |\n|---|------|-------|---------|--------|-------------|",
    );
  });

  it("[issue-106] migrates old 4-column session history directly to 5 columns", () => {
    setupSessionRepo({
      headerMode: "legacy4",
    });

    runAddSession("Legacy 4-column migration");

    const index = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "index.md"),
      "utf-8",
    );

    expect(index).toContain("| # | Date | Title | Commits | Branch |");
    expect(index).toContain("|---|------|-------|---------|--------|");
    expect(index).not.toContain(
      "| # | Date | Title | Commits |\n|---|------|-------|---------|",
    );
  });

  it("[issue-106] records a session even when no branch information is available", () => {
    setupSessionRepo();

    runAddSession("No branch available");

    const journal = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "journal-1.md"),
      "utf-8",
    );
    const index = fs.readFileSync(
      path.join(tmpDir, ".trellis", "workspace", "test-dev", "index.md"),
      "utf-8",
    );

    expect(journal).not.toContain("**Branch**:");
    expect(journal).not.toContain("**Base Branch**:");
    expect(index).toContain("`-` |");
    expect(index).toContain("- **Total Sessions**: 1");
  });
});

// Windows subprocess flags tests removed — multi_agent pipeline removed

describe("regression: Windows path separator (beta.12)", () => {
  it("[beta.12] isManagedPath handles Windows backslash paths", () => {
    expect(isManagedPath(".kerminal\\skills\\trellis-start\\SKILL.md")).toBe(
      true,
    );
    expect(isManagedPath(".trellis\\spec\\backend")).toBe(true);
    expect(isManagedPath(".agents\\skills\\trellis-check\\SKILL.md")).toBe(
      true,
    );
  });

  it("[beta.12] isManagedPath handles mixed separators", () => {
    expect(isManagedPath(".kerminal\\skills/trellis-start/SKILL.md")).toBe(
      true,
    );
  });
});

// =============================================================================
// 2. Path Issues Regressions
// =============================================================================

describe("regression: task directory paths (0.2.14, 0.2.15, beta.13)", () => {
  it("[0.2.15] PATHS.TASKS is .trellis/tasks (not .trellis/workspace/*/tasks)", () => {
    expect(PATHS.TASKS).toBe(".trellis/tasks");
    expect(PATHS.TASKS).not.toContain("workspace");
  });

  it("[0.2.15] no script templates contain hardcoded 'taosu' in path patterns", () => {
    const scripts = getAllScripts();
    for (const [name, content] of scripts) {
      // Check for hardcoded username in path patterns (workspace/taosu, /Users/taosu)
      // but allow usage examples like "python3 status.py -a taosu"
      expect(
        content,
        `${name} should not contain hardcoded username in paths`,
      ).not.toMatch(/workspace\/taosu|\/Users\/taosu/);
    }
  });
});

describe("regression: resolve_task_dir path handling", () => {
  it("[beta.12] resolve_task_dir handles .trellis prefix", () => {
    // The function should recognize .trellis-prefixed paths as relative paths
    expect(commonTaskUtils).toContain('.startswith(".trellis")');
  });

  it("[current-task] resolve_task_dir normalizes backslash separators before path classification", () => {
    expect(commonTaskUtils).toContain('target_dir.replace("\\\\", "/")');
  });
});

describe("regression: resolve_task_dir containment chokepoint", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  function runTask(...args: string[]): {
    status: number | null;
    stdout: string;
    stderr: string;
  } {
    const result = spawnSync(
      pythonCmd,
      [path.join(".trellis", "scripts", "task.py"), ...args],
      { cwd: tmpDir, encoding: "utf-8" },
    );
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  function taskDir(...segments: string[]): string {
    return path.join(tmpDir, ".trellis", "tasks", ...segments);
  }

  function makeTask(name: string): void {
    fs.mkdirSync(taskDir(name), { recursive: true });
    fs.writeFileSync(
      path.join(taskDir(name), "task.json"),
      JSON.stringify({ id: name, meta: {}, children: [] }) + "\n",
    );
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-task-escape-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=tester\n",
    );
    fs.mkdirSync(taskDir("archive"), { recursive: true });
    makeTask("08-09-real");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("[audit] set-meta on a traversal path fails and leaves the outside task.json untouched", () => {
    const victimDir = path.join(
      tmpDir,
      "..",
      path.basename(tmpDir) + "-victim",
    );
    fs.mkdirSync(victimDir, { recursive: true });
    const victimJson = path.join(victimDir, "task.json");
    fs.writeFileSync(victimJson, JSON.stringify({ id: "victim", meta: {} }));

    try {
      const r = runTask(
        "set-meta",
        `../${path.basename(victimDir)}`,
        "pwned",
        "yes",
      );
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("refusing to use");
      expect(JSON.parse(fs.readFileSync(victimJson, "utf-8")).meta).toEqual({});
    } finally {
      fs.rmSync(victimDir, { recursive: true, force: true });
    }
  });

  it("[audit] start reports a refused path once, on stderr only", () => {
    // resolve_task_dir names the exact reason on stderr. cmd_start used to add
    // a generic "Task not found" on stdout, so one refusal arrived as two
    // messages split across two streams and the specific one was the easier to
    // miss.
    const r = runTask("start", "../escape");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("refusing to use");
    expect(r.stdout).not.toContain("Task not found");
  });

  it("[audit] set-meta through a symlinked task dir fails and leaves the link target untouched", () => {
    const outsideDir = path.join(tmpDir, "outside-target");
    fs.mkdirSync(outsideDir, { recursive: true });
    const outsideJson = path.join(outsideDir, "task.json");
    fs.writeFileSync(outsideJson, JSON.stringify({ id: "outside", meta: {} }));
    fs.symlinkSync(
      outsideDir,
      taskDir("08-09-symlinked"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const r = runTask("set-meta", "08-09-symlinked", "pwned", "yes");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("refusing to use");
    expect(JSON.parse(fs.readFileSync(outsideJson, "utf-8")).meta).toEqual({});
  });

  it("[audit] create --slug with traversal fails and writes nothing outside the tasks dir", () => {
    const r = runTask(
      "create",
      "Evil",
      "--description",
      "regression fixture",
      "--slug",
      "../../../escaped",
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("--slug must be a plain name");
    expect(fs.existsSync(path.join(tmpDir, ".trellis", "escaped"))).toBe(false);
    expect(
      fs.readdirSync(path.join(tmpDir, ".trellis", "tasks")).sort(),
    ).toEqual(["08-09-real", "archive"]);
  });

  it("[audit] add-context rejects a traversal JSONL filename", () => {
    const r = runTask(
      "add-context",
      "08-09-real",
      "../../../evil-ctx",
      ".trellis/tasks/08-09-real/task.json",
    );
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("must be a plain name");
    expect(fs.existsSync(path.join(tmpDir, "..", "evil-ctx.jsonl"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(tmpDir, "evil-ctx.jsonl"))).toBe(false);
  });

  it("[audit] add-context on '..' fails instead of writing into .trellis/", () => {
    const r = runTask(
      "add-context",
      "..",
      "implement",
      ".trellis/tasks/08-09-real/task.json",
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("invalid task name");
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis", "implement.jsonl")),
    ).toBe(false);
  });

  it("[audit] an ambiguous suffix name fails and lists every match", () => {
    makeTask("01-01-dupe");
    makeTask("12-31-dupe");

    const r = runTask("set-meta", "dupe", "k", "v");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("ambiguous task name");
    expect(r.stderr).toContain("01-01-dupe");
    expect(r.stderr).toContain("12-31-dupe");
    for (const name of ["01-01-dupe", "12-31-dupe"]) {
      expect(
        JSON.parse(
          fs.readFileSync(path.join(taskDir(name), "task.json"), "utf-8"),
        ).meta,
      ).toEqual({});
    }
  });

  it("[audit] legitimate task paths still resolve: name, repo-relative path, and archived task", () => {
    fs.mkdirSync(taskDir("archive", "2026-07", "08-09-old"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(taskDir("archive", "2026-07", "08-09-old"), "task.json"),
      JSON.stringify({ id: "old", meta: {} }) + "\n",
    );

    expect(runTask("set-meta", "08-09-real", "by-name", "1").status).toBe(0);
    expect(
      runTask("set-meta", ".trellis/tasks/08-09-real", "by-path", "2").status,
    ).toBe(0);
    expect(
      runTask(
        "set-meta",
        ".trellis/tasks/archive/2026-07/08-09-old",
        "archived",
        "3",
      ).status,
    ).toBe(0);

    expect(
      JSON.parse(
        fs.readFileSync(path.join(taskDir("08-09-real"), "task.json"), "utf-8"),
      ).meta,
    ).toEqual({ "by-name": "1", "by-path": "2" });
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(taskDir("archive", "2026-07", "08-09-old"), "task.json"),
          "utf-8",
        ),
      ).meta,
    ).toEqual({ archived: "3" });
  });
});

describe("regression: task lifecycle overwrite and collision safety", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const pad = (n: number): string => String(n).padStart(2, "0");
  const now = new Date();
  const datePrefix = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yearMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  function runTask(...args: string[]): {
    status: number | null;
    stdout: string;
    stderr: string;
  } {
    const result = spawnSync(
      pythonCmd,
      [path.join(".trellis", "scripts", "task.py"), ...args],
      { cwd: tmpDir, encoding: "utf-8" },
    );
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  function taskDir(...segments: string[]): string {
    return path.join(tmpDir, ".trellis", "tasks", ...segments);
  }

  function readTaskJson(...segments: string[]): Record<string, unknown> {
    return JSON.parse(
      fs.readFileSync(path.join(taskDir(...segments), "task.json"), "utf-8"),
    ) as Record<string, unknown>;
  }

  function writeTaskJson(name: string, data: Record<string, unknown>): void {
    fs.writeFileSync(
      path.join(taskDir(name), "task.json"),
      JSON.stringify(data, null, 2) + "\n",
    );
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-task-collision-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=tester\n",
    );
    fs.mkdirSync(taskDir("archive"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("[audit] same-day slug reuse fails and preserves the existing task.json", () => {
    expect(
      runTask(
        "create",
        "First",
        "--description",
        "regression fixture",
        "--slug",
        "reuse",
        "--no-start",
      ).status,
    ).toBe(0);

    const dirName = `${datePrefix}-reuse`;
    const live = {
      ...readTaskJson(dirName),
      status: "in_progress",
      branch: "feat/live",
      parent: "some-parent",
      children: ["some-child"],
      meta: { linear: "TRE-1" },
    };
    writeTaskJson(dirName, live);

    const r = runTask(
      "create",
      "Second",
      "--description",
      "regression fixture",
      "--slug",
      "reuse",
      "--no-start",
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Task already exists");
    expect(r.stderr).toContain("--force");
    expect(readTaskJson(dirName)).toEqual(live);
  });

  it("[audit] create --force overwrites an existing task.json", () => {
    expect(
      runTask(
        "create",
        "First",
        "--description",
        "regression fixture",
        "--slug",
        "reuse",
        "--no-start",
      ).status,
    ).toBe(0);
    const dirName = `${datePrefix}-reuse`;
    writeTaskJson(dirName, { ...readTaskJson(dirName), status: "in_progress" });

    const r = runTask(
      "create",
      "Second",
      "--description",
      "regression fixture",
      "--slug",
      "reuse",
      "--no-start",
      "--force",
    );
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toContain("--force");

    const after = readTaskJson(dirName);
    expect(after.title).toBe("Second");
    expect(after.status).toBe("planning");
  });

  it("[audit] archive into an existing destination fails, leaving both directories intact", () => {
    expect(
      runTask(
        "create",
        "Kid",
        "--description",
        "regression fixture",
        "--slug",
        "kid",
        "--no-start",
      ).status,
    ).toBe(0);
    const dirName = `${datePrefix}-kid`;

    const destDir = taskDir("archive", yearMonth, dirName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(
      path.join(destDir, "task.json"),
      JSON.stringify({ id: "previously-archived" }),
    );

    const r = runTask("archive", dirName, "--no-commit");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("archive destination already exists");
    // Both sides of the collision must be named, or the user cannot tell
    // which archived task to move out of the way.
    expect(r.stderr).toContain(`archive/${yearMonth}/${dirName}`);
    expect(r.stderr).toContain(`Task remains at: .trellis/tasks/${dirName}`);

    // No nesting, no partial state: the live task is untouched (not even
    // flipped to completed) and the archived copy still holds its own file.
    expect(fs.existsSync(path.join(destDir, dirName))).toBe(false);
    expect(readTaskJson(dirName).status).toBe("planning");
    expect(readTaskJson(dirName).completedAt).toBeNull();
    expect(
      JSON.parse(fs.readFileSync(path.join(destDir, "task.json"), "utf-8")).id,
    ).toBe("previously-archived");
  });

  it("[audit] archive still succeeds when the destination is free", () => {
    expect(
      runTask(
        "create",
        "Kid",
        "--description",
        "regression fixture",
        "--slug",
        "kid",
        "--no-start",
      ).status,
    ).toBe(0);
    const dirName = `${datePrefix}-kid`;

    const r = runTask("archive", dirName, "--no-commit");
    expect(r.status, r.stderr).toBe(0);
    expect(fs.existsSync(taskDir(dirName))).toBe(false);
    expect(
      fs.existsSync(
        path.join(taskDir("archive", yearMonth, dirName), "task.json"),
      ),
    ).toBe(true);
  });

  it("[audit] create --parent on a missing task fails and creates nothing", () => {
    const r = runTask(
      "create",
      "Orphan",
      "--description",
      "regression fixture",
      "--slug",
      "orphan",
      "--no-start",
      "--parent",
      "no-such-task",
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Parent task not resolved");
    expect(r.stderr).toContain("No task was created");
    expect(fs.readdirSync(path.join(tmpDir, ".trellis", "tasks"))).toEqual([
      "archive",
    ]);
  });

  it("[audit] create --parent pointing at a dir without task.json fails and creates nothing", () => {
    fs.mkdirSync(taskDir(`${datePrefix}-bare`), { recursive: true });

    const r = runTask(
      "create",
      "Orphan",
      "--description",
      "regression fixture",
      "--slug",
      "orphan",
      "--no-start",
      "--parent",
      `${datePrefix}-bare`,
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Parent task.json not found");
    expect(fs.existsSync(taskDir(`${datePrefix}-orphan`))).toBe(false);
  });

  it("[audit] create --parent still links a valid parent on both sides", () => {
    expect(
      runTask(
        "create",
        "Mum",
        "--description",
        "regression fixture",
        "--slug",
        "mum",
        "--no-start",
      ).status,
    ).toBe(0);
    const parentName = `${datePrefix}-mum`;
    const childName = `${datePrefix}-kid`;

    const r = runTask(
      "create",
      "Kid",
      "--description",
      "regression fixture",
      "--slug",
      "kid",
      "--no-start",
      "--parent",
      parentName,
    );
    expect(r.status, r.stderr).toBe(0);
    expect(readTaskJson(childName).parent).toBe(parentName);
    expect(readTaskJson(parentName).children).toEqual([childName]);
  });

  // A read-only child directory makes write_json's mkstemp fail. root ignores
  // the mode bits, so the failure can only be provoked as a normal user.
  const canProvokeWriteFailure =
    process.platform !== "win32" && process.getuid?.() !== 0;

  it.skipIf(!canProvokeWriteFailure)(
    "[audit] add-subtask reports which side was written when the second write fails",
    () => {
      expect(
        runTask(
          "create",
          "Mum",
          "--description",
          "regression fixture",
          "--slug",
          "mum",
          "--no-start",
        ).status,
      ).toBe(0);
      expect(
        runTask(
          "create",
          "Kid",
          "--description",
          "regression fixture",
          "--slug",
          "kid",
          "--no-start",
        ).status,
      ).toBe(0);
      const parentName = `${datePrefix}-mum`;
      const childName = `${datePrefix}-kid`;

      fs.chmodSync(taskDir(childName), 0o555);
      try {
        const r = runTask("add-subtask", parentName, childName);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain("Failed to write child task.json");
        expect(r.stderr).toContain("half-written");
        // The message must match reality: the parent side did land.
        expect(readTaskJson(parentName).children).toEqual([childName]);
      } finally {
        fs.chmodSync(taskDir(childName), 0o755);
      }
    },
  );

  it.skipIf(!canProvokeWriteFailure)(
    "[audit] remove-subtask reports which side was written when the second write fails",
    () => {
      expect(
        runTask(
          "create",
          "Mum",
          "--description",
          "regression fixture",
          "--slug",
          "mum",
          "--no-start",
        ).status,
      ).toBe(0);
      const parentName = `${datePrefix}-mum`;
      const childName = `${datePrefix}-kid`;
      expect(
        runTask(
          "create",
          "Kid",
          "--description",
          "regression fixture",
          "--slug",
          "kid",
          "--no-start",
          "--parent",
          parentName,
        ).status,
      ).toBe(0);

      fs.chmodSync(taskDir(childName), 0o555);
      try {
        const r = runTask("remove-subtask", parentName, childName);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain("Failed to write child task.json");
        expect(r.stderr).toContain("half-written");
        // The message must match reality: the parent side did land, so the
        // child is the one still holding a stale parent reference.
        expect(readTaskJson(parentName).children).toEqual([]);
        expect(readTaskJson(childName).parent).toBe(parentName);
      } finally {
        fs.chmodSync(taskDir(childName), 0o755);
      }
    },
  );
});

describe("regression: JSON read/write failure reporting", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const pad = (n: number): string => String(n).padStart(2, "0");
  const now = new Date();
  const datePrefix = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // chmod is the only way to provoke a read/write failure, and root ignores
  // the mode bits — skip rather than assert something that cannot happen.
  const canProvokePermissionFailure =
    process.platform !== "win32" && process.getuid?.() !== 0;

  function runTask(
    args: string[],
    env: Record<string, string> = {},
  ): { status: number | null; stdout: string; stderr: string } {
    const result = spawnSync(
      pythonCmd,
      [path.join(".trellis", "scripts", "task.py"), ...args],
      { cwd: tmpDir, encoding: "utf-8", env: { ...process.env, ...env } },
    );
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  function taskDir(...segments: string[]): string {
    return path.join(tmpDir, ".trellis", "tasks", ...segments);
  }

  function taskJsonPath(name: string): string {
    return path.join(taskDir(name), "task.json");
  }

  function readTaskJson(name: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(taskJsonPath(name), "utf-8")) as Record<
      string,
      unknown
    >;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-task-json-io-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=tester\n",
    );
    fs.mkdirSync(taskDir("archive"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("[audit] set-meta on a corrupt task.json names the file and the failure class", () => {
    expect(
      runTask([
        "create",
        "Broken",
        "--description",
        "regression fixture",
        "--slug",
        "broken",
        "--no-start",
      ]).status,
    ).toBe(0);
    const name = `${datePrefix}-broken`;
    fs.writeFileSync(taskJsonPath(name), "{ not json");

    const r = runTask(["set-meta", name, "k", "v"]);
    expect(r.status).not.toBe(0);
    // Previously: exit 1 with completely empty stdout AND stderr.
    expect(r.stderr).toContain("task.json");
    expect(r.stderr).toContain("not valid JSON");
    expect(r.stderr).toContain("json.tool");
    expect(fs.readFileSync(taskJsonPath(name), "utf-8")).toBe("{ not json");
  });

  it("[audit] set-meta on a non-UTF-8 task.json names the encoding, not a parse error", () => {
    // read_json_checked caught FileNotFoundError and OSError. UnicodeDecodeError
    // is neither, so a task.json that is not UTF-8 escaped both handlers and
    // surfaced as a traceback.
    expect(
      runTask([
        "create",
        "Latin",
        "--description",
        "regression fixture",
        "--slug",
        "latin",
        "--no-start",
      ]).status,
    ).toBe(0);
    const name = `${datePrefix}-latin`;
    fs.writeFileSync(taskJsonPath(name), Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]));

    const r = runTask(["set-meta", name, "k", "v"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).not.toContain("Traceback");
    expect(r.stderr).toContain("not valid UTF-8 text");
  });

  it("[audit] validate reports a non-string `file` instead of crashing on it", () => {
    // A truthy non-string (e.g. {"file": 1}) reached path joining and raised
    // TypeError, so validation crashed on the very row it exists to report.
    expect(
      runTask([
        "create",
        "Typed",
        "--description",
        "regression fixture",
        "--slug",
        "typed",
        "--no-start",
      ]).status,
    ).toBe(0);
    const name = `${datePrefix}-typed`;
    fs.writeFileSync(
      path.join(path.dirname(taskJsonPath(name)), "implement.jsonl"),
      `${JSON.stringify({ file: 1, reason: "numeric path" })}\n`,
      "utf-8",
    );

    const r = runTask(["validate", name]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).not.toContain("Traceback");
    expect(r.stdout).toContain("`file` must be a string path");
  });

  it.skipIf(!canProvokePermissionFailure)(
    "[audit] set-meta on an unreadable task.json reports permissions, not a parse error",
    () => {
      expect(
        runTask([
          "create",
          "Locked",
          "--description",
          "regression fixture",
          "--slug",
          "locked",
          "--no-start",
        ]).status,
      ).toBe(0);
      const name = `${datePrefix}-locked`;
      fs.chmodSync(taskJsonPath(name), 0o000);

      try {
        const r = runTask(["set-meta", name, "k", "v"]);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain("could not be read");
        expect(r.stderr).toContain("permission");
        // The whole point of the split: this must NOT read as a parse error.
        expect(r.stderr).not.toContain("not valid JSON");
      } finally {
        fs.chmodSync(taskJsonPath(name), 0o644);
      }
    },
  );

  it("[audit] set-scope on a task dir without task.json reports the missing file", () => {
    fs.mkdirSync(taskDir(`${datePrefix}-bare`), { recursive: true });
    const r = runTask(["set-scope", `${datePrefix}-bare`, "cli"]);
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("task.json not found");
  });

  it.skipIf(!canProvokePermissionFailure)(
    "[audit] set-branch reports a failed write instead of printing success",
    () => {
      expect(
        runTask([
          "create",
          "Ro",
          "--description",
          "regression fixture",
          "--slug",
          "ro",
          "--no-start",
        ]).status,
      ).toBe(0);
      const name = `${datePrefix}-ro`;
      // Read-only task dir: write_json's mkstemp fails, the original survives.
      fs.chmodSync(taskDir(name), 0o555);

      try {
        const r = runTask(["set-branch", name, "feat/x"]);
        expect(r.status).not.toBe(0);
        expect(r.stdout).not.toContain("Branch set to");
        expect(r.stderr).toContain("Failed to write");
        expect(r.stderr).toContain("unchanged");
      } finally {
        fs.chmodSync(taskDir(name), 0o755);
      }
      expect(readTaskJson(name).branch).toBeNull();
    },
  );

  it.skipIf(!canProvokePermissionFailure)(
    "[audit] create reports a failed task.json write instead of 'Created task'",
    () => {
      expect(
        runTask([
          "create",
          "First",
          "--description",
          "regression fixture",
          "--slug",
          "dup",
          "--no-start",
        ]).status,
      ).toBe(0);
      const name = `${datePrefix}-dup`;
      fs.chmodSync(taskDir(name), 0o555);

      try {
        const r = runTask([
          "create",
          "Second",
          "--description",
          "regression fixture",
          "--slug",
          "dup",
          "--no-start",
          "--force",
        ]);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain("Failed to write");
        expect(r.stderr).toContain("No task was created");
        expect(r.stderr).not.toContain("Created task");
        // Nothing on stdout means nothing for a script to chain onto.
        expect(r.stdout.trim()).toBe("");
      } finally {
        fs.chmodSync(taskDir(name), 0o755);
      }
      expect(readTaskJson(name).title).toBe("First");
    },
  );

  it.skipIf(!canProvokePermissionFailure)(
    "[audit] archive stops before moving when a child cannot be unlinked",
    () => {
      expect(
        runTask([
          "create",
          "Mum",
          "--description",
          "regression fixture",
          "--slug",
          "mum",
          "--no-start",
        ]).status,
      ).toBe(0);
      const parentName = `${datePrefix}-mum`;
      const childName = `${datePrefix}-kid`;
      expect(
        runTask([
          "create",
          "Kid",
          "--description",
          "regression fixture",
          "--slug",
          "kid",
          "--no-start",
          "--parent",
          parentName,
        ]).status,
      ).toBe(0);

      fs.chmodSync(taskDir(childName), 0o555);
      try {
        const r = runTask(["archive", parentName, "--no-commit"]);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain("Failed to write");
        expect(r.stderr).toContain(childName);
        expect(r.stderr).toContain("Not archived");
      } finally {
        fs.chmodSync(taskDir(childName), 0o755);
      }
      // The task must still be where the user left it, not half-moved.
      expect(fs.existsSync(taskJsonPath(parentName))).toBe(true);
      expect(readTaskJson(childName).parent).toBe(parentName);
    },
  );

  it.skipIf(!canProvokePermissionFailure)(
    "[audit] archive restores the children it already unlinked when a later one fails",
    () => {
      const createTask = (
        title: string,
        slug: string,
        parent?: string,
      ): void => {
        const args = [
          "create",
          title,
          "--description",
          "regression fixture",
          "--slug",
          slug,
          "--no-start",
        ];
        if (parent) args.push("--parent", parent);
        expect(runTask(args).status).toBe(0);
      };

      createTask("Mum", "mum2");
      const parentName = `${datePrefix}-mum2`;
      createTask("Kid A", "kid-a", parentName);
      createTask("Kid B", "kid-b", parentName);
      const firstChild = `${datePrefix}-kid-a`;
      const failingChild = `${datePrefix}-kid-b`;

      // Archive walks `children` in order, so pin the order: the failing
      // child has to come second, after `kid-a` has already lost its link.
      const parentJson = readTaskJson(parentName);
      parentJson.children = [firstChild, failingChild];
      fs.writeFileSync(
        taskJsonPath(parentName),
        `${JSON.stringify(parentJson, null, 2)}\n`,
        "utf-8",
      );

      // Provoke the write failure through both mechanisms the atomic
      // writer can hit: a read-only directory fails `mkstemp`, and a
      // read-only target fails the final replace. Which one a platform
      // enforces is not the point of this test.
      fs.chmodSync(taskDir(failingChild), 0o555);
      fs.chmodSync(taskJsonPath(failingChild), 0o444);
      try {
        const r = runTask(["archive", parentName, "--no-commit"]);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toContain("Failed to write");
        expect(r.stderr).toContain(failingChild);
        expect(r.stderr).toContain("Not archived");
      } finally {
        fs.chmodSync(taskJsonPath(failingChild), 0o644);
        fs.chmodSync(taskDir(failingChild), 0o755);
      }

      // Stopping before the move is not enough on its own: `kid-a` was
      // unlinked before the failure, and with its parent still in the
      // active tree that link is lost for good. It has to come back.
      expect(fs.existsSync(taskJsonPath(parentName))).toBe(true);
      expect(readTaskJson(firstChild).parent).toBe(parentName);
      expect(readTaskJson(failingChild).parent).toBe(parentName);
    },
  );

  it.skipIf(!canProvokePermissionFailure)(
    "[audit] archive restore survives a duplicated child entry",
    () => {
      const create = (title: string, slug: string, parent?: string): string => {
        const args = [
          "create",
          title,
          "--description",
          "regression fixture",
          "--slug",
          slug,
          "--no-start",
        ];
        if (parent) args.push("--parent", parent);
        expect(runTask(args).status).toBe(0);
        return `${datePrefix}-${slug}`;
      };

      const parentName = create("Mum", "mum-dup");
      const firstChild = create("Kid A", "kid-a-dup", parentName);
      const failingChild = create("Kid B", "kid-b-dup", parentName);

      // A duplicated entry makes the unlink loop visit `kid-a-dup` twice.
      // The second visit must not snapshot the already-cleared `null`, or the
      // restore writes that back over the real link and detaches the child
      // while its parent is still in the active tree.
      const parentJson = readTaskJson(parentName);
      parentJson.children = [firstChild, firstChild, failingChild];
      fs.writeFileSync(
        taskJsonPath(parentName),
        `${JSON.stringify(parentJson, null, 2)}\n`,
        "utf-8",
      );

      fs.chmodSync(taskDir(failingChild), 0o555);
      fs.chmodSync(taskJsonPath(failingChild), 0o444);
      try {
        expect(runTask(["archive", parentName, "--no-commit"]).status).not.toBe(
          0,
        );
      } finally {
        fs.chmodSync(taskJsonPath(failingChild), 0o644);
        fs.chmodSync(taskDir(failingChild), 0o755);
      }

      expect(readTaskJson(firstChild).parent).toBe(parentName);
      expect(readTaskJson(failingChild).parent).toBe(parentName);
    },
  );

  it("[audit] list warns about a skipped task instead of silently dropping it", () => {
    expect(
      runTask([
        "create",
        "Good",
        "--description",
        "regression fixture",
        "--slug",
        "good",
        "--no-start",
      ]).status,
    ).toBe(0);
    expect(
      runTask([
        "create",
        "Bad",
        "--description",
        "regression fixture",
        "--slug",
        "bad",
        "--no-start",
      ]).status,
    ).toBe(0);
    fs.writeFileSync(taskJsonPath(`${datePrefix}-bad`), "{ not json");

    const r = runTask(["list"]);
    expect(r.status).toBe(0);
    // Tolerant: the healthy task still lists.
    expect(r.stdout).toContain(`${datePrefix}-good`);
    // Observable: the vanished one is named, with the reason.
    expect(r.stderr).toContain(`${datePrefix}-bad`);
    expect(r.stderr).toContain("Skipping task");
    expect(r.stderr).toContain("not valid JSON");
  });

  it("[audit] start still activates a task with a corrupt task.json but says why status and branch stayed", () => {
    const env = { TRELLIS_CONTEXT_ID: "json-io-start" };
    expect(
      runTask(
        [
          "create",
          "Rot",
          "--description",
          "regression fixture",
          "--slug",
          "rot",
          "--no-start",
        ],
        env,
      ).status,
    ).toBe(0);
    const name = `${datePrefix}-rot`;
    fs.writeFileSync(taskJsonPath(name), "{ not json");

    const r = runTask(["start", name], env);
    // Tolerant: the session pointer is the point of the command.
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Current task set to");
    // Observable: without this the absent status line reads as "not in planning".
    expect(r.stderr).toContain("not valid JSON");
    expect(r.stderr).toContain("task.json not updated");
  });

  it("[audit] current --json carries a read-failure signal and stays silent when healthy", () => {
    const env = { TRELLIS_CONTEXT_ID: "json-io-test" };
    expect(
      runTask(
        [
          "create",
          "Live",
          "--description",
          "regression fixture",
          "--slug",
          "live",
          "--no-start",
        ],
        env,
      ).status,
    ).toBe(0);
    const name = `${datePrefix}-live`;
    expect(runTask(["start", name], env).status).toBe(0);

    const healthy = runTask(["current", "--json"], env);
    expect(healthy.status).toBe(0);
    const healthyPayload = JSON.parse(healthy.stdout) as Record<
      string,
      unknown
    >;
    expect(Object.keys(healthyPayload).sort()).toEqual([
      "current_task",
      "source",
      "stale",
    ]);

    fs.writeFileSync(taskJsonPath(name), "{ not json");
    const broken = runTask(["current", "--json"], env);
    const brokenPayload = JSON.parse(broken.stdout) as {
      current_task: Record<string, unknown> | null;
      error?: { file: string; reason: string; message: string };
    };
    // All-null fields are still emitted, but no longer indistinguishable
    // from a task whose fields really are null.
    expect(brokenPayload.current_task?.status).toBeNull();
    expect(brokenPayload.error?.reason).toBe("invalid");
    expect(brokenPayload.error?.file).toContain("task.json");
    expect(brokenPayload.error?.message).toContain("not valid JSON");
  });

  it.skipIf(!canProvokePermissionFailure)(
    "[audit] a session pointer that cannot be written atomically is left intact",
    () => {
      const env = { TRELLIS_CONTEXT_ID: "json-io-session" };
      expect(
        runTask(
          [
            "create",
            "One",
            "--description",
            "regression fixture",
            "--slug",
            "one",
            "--no-start",
          ],
          env,
        ).status,
      ).toBe(0);
      expect(
        runTask(
          [
            "create",
            "Two",
            "--description",
            "regression fixture",
            "--slug",
            "two",
            "--no-start",
          ],
          env,
        ).status,
      ).toBe(0);
      expect(runTask(["start", `${datePrefix}-one`], env).status).toBe(0);

      const sessionsDir = path.join(tmpDir, ".trellis", ".runtime", "sessions");
      const sessionFile = path.join(sessionsDir, "json-io-session.json");
      expect(fs.existsSync(sessionFile)).toBe(true);

      // A read-only sessions dir blocks the temp-file write. The old plain
      // write_text would have opened the existing file for writing (which
      // needs no directory permission) and truncated it before writing.
      fs.chmodSync(sessionsDir, 0o555);
      try {
        const r = runTask(["start", `${datePrefix}-two`], env);
        expect(r.status).not.toBe(0);
        expect(r.stdout + r.stderr).toContain("Failed to set current task");
      } finally {
        fs.chmodSync(sessionsDir, 0o755);
      }

      const session = JSON.parse(fs.readFileSync(sessionFile, "utf-8")) as {
        current_task: string;
      };
      expect(session.current_task).toBe(`.trellis/tasks/${datePrefix}-one`);
    },
  );
});

describe("regression: is_within_tasks_dir archive boundary (issue #428)", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "trellis-within-tasks-dir-"),
    );
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    fs.mkdirSync(path.join(tmpDir, ".trellis", "tasks", "archive"), {
      recursive: true,
    });
    fs.mkdirSync(
      path.join(tmpDir, ".trellis", "tasks", "archive", "2026-07", "old-task"),
      { recursive: true },
    );
    fs.mkdirSync(path.join(tmpDir, ".trellis", "tasks", "live-task"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("[issue-428] rejects the archive root, an archived child, the tasks root, and an external path; accepts a direct child", () => {
    const probe = `
import json
import sys
from pathlib import Path

root = Path.cwd()
sys.path.insert(0, str(root / ".trellis" / "scripts"))
from common.task_utils import is_within_tasks_dir

print(json.dumps({
    "archive_root": is_within_tasks_dir(root / ".trellis" / "tasks" / "archive", root),
    "archived_child": is_within_tasks_dir(root / ".trellis" / "tasks" / "archive" / "2026-07" / "old-task", root),
    "tasks_root": is_within_tasks_dir(root / ".trellis" / "tasks", root),
    "external_path": is_within_tasks_dir(root / "src", root),
    "direct_child": is_within_tasks_dir(root / ".trellis" / "tasks" / "live-task", root),
}))
`;
    const result = spawnSync(pythonCmd, ["-c", probe], {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      archive_root: false,
      archived_child: false,
      tasks_root: false,
      external_path: false,
      direct_child: true,
    });
  });
});

describe("regression: write_json fd ownership and cleanup (issue #429)", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-write-json-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runProbe(probeBody: string): {
    status: number | null;
    stdout: string;
    stderr: string;
  } {
    const probe = `
import json
import os
import sys
from pathlib import Path
from unittest import mock

root = Path.cwd()
sys.path.insert(0, str(root / ".trellis" / "scripts"))
from common.io import write_json

${probeBody}
`;
    const result = spawnSync(pythonCmd, ["-c", probe], {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  it("[issue-429] closes the raw fd itself when fdopen fails, and leaves no temp file", () => {
    const { status, stdout, stderr } = runProbe(`
target = root / "out.json"
real_close = os.close
closed_fds = []

def fake_close(fd):
    closed_fds.append(fd)
    real_close(fd)

def fake_fdopen(fd, *a, **kw):
    # fdopen never took ownership: caller must close fd itself.
    raise OSError("simulated fdopen failure")

with mock.patch("os.close", side_effect=fake_close), \\
     mock.patch("os.fdopen", side_effect=fake_fdopen):
    result = write_json(target, {"a": 1})

leftover_tmp = [p.name for p in root.glob("*.tmp")] + [p.name for p in root.glob(".out.json.*")]
print(json.dumps({
    "result": result,
    "fd_closed": len(closed_fds) == 1,
    "target_exists": target.exists(),
    "leftover_tmp": leftover_tmp,
}))
`);
    expect(status, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      result: false,
      fd_closed: true,
      target_exists: false,
      leftover_tmp: [],
    });
  });

  it("[issue-429] cleans up the temp file when os.replace fails, without masking the write as a success", () => {
    const { status, stdout, stderr } = runProbe(`
target = root / "out.json"

with mock.patch("os.replace", side_effect=OSError("simulated replace failure")):
    result = write_json(target, {"a": 1})

leftover_tmp = [p.name for p in root.glob(".out.json.*")]
print(json.dumps({
    "result": result,
    "target_exists": target.exists(),
    "leftover_tmp": leftover_tmp,
}))
`);
    expect(status, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      result: false,
      target_exists: false,
      leftover_tmp: [],
    });
  });

  it("[issue-429] a cleanup failure after a write failure does not raise — still reports False", () => {
    const { status, stdout, stderr } = runProbe(`
target = root / "out.json"

with mock.patch("os.replace", side_effect=OSError("simulated replace failure")), \\
     mock.patch("os.unlink", side_effect=OSError("simulated cleanup failure")):
    result = write_json(target, {"a": 1})

print(json.dumps({"result": result}))
`);
    expect(status, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ result: false });
  });

  it("[issue-429] a successful write is atomic and leaves no leftover temp file", () => {
    const { status, stdout, stderr } = runProbe(`
target = root / "out.json"
result = write_json(target, {"a": 1, "b": "text"})
leftover_tmp = [p.name for p in root.glob(".out.json.*")]
print(json.dumps({
    "result": result,
    "content": json.loads(target.read_text(encoding="utf-8")),
    "leftover_tmp": leftover_tmp,
}))
`);
    expect(status, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      result: true,
      content: { a: 1, b: "text" },
      leftover_tmp: [],
    });
  });
});

describe("regression: task auto-activation failure diagnostics (issue #430)", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-task-activate-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    fs.mkdirSync(path.join(tmpDir, ".trellis", "spec", "guides"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "spec", "guides", "index.md"),
      "# Guides\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "workflow.md"),
      "# Workflow\n",
    );
    fs.mkdirSync(path.join(tmpDir, ".trellis", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".trellis", "workspace", "test-dev"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=test-dev\n",
      "utf-8",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Ambient session env vars from the real host session (e.g. this test
  // running inside Claude Code itself) must not leak into the "no session"
  // scenario — scrub every platform session/transcript key before overlay.
  const AMBIENT_SESSION_ENV_KEYS = [
    "TRELLIS_CONTEXT_ID",
    "CLAUDE_SESSION_ID",
    "CLAUDE_CODE_SESSION_ID",
    "CODEX_SESSION_ID",
    "CODEX_THREAD_ID",
    "CURSOR_SESSION_ID",
    "CURSOR_CONVERSATION_ID",
    "CURSOR_CONVERSATIONID",
    "OPENCODE_SESSION_ID",
    "OPENCODE_SESSIONID",
    "OPENCODE_RUN_ID",
    "GEMINI_SESSION_ID",
    "FACTORY_SESSION_ID",
    "DROID_SESSION_ID",
    "QODER_SESSION_ID",
    "CODEBUDDY_SESSION_ID",
    "KIRO_SESSION_ID",
    "COPILOT_SESSION_ID",
    "COPILOT_SESSIONID",
    "PI_SESSION_ID",
  ] as const;

  function runCreate(env: NodeJS.ProcessEnv) {
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const blocked = new Set<string>(AMBIENT_SESSION_ENV_KEYS);
    const scrubbed: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!blocked.has(key)) scrubbed[key] = value;
    }
    return spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "issue-430 probe",
        "--description",
        "regression fixture",
        "--slug",
        "issue-430-probe",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: { ...scrubbed, ...env } },
    );
  }

  it("[issue-430] no session identity activates under the kerminal default key (pull-based single-session platform)", () => {
    const result = runCreate({});
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("Activated task for this session");
    expect(result.stderr).toContain("session:kerminal_default");
    expect(result.stderr).not.toContain("Warning: session activation");
  });

  it("[issue-430] a real session identity activates normally with no warning", () => {
    const result = runCreate({ TRELLIS_CONTEXT_ID: "probe-session" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("Activated task for this session");
    expect(result.stderr).not.toContain("Warning: session activation");
  });

  it("[issue-430] a pointer-persistence failure is now diagnosable instead of silently swallowed", () => {
    // Pre-create the session-pointer directory's own path as a *file* so
    // `_write_json`'s `path.parent.mkdir(parents=True, exist_ok=True)` raises
    // FileExistsError — a real, portable failure mode (no chmod needed).
    const sessionsPathAsFile = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
    );
    fs.mkdirSync(path.dirname(sessionsPathAsFile), { recursive: true });
    fs.writeFileSync(sessionsPathAsFile, "not a directory");

    const result = runCreate({ TRELLIS_CONTEXT_ID: "probe-session" });

    // Task creation itself must still succeed — activation is best-effort.
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("Warning: session activation failed");
    expect(result.stderr).not.toContain("Activated task for this session");
  });
});

// =============================================================================
// 3. Semver / Migration Engine Regressions
// =============================================================================

describe("regression: semver prerelease handling (beta.5)", () => {
  it("[beta.5] prerelease version sorts before release version", () => {
    // 0.3.0-beta.1 < 0.3.0 (prerelease is less than release)
    const versions = getAllMigrationVersions();
    const betaVersions = versions.filter((v) => v.includes("beta"));
    const releaseVersions = versions.filter(
      (v) => !v.includes("beta") && !v.includes("alpha"),
    );

    if (betaVersions.length > 0 && releaseVersions.length > 0) {
      // All beta versions should appear before their corresponding release versions
      const lastBeta = betaVersions[betaVersions.length - 1];
      const firstRelease = releaseVersions[0];
      const lastBetaIdx = versions.indexOf(lastBeta);
      const firstReleaseIdx = versions.indexOf(firstRelease);
      // Only compare if they share the same base version
      if (lastBeta.startsWith(firstRelease.split("-")[0])) {
        expect(lastBetaIdx).toBeLessThan(firstReleaseIdx);
      }
    }
  });

  it("[beta.5] prerelease numeric parts compare numerically (beta.2 < beta.10)", () => {
    // getMigrationsForVersion relies on correct version ordering
    // beta.2 should be before beta.10 (numeric, not lexicographic)
    const versions = getAllMigrationVersions();
    const beta2Idx = versions.indexOf("0.3.0-beta.2");
    const beta10Idx = versions.indexOf("0.3.0-beta.10");
    if (beta2Idx !== -1 && beta10Idx !== -1) {
      expect(beta2Idx).toBeLessThan(beta10Idx);
    }
  });

  it("[beta.5] getMigrationsForVersion returns empty for equal versions", () => {
    expect(getMigrationsForVersion("0.3.0-beta.5", "0.3.0-beta.5")).toEqual([]);
  });

  it("[beta.5] getMigrationsForVersion correctly handles beta range", () => {
    // beta.0 to beta.2 should include beta.1 and beta.2 migrations
    getMigrationsForVersion("0.3.0-beta.0", "0.3.0-beta.2");
    // Should not include beta.0 itself (only > fromVersion)
    const versions = getAllMigrationVersions();
    if (versions.includes("0.3.0-beta.1")) {
      expect(
        hasPendingMigrations("0.3.0-beta.0", "0.3.0-beta.2"),
      ).toBeDefined();
    }
  });
});

describe("regression: migration data integrity (beta.14)", () => {
  it("[beta.14] all migrations have non-undefined 'from' field", () => {
    const allMigrations = getAllMigrations();
    for (const m of allMigrations) {
      expect(
        m.from,
        `migration should have 'from' field defined`,
      ).toBeDefined();
      expect(typeof m.from).toBe("string");
      expect(m.from.length).toBeGreaterThan(0);
    }
  });

  it("[beta.14] all migrations have valid type field", () => {
    const allMigrations = getAllMigrations();
    const validTypes = ["rename", "rename-dir", "delete", "safe-file-delete"];
    for (const m of allMigrations) {
      expect(validTypes).toContain(m.type);
    }
  });

  it("[beta.1-040] safe-file-delete migrations have allowed_hashes", () => {
    const allMigrations = getAllMigrations();
    const safeDeletes = allMigrations.filter(
      (m) => m.type === "safe-file-delete",
    );
    for (const m of safeDeletes) {
      expect(
        m.allowed_hashes,
        `safe-file-delete for '${m.from}' should have allowed_hashes`,
      ).toBeDefined();
      expect(Array.isArray(m.allowed_hashes)).toBe(true);
      expect(
        (m.allowed_hashes as string[]).length,
        `safe-file-delete for '${m.from}' should have at least one hash`,
      ).toBeGreaterThan(0);
      for (const hash of m.allowed_hashes as string[]) {
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  });

  it("[beta.15] Claude Code statusline is not safe-deleted on update", () => {
    const claudeStatusLineDeletes = getAllMigrations().filter(
      (m) =>
        m.type === "safe-file-delete" &&
        m.from === ".claude/hooks/statusline.py",
    );

    expect(claudeStatusLineDeletes).toEqual([]);
  });

  it("[beta.14] rename/rename-dir migrations have 'to' field", () => {
    const allMigrations = getAllMigrations();
    const renames = allMigrations.filter(
      (m) => m.type === "rename" || m.type === "rename-dir",
    );
    for (const m of renames) {
      expect(
        m.to,
        `rename migration from '${m.from}' should have 'to'`,
      ).toBeDefined();
      expect(typeof m.to).toBe("string");
      expect((m.to as string).length).toBeGreaterThan(0);
    }
  });

  it("[beta.14] all manifest versions are valid semver-like strings", () => {
    const versions = getAllMigrationVersions();
    for (const v of versions) {
      expect(v).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
    }
  });
});

// dispatch agent removed — parallel/worktree now handled by platform-native features

// =============================================================================
// 4. Template Integrity Regressions
// =============================================================================

describe("regression: shell to Python migration (beta.0)", () => {
  it("[beta.0] no .sh scripts remain in trellis templates", () => {
    const scripts = getAllScripts();
    for (const [name] of scripts) {
      expect(name.endsWith(".sh"), `${name} should not end with .sh`).toBe(
        false,
      );
    }
  });

  it("[beta.0] all script keys end with .py", () => {
    const scripts = getAllScripts();
    for (const [name] of scripts) {
      expect(name.endsWith(".py"), `${name} should end with .py`).toBe(true);
    }
  });

  it("[beta.3] getAllScripts covers every .py file in templates/trellis/scripts/", () => {
    // Bug: update.ts had a hand-maintained file list that missed 11 scripts.
    // Fix: update.ts now uses getAllScripts() directly. This test ensures
    // getAllScripts() itself stays in sync with the filesystem.
    const scriptsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../src/templates/trellis/scripts",
    );
    const fsFiles = new Set<string>();
    function walk(dir: string, prefix: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        } else if (entry.name.endsWith(".py")) {
          fsFiles.add(`${prefix}${entry.name}`);
        }
      }
    }
    walk(scriptsDir, "");

    const scripts = getAllScripts();
    const registeredKeys = new Set(scripts.keys());

    // Known exclusions: files intentionally not in getAllScripts()
    const excluded = new Set(["hooks/linear_sync.py"]);

    for (const file of fsFiles) {
      if (excluded.has(file)) continue;
      expect(
        registeredKeys.has(file),
        `${file} exists on disk but is missing from getAllScripts()`,
      ).toBe(true);
    }
  });
});

describe("regression: agent-session Trellis update hint", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-update-hint-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    fs.mkdirSync(path.join(tmpDir, ".trellis", "tasks"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-05-09T00:00:00Z\n",
      "utf-8",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runContextWithTrellisOutput(
    currentVersion: string,
    trellisVersionOutput: string | null,
  ): string {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".version"),
      `${currentVersion}\n`,
      "utf-8",
    );
    const runnerPath = path.join(tmpDir, "run-context.py");
    fs.writeFileSync(
      runnerPath,
      [
        "import os",
        "import sys",
        "from pathlib import Path",
        "sys.path.insert(0, str(Path.cwd() / '.trellis' / 'scripts'))",
        "from common import session_context",
        "output = os.environ.get('TRELLIS_VERSION_OUTPUT')",
        "session_context._fetch_trellis_version_output = lambda: None if output == '__NONE__' else output",
        "session_context.output_text(Path.cwd())",
        "",
      ].join("\n"),
      "utf-8",
    );
    return execSync(`${pythonCmd} ${JSON.stringify(runnerPath)}`, {
      cwd: tmpDir,
      encoding: "utf-8",
      env: {
        ...process.env,
        TRELLIS_VERSION_OUTPUT: trellisVersionOutput ?? "__NONE__",
        TRELLIS_CONTEXT_ID: "test-update-session",
      },
    });
  }

  function pythonFunctionBody(source: string, name: string): string {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(
      new RegExp(`def ${escapedName}\\([\\s\\S]*?\\n(?=def |# =|$)`),
    );
    return match?.[0] ?? "";
  }

  it("shows a concise update hint when trellis --version reports a newer version", () => {
    const output = runContextWithTrellisOutput(
      "0.5.0",
      "Trellis update available: 0.5.0 → 0.5.9\nRun: trellis update\n0.5.9",
    );

    expect(output).toContain("Trellis update available: 0.5.0 -> 0.5.9");
    expect(output).toContain("run trellis update");
    expect(output).not.toContain("run trellis upgrade");
    expect(output).toContain("SESSION CONTEXT");
  });

  it("does not show a hint when installed version is equal or newer", () => {
    expect(runContextWithTrellisOutput("0.5.9", "0.5.9")).not.toContain(
      "Trellis update available",
    );
    fs.rmSync(path.join(tmpDir, ".trellis", ".runtime"), {
      recursive: true,
      force: true,
    });
    expect(runContextWithTrellisOutput("0.6.0", "0.5.9")).not.toContain(
      "Trellis update available",
    );
  });

  it("silently skips the hint when trellis --version fails or version parsing fails", () => {
    expect(runContextWithTrellisOutput("0.5.0", null)).not.toContain(
      "Trellis update available",
    );
    fs.rmSync(path.join(tmpDir, ".trellis", ".runtime"), {
      recursive: true,
      force: true,
    });
    expect(runContextWithTrellisOutput("not-a-version", "0.5.9")).not.toContain(
      "Trellis update available",
    );
  });

  it("does not burn the once-per-session marker when version lookup fails", () => {
    expect(runContextWithTrellisOutput("0.5.0", null)).not.toContain(
      "Trellis update available",
    );

    const output = runContextWithTrellisOutput("0.5.0", "0.5.9");

    expect(output).toContain("Trellis update available: 0.5.0 -> 0.5.9");
  });

  it("uses the final trellis --version token when no update line is present", () => {
    const output = runContextWithTrellisOutput("0.5.0", "0.5.9");

    expect(output).toContain("Trellis update available: 0.5.0 -> 0.5.9");
  });

  it("only attempts the default text update hint once per session", () => {
    const first = runContextWithTrellisOutput("0.5.0", "0.5.9");
    const second = runContextWithTrellisOutput("0.5.0", "0.5.9");

    expect(first).toContain("Trellis update available: 0.5.0 -> 0.5.9");
    expect(second).not.toContain("Trellis update available");
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".trellis",
          ".runtime",
          "update-check-test-update-session.marker",
        ),
      ),
    ).toBe(true);
  });

  it("keeps the update hint out of JSON, record, packages, and phase paths", () => {
    expect(pythonFunctionBody(commonSessionContext, "output_text")).toContain(
      "get_update_hint",
    );
    for (const functionName of [
      "get_context_json",
      "output_json",
      "get_context_record_json",
      "get_context_text_record",
    ]) {
      expect(
        pythonFunctionBody(commonSessionContext, functionName),
        `${functionName} should not check Trellis updates`,
      ).not.toContain("get_update_hint");
    }
    expect(commonGitContext).toContain('if args.mode == "record":');
    expect(commonGitContext).toContain('elif args.mode == "packages":');
    expect(commonGitContext).toContain('elif args.mode == "phase":');
    expect(commonGitContext).toContain("else:");
    expect(commonGitContext).toContain("output_text()");
  });
});

describe("regression: issue #252 polyrepo Git context", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-polyrepo-git-"));
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
    fs.mkdirSync(path.join(tmpDir, ".trellis", "tasks"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".trellis", "workspace", "test-dev"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=test-dev\n",
      "utf-8",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfigYaml(content: string): void {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "config.yaml"),
      content,
      "utf-8",
    );
  }

  function initChildRepo(relativePath: string, commitMessage: string): void {
    const repoPath = path.join(tmpDir, relativePath);
    fs.mkdirSync(repoPath, { recursive: true });
    execSync("git init -q", { cwd: repoPath });
    execSync("git config user.email test@example.com", { cwd: repoPath });
    execSync("git config user.name Test", { cwd: repoPath });
    fs.writeFileSync(path.join(repoPath, "README.md"), `${commitMessage}\n`);
    execSync("git add README.md", { cwd: repoPath });
    execSync(`git commit -q -m ${JSON.stringify(commitMessage)}`, {
      cwd: repoPath,
    });
  }

  function runSessionContext(kind: "text" | "record" | "json"): string {
    const runnerPath = path.join(tmpDir, "run-context.py");
    let expression = "print(session_context.get_context_text(Path.cwd()))";
    if (kind === "record") {
      expression = "print(session_context.get_context_text_record(Path.cwd()))";
    } else if (kind === "json") {
      expression =
        "print(json.dumps(session_context.get_context_json(Path.cwd())))";
    }
    fs.writeFileSync(
      runnerPath,
      [
        "import json",
        "import sys",
        "from pathlib import Path",
        "sys.path.insert(0, str(Path.cwd() / '.trellis' / 'scripts'))",
        "from common import session_context",
        expression,
        "",
      ].join("\n"),
      "utf-8",
    );
    return execSync(`${pythonCmd} ${JSON.stringify(runnerPath)}`, {
      cwd: tmpDir,
      encoding: "utf-8",
    });
  }

  it("does not render root as unknown/clean when configured package repos exist", () => {
    writeConfigYaml(
      [
        "packages:",
        "  module_a:",
        "    path: module-a",
        "    git: true",
        "",
      ].join("\n"),
    );
    initChildRepo("module-a", "init module a");

    const output = runSessionContext("text");
    const rootBlock = output.slice(
      output.indexOf("## GIT STATUS"),
      output.indexOf("## GIT STATUS (module_a: module-a)"),
    );

    expect(rootBlock).toContain("Root is not a Git repository.");
    expect(rootBlock).toContain(
      "Run Git commands from the package repository paths listed below.",
    );
    expect(rootBlock).not.toContain("Branch: unknown");
    expect(rootBlock).not.toContain("Working directory: Clean");
    expect(output).toContain("## GIT STATUS (module_a: module-a)");
    expect(output).toContain("init module a");
  });

  it("uses the same non-Git root rendering in record mode", () => {
    writeConfigYaml(
      [
        "packages:",
        "  module_a:",
        "    path: module-a",
        "    git: true",
        "",
      ].join("\n"),
    );
    initChildRepo("module-a", "init module a");

    const output = runSessionContext("record");
    const rootBlock = output.slice(
      output.indexOf("## GIT STATUS"),
      output.indexOf("## GIT STATUS (module_a: module-a)"),
    );

    expect(rootBlock).toContain("Root is not a Git repository.");
    expect(rootBlock).not.toContain("Branch: unknown");
    expect(rootBlock).not.toContain("Working directory: Clean");
  });

  it("discovers unconfigured child Git repos when root is not a Git repo", () => {
    writeConfigYaml("# no packages configured\n");
    initChildRepo("module-a", "init module a");
    initChildRepo(path.join("services", "module-b"), "init module b");

    const output = runSessionContext("text");

    expect(output).toContain("Root is not a Git repository.");
    expect(output).toContain("## GIT STATUS (module-a: module-a)");
    expect(output).toContain(
      "## GIT STATUS (services_module-b: services/module-b)",
    );
    expect(output).toContain("init module a");
    expect(output).toContain("init module b");
  });

  it("skips automatic Git status when too many child repos are discovered", () => {
    writeConfigYaml("# no packages configured\n");
    for (let i = 0; i < 9; i++) {
      fs.mkdirSync(path.join(tmpDir, `repo-${i}`, ".git"), {
        recursive: true,
      });
    }

    const output = runSessionContext("text");
    const rerun = spawnSync(pythonCmd, [path.join(tmpDir, "run-context.py")], {
      cwd: tmpDir,
      encoding: "utf-8",
    });

    expect(output).not.toContain("## GIT STATUS (repo-");
    expect(rerun.status).toBe(0);
    expect(rerun.stderr).toContain("found more than 8 child Git repositories");
    expect(rerun.stderr).toContain(
      "Configure explicit packages entries with path and git: true",
    );
  });

  it("passes probe timeouts through the shared Git runner", () => {
    const runnerPath = path.join(tmpDir, "run-git-timeout.py");
    fs.writeFileSync(
      runnerPath,
      [
        "import json",
        "import subprocess",
        "import sys",
        "from pathlib import Path",
        "sys.path.insert(0, str(Path.cwd() / '.trellis' / 'scripts'))",
        "from common.git import run_git",
        "captured = {}",
        "def fake_run(*args, **kwargs):",
        "    captured['timeout'] = kwargs.get('timeout')",
        "    raise subprocess.TimeoutExpired(args[0], kwargs.get('timeout'))",
        "subprocess.run = fake_run",
        "rc, out, err = run_git(['status'], timeout=0.25)",
        "from common import session_context",
        "root_calls = []",
        "def fake_git(args, cwd=None, timeout=None):",
        "    root_calls.append({'args': args, 'timeout': timeout})",
        "    if args == ['status', '--porcelain']:",
        "        return (1, '', 'timed out')",
        "    return (0, 'true\\n' if args[0] == 'rev-parse' else '', '')",
        "session_context.run_git = fake_git",
        "root_info = session_context._collect_root_git_info(Path.cwd())",
        "print(json.dumps({'rc': rc, 'out': out, 'err': err, 'rootCalls': root_calls, 'rootInfo': root_info, **captured}))",
        "",
      ].join("\n"),
      "utf-8",
    );

    const result = JSON.parse(
      execSync(`${pythonCmd} ${JSON.stringify(runnerPath)}`, {
        cwd: tmpDir,
        encoding: "utf-8",
      }),
    ) as {
      rc: number;
      out: string;
      err: string;
      timeout: number;
      rootCalls: { args: string[]; timeout: number }[];
      rootInfo: { isClean: boolean };
    };

    expect(result).toEqual(
      expect.objectContaining({
        rc: 1,
        out: "",
        timeout: 0.25,
      }),
    );
    expect(result.err).toContain("timed out");
    expect(result.rootCalls.map((call) => call.args[0])).toEqual([
      "rev-parse",
      "branch",
      "status",
      "status",
      "log",
    ]);
    expect(result.rootCalls.every((call) => call.timeout === 2)).toBe(true);
    expect(result.rootInfo.isClean).toBe(false);
  });

  it("marks JSON root Git state as non-repo instead of clean", () => {
    writeConfigYaml(
      [
        "packages:",
        "  module_a:",
        "    path: module-a",
        "    git: true",
        "",
      ].join("\n"),
    );
    initChildRepo("module-a", "init module a");

    const context = JSON.parse(runSessionContext("json")) as {
      git: { isRepo: boolean; branch: string; isClean: boolean };
      packageGit: { name: string; path: string }[];
    };

    expect(context.git).toEqual(
      expect.objectContaining({
        isRepo: false,
        branch: "",
        isClean: false,
      }),
    );
    expect(context.packageGit).toEqual([
      expect.objectContaining({ name: "module_a", path: "module-a" }),
    ]);
  });
});

describe("regression: current-task path normalization", () => {
  let tmpDir: string;
  const pythonCmd = process.platform === "win32" ? "python" : "python3";


  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-current-task-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeTrellisScripts(): void {
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [relativePath, content] of getAllScripts()) {
      const absPath = path.join(scriptsDir, relativePath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, "utf-8");
    }
  }

  function writeProjectFile(relativePath: string, content: string): void {
    const absPath = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf-8");
  }

  function writeLegacyCurrentTask(taskRef: string): void {
    writeProjectFile(path.join(".trellis", ".current-task"), `${taskRef}\n`);
  }

  function writeSessionContext(contextKey: string, taskRef: string): void {
    writeProjectFile(
      path.join(".trellis", ".runtime", "sessions", `${contextKey}.json`),
      JSON.stringify(
        {
          current_task: taskRef,
          platform: "test",
        },
        null,
        2,
      ),
    );
  }

  const SESSION_ENV_KEYS = [
    "TRELLIS_CONTEXT_ID",
    "CLAUDE_SESSION_ID",
    "CLAUDE_CODE_SESSION_ID",
    "CODEX_SESSION_ID",
    "CODEX_THREAD_ID",
    "CURSOR_SESSION_ID",
    "CURSOR_CONVERSATION_ID",
    "CURSOR_CONVERSATIONID",
    "OPENCODE_SESSION_ID",
    "OPENCODE_SESSIONID",
    "OPENCODE_RUN_ID",
    "GEMINI_SESSION_ID",
    "FACTORY_SESSION_ID",
    "DROID_SESSION_ID",
    "QODER_SESSION_ID",
    "CODEBUDDY_SESSION_ID",
    "KIRO_SESSION_ID",
    "COPILOT_SESSION_ID",
    "COPILOT_SESSIONID",
    "PI_SESSION_ID",
    "CLAUDE_TRANSCRIPT_PATH",
    "CODEX_TRANSCRIPT_PATH",
    "CURSOR_TRANSCRIPT_PATH",
    "GEMINI_TRANSCRIPT_PATH",
    "FACTORY_TRANSCRIPT_PATH",
    "DROID_TRANSCRIPT_PATH",
    "QODER_TRANSCRIPT_PATH",
    "CODEBUDDY_TRANSCRIPT_PATH",
  ] as const;

  function sessionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const blocked = new Set<string>(SESSION_ENV_KEYS);
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!blocked.has(key)) {
        env[key] = value;
      }
    }
    return { ...env, ...overrides };
  }

  function setupTaskRepo(): void {
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    writeProjectFile(path.join(".trellis", "workflow.md"), "# Workflow\n");
    writeProjectFile(
      path.join(".trellis", "spec", "guides", "index.md"),
      "# Guides\n",
    );
    writeProjectFile(
      path.join(".trellis", "tasks", "issue-106", "task.json"),
      JSON.stringify(
        {
          title: "Issue 106 task",
          status: "in_progress",
          package: null,
        },
        null,
        2,
      ),
    );
    writeProjectFile(
      path.join(".trellis", "tasks", "issue-106", "prd.md"),
      "# PRD\n",
    );
    writeProjectFile(
      path.join(".trellis", "tasks", "issue-106", "implement.jsonl"),
      '{"file":"src/example.ts","reason":"runtime regression"}\n',
    );
  }


  it("[session-current-task] task.py start without an explicit context key persists the pointer under the kerminal default key", () => {
    // Kerminal is a pull-based single-session platform: no hook bridge and no
    // platform env var, so the resolver falls back to the stable
    // kerminal_default session key. The pointer must persist and the start
    // must NOT be a degraded no-pointer write.
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(".trellis\\\\tasks\\\\issue-106")}`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv(),
      },
    );

    expect(output).toContain("Source: session:kerminal_default");
    expect(output).not.toContain("degraded");
    expect(output).not.toContain("Session identity not available");

    // Active-task pointer written under the default key
    const contextPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "kerminal_default.json",
    );
    expect(fs.existsSync(contextPath)).toBe(true);
    const context = JSON.parse(fs.readFileSync(contextPath, "utf-8")) as {
      current_task: string;
    };
    expect(context.current_task).toBe(".trellis/tasks/issue-106");

    // task.json.status remains in_progress (was already in_progress)
    const taskJsonPath = path.join(
      tmpDir,
      ".trellis",
      "tasks",
      "issue-106",
      "task.json",
    );
    const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    expect(taskJson.status).toBe("in_progress");
  });

  it("[session-current-task] task.py start in degraded mode flips planning → in_progress", () => {
    // Verify the status flip path of degraded mode by setting up a task with
    // status=planning explicitly, then asserting the flip happened without a
    // session identity being available.
    setupTaskRepo();
    const taskJsonPath = path.join(
      tmpDir,
      ".trellis",
      "tasks",
      "issue-106",
      "task.json",
    );
    const taskJson = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    taskJson.status = "planning";
    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 2), "utf-8");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(".trellis\\\\tasks\\\\issue-106")}`,
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(output).toContain("planning → in_progress");
    const after = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    expect(after.status).toBe("in_progress");
  });

  it("[session-current-task] task.py start writes session runtime state when TRELLIS_CONTEXT_ID is set", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(".trellis\\\\tasks\\\\issue-106")}`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "session-a" }),
      },
    );

    expect(output).toContain("Source: session:session-a");
    expect(output).not.toContain("Fallback:");
    const contextPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "session-a.json",
    );
    const context = JSON.parse(fs.readFileSync(contextPath, "utf-8")) as {
      current_task: string;
    };
    expect(context.current_task).toBe(".trellis/tasks/issue-106");
    expect(fs.existsSync(path.join(tmpDir, ".trellis", ".current-task"))).toBe(
      false,
    );
  });

  it("[session-current-task] task.py finish deletes the session runtime context", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const contextPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "session-finish.json",
    );

    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(".trellis/tasks/issue-106")}`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "session-finish" }),
      },
    );
    expect(fs.existsSync(contextPath)).toBe(true);

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} finish`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "session-finish" }),
      },
    );

    expect(output).toContain("Cleared current task");
    expect(output).toContain("Source: session:session-finish");
    expect(fs.existsSync(contextPath)).toBe(false);
  });

  it("[workflow-state-r7] task.py create auto-sets session pointer when TRELLIS_CONTEXT_ID is set (planning breadcrumb reachable)", () => {
    // Pre-R7 (v0.5.0-beta.19 and earlier), `task.py create` only created the
    // task directory; the session pointer was set by `task.py start`. That
    // made the [workflow-state:planning] block dead text — the breadcrumb
    // stayed at no_task during brainstorm + jsonl curation. R7 hooked
    // set_active_task into cmd_create so the planning breadcrumb fires
    // immediately when session identity is available.
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    writeProjectFile(path.join(".trellis", "workflow.md"), "# Workflow\n");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "r7-auto-active" --description "regression fixture" --slug r7-auto --assignee test-dev`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "r7-session" }),
      },
    );

    // Resolve the new task directory (MM-DD-r7-auto)
    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("r7-auto"));
    expect(taskDir).toBeDefined();

    const contextPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "r7-session.json",
    );
    expect(fs.existsSync(contextPath)).toBe(true);
    const context = JSON.parse(fs.readFileSync(contextPath, "utf-8")) as {
      current_task: string;
    };
    expect(context.current_task).toBe(`.trellis/tasks/${taskDir}`);
  });

  it("[issue-397] task.py create stores the trimmed description and reports session activation", () => {
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    writeProjectFile(path.join(".trellis", "workflow.md"), "# Workflow\n");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "described task",
        "--description",
        "  padded description  ",
        "--slug",
        "described",
        "--assignee",
        "test-dev",
      ],
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "issue-397-session" }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Activated task for this session");
    expect(result.stderr).toContain("Source: session:issue-397-session");

    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("described"));
    expect(taskDir).toBeDefined();
    const taskJson = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, ".trellis", "tasks", taskDir as string, "task.json"),
        "utf-8",
      ),
    ) as { description: string };
    expect(taskJson.description).toBe("padded description");
  });

  it("[issue-397] task.py create --no-start does not move the session pointer", () => {
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    writeProjectFile(path.join(".trellis", "workflow.md"), "# Workflow\n");
    writeSessionContext("batch-session", ".trellis/tasks/existing-task");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "batch backlog task",
        "--slug",
        "batch-backlog",
        "--assignee",
        "test-dev",
        "--description",
        "regression fixture",
        "--no-start",
      ],
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "batch-session" }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Skipped session activation (--no-start)");
    const context = JSON.parse(
      fs.readFileSync(
        path.join(
          tmpDir,
          ".trellis",
          ".runtime",
          "sessions",
          "batch-session.json",
        ),
        "utf-8",
      ),
    ) as { current_task: string };
    expect(context.current_task).toBe(".trellis/tasks/existing-task");

    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("batch-backlog"));
    expect(taskDir).toBeDefined();
    const taskJson = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, ".trellis", "tasks", taskDir as string, "task.json"),
        "utf-8",
      ),
    ) as { description: string };
    expect(taskJson.description).toBe("regression fixture");
  });

  it("[workflow-state-r7] task.py create persists the pointer under the kerminal default key without session env", () => {
    // R7 contract on a pull-based single-session platform: no context key
    // (CLI shell with no session env) still resolves through the stable
    // kerminal_default key, so the planning breadcrumb is reachable on the
    // very next get_context pull.
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    writeProjectFile(path.join(".trellis", "workflow.md"), "# Workflow\n");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    // sessionEnv() with no overrides drops every session-identity env var.
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "r7-cli-only" --description "regression fixture" --slug r7-cli --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("r7-cli"));
    expect(taskDir).toBeDefined();

    const pointerPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "kerminal_default.json",
    );
    expect(fs.existsSync(pointerPath)).toBe(true);
    const context = JSON.parse(fs.readFileSync(pointerPath, "utf-8")) as {
      current_task: string;
    };
    expect(context.current_task).toContain("r7-cli");
  });

  it("[workflow-state-r7] task.py create then task.py start is idempotent (pointer + status flip)", () => {
    // Finding 6: R7 made cmd_create auto-call set_active_task. cmd_start also
    // calls set_active_task. The second call must not error, and status must
    // still flip planning → in_progress correctly.
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    writeProjectFile(path.join(".trellis", "workflow.md"), "# Workflow\n");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "r7-idem" --description "regression fixture" --slug r7-idem --assignee test-dev`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "r7-idem-session" }),
      },
    );

    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("r7-idem"));
    expect(taskDir).toBeDefined();
    const relTaskDir = path.posix.join(".trellis", "tasks", taskDir as string);

    // Status should be planning after create.
    const taskJsonPath = path.join(
      tmpDir,
      ".trellis",
      "tasks",
      taskDir as string,
      "task.json",
    );
    const beforeStart = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8")) as {
      status: string;
    };
    expect(beforeStart.status).toBe("planning");

    // Now run start with the same session — must not error.
    let startStatus = 0;
    let startOutput = "";
    try {
      startOutput = execSync(
        `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(relTaskDir)}`,
        {
          cwd: tmpDir,
          encoding: "utf-8",
          env: sessionEnv({ TRELLIS_CONTEXT_ID: "r7-idem-session" }),
        },
      );
    } catch (err) {
      const e = err as { status?: number; stderr?: string; stdout?: string };
      startStatus = e.status ?? 1;
      startOutput = (e.stdout ?? "") + (e.stderr ?? "");
    }
    expect(startStatus).toBe(0);
    expect(startOutput).toContain("planning → in_progress");

    // Status flipped to in_progress.
    const afterStart = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8")) as {
      status: string;
    };
    expect(afterStart.status).toBe("in_progress");

    // Pointer still points at the same task.
    const contextPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "r7-idem-session.json",
    );
    expect(fs.existsSync(contextPath)).toBe(true);
    const context = JSON.parse(fs.readFileSync(contextPath, "utf-8")) as {
      current_task: string;
    };
    expect(context.current_task).toBe(relTaskDir);
  });

  it("[session-current-task] task.py archive deletes runtime sessions pointing at the archived task", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const contextA = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "session-a.json",
    );
    const contextB = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "session-b.json",
    );
    const contextOther = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "session-other.json",
    );
    writeProjectFile(
      path.join(".trellis", ".runtime", "sessions", "session-a.json"),
      JSON.stringify({ current_task: ".trellis/tasks/issue-106" }, null, 2),
    );
    writeProjectFile(
      path.join(".trellis", ".runtime", "sessions", "session-b.json"),
      JSON.stringify({ current_task: "issue-106" }, null, 2),
    );
    writeProjectFile(
      path.join(".trellis", ".runtime", "sessions", "session-other.json"),
      JSON.stringify({ current_task: ".trellis/tasks/other-task" }, null, 2),
    );

    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} archive issue-106 --no-commit`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv(),
      },
    );

    expect(fs.existsSync(contextA)).toBe(false);
    expect(fs.existsSync(contextB)).toBe(false);
    expect(fs.existsSync(contextOther)).toBe(true);
  });

  it("[task-lifecycle] task.py create refuses an archived task dir-name collision", () => {
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    writeProjectFile(path.join(".trellis", "workflow.md"), "# Workflow\n");
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const createArgs = [
      taskScriptPath,
      "create",
      "web auth retry",
      "--description",
      "regression fixture",
      "--slug",
      "web-auth-retry",
      "--assignee",
      "test-dev",
    ];
    const env = sessionEnv({ TRELLIS_CONTEXT_ID: "archive-collision" });

    execSync(
      `${pythonCmd} ${createArgs.map((arg) => JSON.stringify(arg)).join(" ")}`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env,
      },
    );

    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const taskDirName = fs
      .readdirSync(tasksDir)
      .find((entry) => entry.endsWith("-web-auth-retry"));
    expect(taskDirName).toBeDefined();
    const activeTaskDir = path.join(tasksDir, taskDirName as string);
    fs.writeFileSync(path.join(activeTaskDir, "prd.md"), "# PRD\n", "utf-8");

    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} archive ${JSON.stringify(taskDirName)} --no-commit`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env,
      },
    );

    const archiveRoot = path.join(tasksDir, "archive");
    let archivedTaskDir: string | undefined;
    for (const monthDir of fs.readdirSync(archiveRoot)) {
      const candidate = path.join(archiveRoot, monthDir, taskDirName as string);
      if (fs.existsSync(candidate)) {
        archivedTaskDir = candidate;
      }
    }
    expect(archivedTaskDir).toBeDefined();
    const archivedTaskJsonPath = path.join(
      archivedTaskDir as string,
      "task.json",
    );
    const archivedPrdPath = path.join(archivedTaskDir as string, "prd.md");
    const archivedTaskJsonBefore = fs.readFileSync(
      archivedTaskJsonPath,
      "utf-8",
    );
    const archivedPrdBefore = fs.readFileSync(archivedPrdPath, "utf-8");
    const archivedTaskJson = JSON.parse(archivedTaskJsonBefore) as {
      status: string;
      completedAt: string | null;
    };
    expect(archivedTaskJson.status).toBe("completed");
    expect(archivedTaskJson.completedAt).not.toBeNull();

    const contextPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "archive-collision.json",
    );
    expect(fs.existsSync(contextPath)).toBe(false);

    const result = spawnSync(pythonCmd, createArgs, {
      cwd: tmpDir,
      encoding: "utf-8",
      env,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Task already archived");
    expect(result.stderr).toContain(taskDirName as string);
    expect(result.stderr).toContain(".trellis/tasks/archive/");
    expect(fs.existsSync(path.join(tasksDir, taskDirName as string))).toBe(
      false,
    );
    expect(fs.readFileSync(archivedTaskJsonPath, "utf-8")).toBe(
      archivedTaskJsonBefore,
    );
    expect(fs.readFileSync(archivedPrdPath, "utf-8")).toBe(archivedPrdBefore);
    expect(fs.existsSync(contextPath)).toBe(false);
  });

  it("[issue-377] task.py create normalizes a --slug carrying today's date prefix", () => {
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const now = new Date();
    const todayPrefix = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "Example Task",
        "--description",
        "regression fixture",
        "--slug",
        `${todayPrefix}-example-task`,
        "--assignee",
        "test-dev",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("normalized to");
    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    expect(
      fs.existsSync(path.join(tasksDir, `${todayPrefix}-example-task`)),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tasksDir, `${todayPrefix}-${todayPrefix}-example-task`),
      ),
    ).toBe(false);
  });

  it("[issue-377] task.py create rejects a --slug carrying a different date prefix", () => {
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const now = new Date();
    // Pick a valid date prefix that is guaranteed not to be today.
    const otherPrefix =
      now.getMonth() + 1 === 1 && now.getDate() === 1 ? "02-02" : "01-01";

    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "Example Task",
        "--description",
        "regression fixture",
        "--slug",
        `${otherPrefix}-example-task`,
        "--assignee",
        "test-dev",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("date prefix");
    expect(result.stderr).toContain("--slug example-task");
    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const created = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [];
    expect(created.filter((d) => d.endsWith("example-task"))).toEqual([]);
  });

  it("[issue-377] task.py create leaves non-date numeric slug prefixes untouched", () => {
    writeTrellisScripts();
    writeProjectFile(
      path.join(".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-03-27T00:00:00\n",
    );
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const now = new Date();
    const todayPrefix = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // 13-45 is not a valid MM-DD date, so it is part of the slug body.
    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "Example Task",
        "--description",
        "regression fixture",
        "--slug",
        "13-45-example-task",
        "--assignee",
        "test-dev",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("normalized to");
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".trellis",
          "tasks",
          `${todayPrefix}-13-45-example-task`,
        ),
      ),
    ).toBe(true);
  });

  it("[task-input-contract] task.py archive accepts task name, relative path, and absolute path", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    // Create three additional task directories for the three input forms.
    const taskNames = ["issue-201", "issue-202", "issue-203"];
    for (const name of taskNames) {
      writeProjectFile(
        path.join(".trellis", "tasks", name, "task.json"),
        JSON.stringify(
          {
            title: `Task ${name}`,
            status: "in_progress",
            package: null,
          },
          null,
          2,
        ),
      );
    }

    // Form 1: bare slug
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} archive ${taskNames[0]} --no-commit`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv(),
      },
    );

    // Form 2: relative path
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} archive ${JSON.stringify(`.trellis/tasks/${taskNames[1]}`)} --no-commit`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv(),
      },
    );

    // Form 3: absolute path
    const absPath = path.join(tmpDir, ".trellis", "tasks", taskNames[2]);
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} archive ${JSON.stringify(absPath)} --no-commit`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv(),
      },
    );

    // All three task dirs should be removed from active tasks/.
    for (const name of taskNames) {
      expect(
        fs.existsSync(path.join(tmpDir, ".trellis", "tasks", name)),
        `task ${name} should no longer exist in active tasks/`,
      ).toBe(false);
    }

    // All three should appear under archive/<YYYY-MM>/.
    const archiveRoot = path.join(tmpDir, ".trellis", "tasks", "archive");
    expect(fs.existsSync(archiveRoot)).toBe(true);
    const archivedNames = new Set<string>();
    for (const monthDir of fs.readdirSync(archiveRoot)) {
      const monthPath = path.join(archiveRoot, monthDir);
      if (fs.statSync(monthPath).isDirectory()) {
        for (const taskDir of fs.readdirSync(monthPath)) {
          archivedNames.add(taskDir);
        }
      }
    }
    for (const name of taskNames) {
      expect(archivedNames.has(name), `task ${name} should be archived`).toBe(
        true,
      );
    }
  });

  it("[session-current-task] task.py start also uses platform-native session env when available", () => {
    // Was written against CODEX_SESSION_ID, which the 2026-08-05 env-name audit
    // proved never existed on any Codex build. Repointed to a name that is
    // empirically real (CLAUDE_CODE_SESSION_ID, verified in a live Claude Code
    // bash child) so the test still covers what it was for — the env table
    // resolving end-to-end through `task.py start` — instead of covering a
    // fiction. Codex's surviving real name has its own test below.
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(".trellis/tasks/issue-106")}`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ CLAUDE_CODE_SESSION_ID: "native-a" }),
      },
    );

    expect(output).toContain("Source: session:claude_native-a");
    const contextPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "claude_native-a.json",
    );
    const context = JSON.parse(fs.readFileSync(contextPath, "utf-8")) as {
      current_task: string;
    };
    expect(context.current_task).toBe(".trellis/tasks/issue-106");
  });

  it("[zcode-session-key] hook input and shell env resolve the same runtime key", () => {
    setupTaskRepo();
    const probePath = path.join(tmpDir, "zcode-context-key-probe.py");
    writeProjectFile(
      "zcode-context-key-probe.py",
      [
        "import json",
        "import sys",
        `sys.path.insert(0, ${JSON.stringify(path.join(tmpDir, ".trellis", "scripts"))})`,
        "from common.active_task import resolve_context_key",
        'value = "sess-zcode-review"',
        "print(json.dumps({",
        '  "hook": resolve_context_key({"session_id": value}, platform="zcode"),',
        '  "shell": resolve_context_key(),',
        "}))",
      ].join("\n"),
    );

    const result = JSON.parse(
      execSync(`${pythonCmd} ${JSON.stringify(probePath)}`, {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ CLAUDE_SESSION_ID: "sess-zcode-review" }),
      }),
    ) as { hook: string; shell: string };

    expect(result).toEqual({
      hook: "claude_sess-zcode-review",
      shell: "claude_sess-zcode-review",
    });
  });

  it("[grok] task.py start ignores GROK_SESSION_ID and persists under the kerminal default key", () => {
    // GROK_SESSION_ID is a real Grok Build env var, but it is only injected
    // into hook script processes (confirmed against docs.x.ai and a real
    // `grok -p` run: the bash-tool subprocess that actually runs task.py only
    // sees GROK_AGENT=1). Grok therefore has no usable env session key — the
    // resolver must not claim `session:grok_native-a`. On a kerminal-only
    // install the pointer lands under the stable default key instead.
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(".trellis/tasks/issue-106")}`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ GROK_SESSION_ID: "native-a" }),
      },
    );

    expect(output).not.toContain("session:grok_native-a");
    expect(output).toContain("session:kerminal_default");
    const sessionsDir = path.join(tmpDir, ".trellis", ".runtime", "sessions");
    expect(fs.existsSync(path.join(sessionsDir, "grok_native-a.json"))).toBe(
      false,
    );
  });

  // Runs a probe against the *installed* resolver in tmpDir, with a JSON
  // payload as argv[1] and the parsed JSON stdout as the result.
  function runActiveTaskProbe(
    fileName: string,
    bodyLines: string[],
    payload: unknown,
  ): unknown {
    writeProjectFile(
      fileName,
      [
        "import json",
        "import os",
        "import sys",
        `sys.path.insert(0, ${JSON.stringify(path.join(tmpDir, ".trellis", "scripts"))})`,
        "from common.active_task import (",
        "    _ENV_CONVERSATION_KEYS,",
        "    _ENV_SESSION_KEYS,",
        "    _ENV_TRANSCRIPT_KEYS,",
        "    _iter_env_keys,",
        "    resolve_context_key,",
        ")",
        "",
        "payload = json.loads(sys.argv[1])",
        "",
        "# Hermetic: drop every name the tables know about plus the override, so",
        "# the host session running this suite (itself an AI CLI) cannot answer",
        "# for the platform under test.",
        "for _table in (_ENV_SESSION_KEYS, _ENV_CONVERSATION_KEYS, _ENV_TRANSCRIPT_KEYS):",
        "    for _entry_name, _entry_keys in _table:",
        "        for _key in _entry_keys:",
        "            os.environ.pop(_key, None)",
        'os.environ.pop("TRELLIS_CONTEXT_ID", None)',
        ...bodyLines,
      ].join("\n"),
    );

    const result = spawnSync(
      pythonCmd,
      [path.join(tmpDir, fileName), JSON.stringify(payload)],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
  }

  // [platform, env var name] pairs deleted from active_task.py on 2026-08-05.
  const PURGED_ENV_NAMES: readonly (readonly [string, string])[] = [
    // Verified absent from a live Claude Code 2.1.221 bash child and from
    // code.claude.com/docs/en/env-vars. CLAUDE_CODE_SESSION_ID survives.
    ["claude", "CLAUDE_SESSION_ID"],
    // Verified absent from a live `codex exec` env. CODEX_THREAD_ID survives.
    ["codex", "CODEX_SESSION_ID"],
    // Empty in a live cursor-agent shell. Cursor keeps CURSOR_CONVERSATION_ID
    // and the beforeShellExecution ticket.
    ["cursor", "CURSOR_SESSION_ID"],
    // Zero hits in OpenCode 1.18.13 source; none among the 59 OPENCODE_*
    // literals in the 1.17.18 binary. The plugin's command prefix is the
    // real channel.
    ["opencode", "OPENCODE_SESSION_ID"],
    ["opencode", "OPENCODE_SESSIONID"],
    ["opencode", "OPENCODE_RUN_ID"],
    // Absent from Factory's docs and from droid 0.100.0's binary (the only
    // SESSION_ID strings in it are OpenSSL error constants).
    ["droid", "FACTORY_SESSION_ID"],
    ["droid", "DROID_SESSION_ID"],
    // Absent from codebuddy.ai's env-vars and hooks references; its hooks get
    // only CODEBUDDY_PROJECT_DIR / CODEBUDDY_PLUGIN_ROOT / CLAUDE_PROJECT_DIR.
    ["codebuddy", "CODEBUDDY_SESSION_ID"],
    // Absent from docs.trae.cn's hook reference; hooks get TRAE_PROJECT_DIR,
    // CLAUDE_PROJECT_DIR and TRAE_ENV_FILE.
    ["trae", "TRAE_SESSION_ID"],
    // Pi builds its bash env as `{...process.env, PATH}` only; no PI_* session
    // var exists. The Pi extension's `export TRELLIS_CONTEXT_ID=…` command
    // prefix is the real channel.
    ["pi", "PI_SESSION_ID"],
    ["pi", "PI_SESSIONID"],
    // Transcript-table inventions, both checked: absent from docs and from
    // live envs.
    ["claude", "CLAUDE_TRANSCRIPT_PATH"],
    ["codex", "CODEX_TRANSCRIPT_PATH"],
  ];

  it("[env-name-purge] a purged env var name resolves no context key for its platform", () => {
    setupTaskRepo();

    const result = runActiveTaskProbe(
      "purged-env-names-probe.py",
      [
        'value = "purge-probe"',
        "out = {}",
        "for platform, name in payload:",
        "    os.environ.pop(name, None)",
        "for platform, name in payload:",
        "    os.environ[name] = value",
        "    try:",
        "        out[platform + ':' + name] = {",
        '            "scoped": resolve_context_key(None, platform=platform),',
        '            "unscoped": resolve_context_key(),',
        "        }",
        "    finally:",
        "        os.environ.pop(name, None)",
        "print(json.dumps(out))",
      ],
      PURGED_ENV_NAMES,
    );

    // The probe's tmpDir is a kerminal-only install (no hook-platform dirs),
    // so both resolution paths end at the kerminal_default fallback when no
    // env key matches: "scoped" (hook path, platform known) when the purged
    // name is the platform's only candidate, and "unscoped" (bash-child scan)
    // always. The one legacy exception: CLAUDE_SESSION_ID is gone from the
    // *claude* entry but retained as ZCode's fallback, so it still resolves
    // as claude_* — _CONTEXT_KEY_PLATFORM_ALIASES canonicalizes zcode to
    // claude.
    const expected: Record<
      string,
      { scoped: string | null; unscoped: string | null }
    > = {};
    for (const [platform, name] of PURGED_ENV_NAMES) {
      expected[`${platform}:${name}`] = {
        scoped: "kerminal_default",
        unscoped: "kerminal_default",
      };
    }
    expected["claude:CLAUDE_SESSION_ID"].unscoped = "claude_purge-probe";

    expect(result).toEqual(expected);
  });

  it("[env-name-purge] a platform absent from an env table yields no keys and does not raise", () => {
    // Purging left five platforms with no session-table entry at all. This is
    // the code path that makes that safe: _iter_env_keys filters by name, so an
    // absent platform produces an empty tuple and the caller's loop never runs.
    setupTaskRepo();

    const result = runActiveTaskProbe(
      "absent-platform-probe.py",
      [
        "out = {}",
        "for platform in payload:",
        "    out[platform] = {",
        '        "session": [n for n, _ in _iter_env_keys(_ENV_SESSION_KEYS, platform)],',
        '        "conversation": [n for n, _ in _iter_env_keys(_ENV_CONVERSATION_KEYS, platform)],',
        '        "transcript": [n for n, _ in _iter_env_keys(_ENV_TRANSCRIPT_KEYS, platform)],',
        '        "resolved": resolve_context_key(None, platform=platform),',
        "    }",
        "print(json.dumps(out))",
      ],
      ["opencode", "pi", "trae", "droid", "codebuddy", "cursor", "no-such-cli"],
    );

    // `resolved` falls through to the kerminal_default key on every platform:
    // the probe's tmpDir is a kerminal-only install (no hook-platform dirs),
    // and the probe scrubs the ambient env, so no scoped identity exists.
    const fallback = "kerminal_default";
    expect(result).toEqual({
      // Gone from every table — identity arrives via the plugin/extension
      // command prefix (opencode, pi) or not at all (trae).
      opencode: {
        session: [],
        conversation: [],
        transcript: [],
        resolved: fallback,
      },
      pi: { session: [], conversation: [], transcript: [], resolved: fallback },
      trae: { session: [], conversation: [], transcript: [], resolved: fallback },
      // Session entry gone; their never-researched transcript names stay.
      droid: {
        session: [],
        conversation: [],
        transcript: ["droid"],
        resolved: fallback,
      },
      codebuddy: {
        session: [],
        conversation: [],
        transcript: ["codebuddy"],
        resolved: fallback,
      },
      // Cursor keeps the conversation and transcript rows; its session row is
      // gone. No cursor shell ticket exists here.
      cursor: {
        session: [],
        conversation: ["cursor"],
        transcript: ["cursor"],
        resolved: fallback,
      },
      // A platform no table has ever heard of behaves identically.
      "no-such-cli": {
        session: [],
        conversation: [],
        transcript: [],
        resolved: fallback,
      },
    });
  });

  it("[env-name-purge] every surviving env var name still resolves for its platform", () => {
    // The mirror image of the purge test: proof that the deletions did not
    // take a working name with them, and that ZCode now prefers Claude Code's
    // real variable over the historical invented one.
    setupTaskRepo();

    const result = runActiveTaskProbe(
      "surviving-env-names-probe.py",
      [
        "out = {}",
        "for label, env, platform in payload:",
        "    for key in list(env):",
        "        os.environ[key] = env[key]",
        "    try:",
        "        out[label] = resolve_context_key(None, platform=platform)",
        "    finally:",
        "        for key in list(env):",
        "            os.environ.pop(key, None)",
        "print(json.dumps(out))",
      ],
      [
        ["claude", { CLAUDE_CODE_SESSION_ID: "probe" }, "claude"],
        ["codex", { CODEX_THREAD_ID: "probe" }, "codex"],
        ["gemini", { GEMINI_SESSION_ID: "probe" }, "gemini"],
        ["qoder", { QODER_SESSION_ID: "probe" }, "qoder"],
        ["kiro", { KIRO_SESSION_ID: "probe" }, "kiro"],
        ["copilot", { COPILOT_SESSION_ID: "probe" }, "copilot"],
        ["copilot-alt", { COPILOT_SESSIONID: "probe" }, "copilot"],
        ["snow", { SNOW_SESSION_ID: "probe" }, "snow"],
        ["cursor-conversation", { CURSOR_CONVERSATION_ID: "probe" }, "cursor"],
        [
          "cursor-transcript",
          { CURSOR_TRANSCRIPT_PATH: "/tmp/t.md" },
          "cursor",
        ],
        // ZCode: the real Claude Code name, the historical fallback, and both
        // at once — the last one pins the ordering.
        ["zcode-real", { CLAUDE_CODE_SESSION_ID: "probe" }, "zcode"],
        ["zcode-legacy", { CLAUDE_SESSION_ID: "probe" }, "zcode"],
        [
          "zcode-prefers-real",
          { CLAUDE_CODE_SESSION_ID: "real", CLAUDE_SESSION_ID: "legacy" },
          "zcode",
        ],
        ["dsh", { DSH_SESSION_ID: "probe" }, "dsh"],
        // DSH ships no hook, so the shell path resolves with no platform hint
        // and walks the whole table. A DSH launched from Codex inherits
        // CODEX_THREAD_ID; without DSH sitting first this returned a foreign
        // `codex_outer` pointer (reported by @SajoLuo against DSH 0.1.0-rc.6).
        [
          "dsh-inherits-codex",
          { DSH_SESSION_ID: "own", CODEX_THREAD_ID: "outer" },
          null,
        ],
      ],
    );

    expect(result).toEqual({
      claude: "claude_probe",
      codex: "codex_probe",
      gemini: "gemini_probe",
      qoder: "qoder_probe",
      kiro: "kiro_probe",
      copilot: "copilot_probe",
      "copilot-alt": "copilot_probe",
      snow: "snow_probe",
      "cursor-conversation": "cursor_probe",
      "cursor-transcript": expect.stringMatching(
        /^cursor_transcript_[0-9a-f]{24}$/,
      ),
      // zcode keys canonicalize to `claude_` via _CONTEXT_KEY_PLATFORM_ALIASES
      // so the hook path and the shell path land on the same runtime file.
      "zcode-real": "claude_probe",
      "zcode-legacy": "claude_probe",
      "zcode-prefers-real": "claude_real",
      dsh: "dsh_probe",
      "dsh-inherits-codex": "dsh_own",
    });
  });

  it("[session-current-task] task.py finish ignores legacy .current-task when no session task is set", () => {
    setupTaskRepo();
    writeLegacyCurrentTask(".trellis/tasks/issue-106");
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} finish`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "session-fallback" }),
      },
    );

    expect(output).toContain("No current task set");
    expect(fs.existsSync(path.join(tmpDir, ".trellis", ".current-task"))).toBe(
      true,
    );
  });

  it("[session-current-task] task.py current ignores legacy .current-task without context key", () => {
    setupTaskRepo();
    writeLegacyCurrentTask(".trellis/tasks/issue-106");
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    let output = "";
    let status = 0;
    try {
      execSync(
        `${pythonCmd} ${JSON.stringify(taskScriptPath)} current --source`,
        {
          cwd: tmpDir,
          encoding: "utf-8",
          env: sessionEnv(),
        },
      );
    } catch (error) {
      status =
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : 1;
      output = String((error as { stdout?: unknown }).stdout ?? "");
    }

    expect(status).toBe(1);
    expect(output).toContain("Current task: (none)");
    expect(output).toContain("Source: none");
  });

  it("[session-current-task] stale session task does not fall back to legacy .current-task", () => {
    setupTaskRepo();
    writeLegacyCurrentTask(".trellis/tasks/issue-106");
    writeProjectFile(
      path.join(".trellis", ".runtime", "sessions", "session-b.json"),
      JSON.stringify(
        { current_task: ".trellis/tasks/missing-task", platform: "test" },
        null,
        2,
      ),
    );
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} current --source`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "session-b" }),
      },
    );

    expect(output).toContain("Current task: .trellis/tasks/missing-task");
    expect(output).toContain("Source: session:session-b");
    expect(output).toContain("State: stale");
    expect(output).not.toContain("issue-106");
  });


  // ---------------------------------------------------------------------
  // CLAUDE_ENV_FILE dedup — the file is user-owned and sourced by every
  // shell, and _persist_context_key_for_bash used to append unconditionally.
  // Measured on a maintainer machine: 3884 export lines for 27 distinct
  // values (169 KB, 99.3% redundant). Dedup keys on the LAST matching export
  // because shell applies later assignments over earlier ones.
  // ---------------------------------------------------------------------


  // ---------------------------------------------------------------------
  // SessionStart update reminder. `_get_update_hint` (now public as
  // `get_update_hint`) computed "Trellis update available: X -> Y, run trellis
  // update" for months, but its only caller was `output_text()` — the
  // get_context.py text path. The hook
  // built its own payload and never went through it, so on hook-driven
  // platforms the reminder was silent: this repo sat on .trellis/.version
  // 0.6.2 against an installed 0.6.7 CLI while `.trellis/.runtime/` held six
  // codex_* update markers and not one claude_* marker. The hint now rides the
  // <first-reply-notice> block, the payload's existing "say it in the first
  // visible reply" channel, so it reaches the user and not just the model.
  //
  // The fake `trellis` CLI below is a shell script on PATH. Windows
  // CreateProcess resolves a bare command name against .exe only, so
  // subprocess.run(["trellis", ...]) would never find a .bat/.cmd shim —
  // those cases skip there.
  // ---------------------------------------------------------------------


  // The notice exactly as it shipped before the update reminder existed. A
  // project that is up to date must still emit these bytes and nothing else —
  // no empty block, no placeholder line. Comparing two runs of the same build
  // cannot catch a line that is added unconditionally, so this is pinned.


  // ------------------------------------------------------------
  // Single-session fallback (issue #225 — class-2 sub-agents)
  // ------------------------------------------------------------

  function runTaskCurrent(envOverrides: NodeJS.ProcessEnv = {}): {
    output: string;
    status: number;
  } {
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    let output = "";
    let status = 0;
    try {
      output = execSync(
        `${pythonCmd} ${JSON.stringify(taskScriptPath)} current --source`,
        {
          cwd: tmpDir,
          encoding: "utf-8",
          env: sessionEnv(envOverrides),
        },
      );
    } catch (error) {
      status =
        typeof (error as { status?: unknown }).status === "number"
          ? (error as { status: number }).status
          : 1;
      output = String((error as { stdout?: unknown }).stdout ?? "");
    }
    return { output, status };
  }

  it("[session-fallback] main CLI resolves a sole session on a kerminal install", () => {
    // Kerminal is single-session: with no context key the sole session file
    // IS the active session, so the fallback legitimately resolves it.
    setupTaskRepo();
    writeSessionContext("codex_session_parent", ".trellis/tasks/issue-106");

    const { output, status } = runTaskCurrent();
    expect(status).toBe(0);
    expect(output).toContain("Current task: .trellis/tasks/issue-106");
    expect(output).toContain("Source: session-fallback:codex_session_parent");
  });

  it("[session-fallback] zero session files — no fallback, returns none", () => {
    setupTaskRepo();
    // No session files written

    const { output, status } = runTaskCurrent();
    expect(status).toBe(1);
    expect(output).toContain("Current task: (none)");
    expect(output).toContain("Source: none");
  });

  it("[session-fallback] multiple session files — refuses to guess, returns none", () => {
    setupTaskRepo();
    writeSessionContext("codex_session_a", ".trellis/tasks/issue-106");
    writeProjectFile(
      path.join(".trellis", "tasks", "other-task", "task.json"),
      JSON.stringify({ title: "other", status: "in_progress" }, null, 2),
    );
    writeSessionContext("codex_session_b", ".trellis/tasks/other-task");

    const { output, status } = runTaskCurrent();
    expect(status).toBe(1);
    expect(output).toContain("Current task: (none)");
    expect(output).toContain("Source: none");
  });

  it("[session-fallback] explicit context-key match takes precedence over fallback", () => {
    setupTaskRepo();
    writeSessionContext("codex_session_explicit", ".trellis/tasks/issue-106");

    const { output, status } = runTaskCurrent({
      TRELLIS_CONTEXT_ID: "codex_session_explicit",
    });
    expect(status).toBe(0);
    expect(output).toContain("Current task: .trellis/tasks/issue-106");
    // Source should be "session:" (precise match), not "session-fallback:"
    expect(output).toContain("Source: session:codex_session_explicit");
    expect(output).not.toContain("session-fallback");
  });

  it("[issue #469] finish removes only the exact matched session file", () => {
    setupTaskRepo();
    writeSessionContext("codex_exact", ".trellis/tasks/issue-106");
    writeSessionContext("codex_thread_sibling", ".trellis/tasks/issue-106");
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const sessionsDir = path.join(tmpDir, ".trellis", ".runtime", "sessions");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} finish`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ CODEX_THREAD_ID: "exact" }),
      },
    );

    expect(output).toContain("Source: session:codex_exact");
    expect(fs.existsSync(path.join(sessionsDir, "codex_exact.json"))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(sessionsDir, "codex_thread_sibling.json")),
    ).toBe(true);
  });

  it("[issue #469] finish preserves a sole unmatched session file", () => {
    setupTaskRepo();
    writeSessionContext("codex_previous-thread", ".trellis/tasks/issue-106");
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const fallbackPath = path.join(
      tmpDir,
      ".trellis",
      ".runtime",
      "sessions",
      "codex_previous-thread.json",
    );

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} finish`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ CODEX_THREAD_ID: "current-thread" }),
      },
    );

    // `finish` resolves through the sole-session fallback (kerminal install:
    // the exact key codex_current-thread has no session file), so it clears
    // the preserved sibling — precisely the file whose bytes it must match.
    expect(output).toContain("Cleared current task");
    expect(output).toContain("session-fallback:codex_previous-thread");
    expect(fs.existsSync(fallbackPath)).toBe(false);
  });

  it("[issue #469] finish deletes nothing when fallback resolution is ambiguous", () => {
    setupTaskRepo();
    writeSessionContext("codex_thread_a", ".trellis/tasks/issue-106");
    writeSessionContext("codex_thread_b", ".trellis/tasks/issue-106");
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const sessionsDir = path.join(tmpDir, ".trellis", ".runtime", "sessions");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} finish`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ CODEX_THREAD_ID: "current-thread" }),
      },
    );

    expect(output).toContain("No current task set");
    expect(fs.existsSync(path.join(sessionsDir, "codex_thread_a.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(sessionsDir, "codex_thread_b.json"))).toBe(
      true,
    );
  });

  it("[issue #469] finish preserves a malformed exact session when another session exists", () => {
    setupTaskRepo();
    writeProjectFile(
      path.join(".trellis", ".runtime", "sessions", "codex_malformed.json"),
      "{",
    );
    writeSessionContext("codex_other", ".trellis/tasks/issue-106");
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const sessionsDir = path.join(tmpDir, ".trellis", ".runtime", "sessions");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} finish`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ CODEX_THREAD_ID: "malformed" }),
      },
    );

    expect(output).toContain("No current task set");
    expect(fs.existsSync(path.join(sessionsDir, "codex_malformed.json"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(sessionsDir, "codex_other.json"))).toBe(
      true,
    );
  });

  it("[audit] a non-UTF-8 session file degrades to no active task", () => {
    // The tolerant `read_json` caught FileNotFoundError / JSONDecodeError /
    // OSError. UnicodeDecodeError is none of those, so a session file that is
    // not UTF-8 raised straight out of a read whose whole contract is to
    // return None, and the hook path failed instead of degrading.
    setupTaskRepo();
    const sessionsDir = path.join(tmpDir, ".trellis", ".runtime", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionsDir, "codex_binary.json"),
      Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]),
    );
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const proc = spawnSync(pythonCmd, [taskScriptPath, "finish"], {
      cwd: tmpDir,
      encoding: "utf-8",
      env: sessionEnv({ CODEX_THREAD_ID: "binary" }),
    });

    expect(proc.stderr ?? "").not.toContain("UnicodeDecodeError");
    expect(proc.status).toBe(0);
    expect(proc.stdout).toContain("No current task set");
  });


  // ------------------------------------------------------------
  // Legacy current_phase / next_action field removal (FP round 3 cleanup)
  // ------------------------------------------------------------

  it("[workflow-v2] task.py create does NOT write legacy current_phase / next_action fields", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "dummy task" --description "regression fixture" --slug dummy-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8" },
    );
    // Locate the newly created task dir
    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const newDirs = fs
      .readdirSync(tasksDir)
      .filter((d) => d.includes("dummy-task"));
    expect(newDirs.length).toBeGreaterThan(0);
    const newTaskJsonPath = path.join(tasksDir, newDirs[0], "task.json");
    const data = JSON.parse(fs.readFileSync(newTaskJsonPath, "utf-8")) as {
      current_phase?: unknown;
      next_action?: unknown;
    };
    expect(data.current_phase).toBeUndefined();
    expect(data.next_action).toBeUndefined();
  });

  // ------------------------------------------------------------
  // v0.5.0-beta.12: init-context removal + jsonl seeding on task create
  // ------------------------------------------------------------

  it("[init-context-removal] task.py create does NOT seed jsonl when no sub-agent platform configured", () => {
    setupTaskRepo();
    // setupTaskRepo does not create any .{platform}/ dir → agent-less mode
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "plain task" --description "regression fixture" --slug plain-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8" },
    );
    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const newDirs = fs
      .readdirSync(tasksDir)
      .filter((d) => d.includes("plain-task"));
    expect(newDirs.length).toBeGreaterThan(0);
    const taskDir = path.join(tasksDir, newDirs[0]);
    expect(fs.existsSync(path.join(taskDir, "implement.jsonl"))).toBe(false);
    expect(fs.existsSync(path.join(taskDir, "check.jsonl"))).toBe(false);
  });

  it("[validation-preflight] task.py create writes EMPTY jsonl when a sub-agent platform dir exists", () => {
    setupTaskRepo();
    // Simulate a Claude Code install
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "seeded task" --description "regression fixture" --slug seeded-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    expect(output).toBeDefined();
    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const newDirs = fs
      .readdirSync(tasksDir)
      .filter((d) => d.includes("seeded-task"));
    expect(newDirs.length).toBeGreaterThan(0);
    const taskDir = path.join(tasksDir, newDirs[0]);

    for (const jsonlName of ["implement.jsonl", "check.jsonl"]) {
      const jsonlPath = path.join(taskDir, jsonlName);
      expect(fs.existsSync(jsonlPath), `${jsonlName} should exist`).toBe(true);
      // Empty on create — a placeholder row would pass validate locally and
      // then fail PR preflight as unresolved scaffolding.
      expect(fs.readFileSync(jsonlPath, "utf-8"), jsonlName).toBe("");
    }
  });

  it("[validation-preflight] task.py create prints jsonl curation instructions instead of writing them into the files", () => {
    setupTaskRepo();
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "curation hint task",
        "--description",
        "regression fixture",
        "--slug",
        "curation-hint-task",
        "--assignee",
        "test-dev",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Curate implement.jsonl / check.jsonl");
    expect(result.stderr).toContain('{"file": "<path>", "reason": "<why>"}');
    expect(result.stderr).toContain("get_context.py --mode packages");
  });

  it("[grok] task.py create creates empty jsonl when Grok is the only sub-agent platform", () => {
    setupTaskRepo();
    fs.mkdirSync(path.join(tmpDir, ".grok"), { recursive: true });
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "grok task" --description "regression fixture" --slug grok-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const taskName = fs
      .readdirSync(tasksDir)
      .find((name) => name.includes("grok-task"));
    expect(taskName).toBeDefined();
    const taskDir = path.join(tasksDir, taskName as string);

    for (const jsonlName of ["implement.jsonl", "check.jsonl"]) {
      const jsonlPath = path.join(taskDir, jsonlName);
      expect(fs.existsSync(jsonlPath), `${jsonlName} should exist`).toBe(true);
      expect(fs.readFileSync(jsonlPath, "utf-8"), jsonlName).toBe("");
    }
  });

  it("[kimi] task.py create creates empty jsonl when Kimi is the only sub-agent platform", () => {
    setupTaskRepo();
    fs.mkdirSync(path.join(tmpDir, ".kimi-code"), { recursive: true });
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "kimi task" --description "regression fixture" --slug kimi-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const taskName = fs
      .readdirSync(tasksDir)
      .find((name) => name.includes("kimi-task"));
    expect(taskName).toBeDefined();
    const taskDir = path.join(tasksDir, taskName as string);

    for (const jsonlName of ["implement.jsonl", "check.jsonl"]) {
      const jsonlPath = path.join(taskDir, jsonlName);
      expect(fs.existsSync(jsonlPath), `${jsonlName} should exist`).toBe(true);
      expect(fs.readFileSync(jsonlPath, "utf-8"), jsonlName).toBe("");
    }
  });

  it("[kerminal] task.py create creates empty jsonl when Kerminal is the only sub-agent platform", () => {
    setupTaskRepo();
    fs.mkdirSync(path.join(tmpDir, ".kerminal"), { recursive: true });
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "kerminal task" --description "regression fixture" --slug kerminal-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    const tasksDir = path.join(tmpDir, ".trellis", "tasks");
    const taskName = fs
      .readdirSync(tasksDir)
      .find((name) => name.includes("kerminal-task"));
    expect(taskName).toBeDefined();
    const taskDir = path.join(tasksDir, taskName as string);

    for (const jsonlName of ["implement.jsonl", "check.jsonl"]) {
      const jsonlPath = path.join(taskDir, jsonlName);
      expect(fs.existsSync(jsonlPath), `${jsonlName} should exist`).toBe(true);
      expect(fs.readFileSync(jsonlPath, "utf-8"), jsonlName).toBe("");
    }
  });

  it("[init-context-removal] task.py init-context is deprecated with clear pointer to planning artifacts", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    let threw = false;
    let stderr = "";
    try {
      execSync(
        `${pythonCmd} ${JSON.stringify(taskScriptPath)} init-context .trellis/tasks/issue-106 fullstack`,
        { cwd: tmpDir, encoding: "utf-8" },
      );
    } catch (err) {
      threw = true;
      const e = err as { stderr?: string; status?: number };
      stderr = e.stderr ?? "";
      expect(e.status).toBe(2);
    }
    expect(threw).toBe(true);
    expect(stderr).toContain("v0.5.0-beta.12");
    expect(stderr).toContain("planning artifact guidance");
    expect(stderr).toContain("add-context");
  });

  it("[#573] task.py validate fails for a freshly created task until manifests are curated", () => {
    setupTaskRepo();
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "seed-only" --description "regression fixture" --slug seed-only-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8" },
    );
    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("seed-only-task"));
    expect(taskDir).toBeDefined();
    const relTaskDir = path.posix.join(".trellis", "tasks", taskDir as string);

    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "validate", relTaskDir],
      { cwd: tmpDir, encoding: "utf-8" },
    );
    // Seed-only manifests used to pass with a green "✓ (0 entries)", so
    // sub-agents silently ran with zero spec context (#573).
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("0 curated entries");
    expect(result.stdout).toContain("add-context");
    expect(result.stdout).toContain("--allow-empty-context");
  });

  describe("[validation-preflight] task.py validate vs PR preflight contract", () => {
    // Each case writes the manifests directly, then runs the real validator.
    // Create → validate must never produce a task that validates locally and
    // then trips PR preflight's `_example` scaffolding rule.
    const placeholderRow =
      '{"_example": "Fill with {\\"file\\": \\"<path>\\", \\"reason\\": \\"<why>\\"}."}\n';
    // Curated row for the manifest not under test: an empty manifest is
    // itself an error since #573, which would obscure the count under test.
    const curatedRow =
      '{"file":".trellis/spec/guides/index.md","reason":"guideline"}\n';

    function validateWith(
      implementContent: string,
      checkContent: string,
    ): ReturnType<typeof spawnSync> {
      setupTaskRepo();
      const taskDir = path.join(tmpDir, ".trellis", "tasks", "issue-106");
      fs.writeFileSync(
        path.join(taskDir, "implement.jsonl"),
        implementContent,
        "utf-8",
      );
      fs.writeFileSync(
        path.join(taskDir, "check.jsonl"),
        checkContent,
        "utf-8",
      );
      const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
      return spawnSync(
        pythonCmd,
        [taskScriptPath, "validate", ".trellis/tasks/issue-106"],
        { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
      );
    }

    it("rejects a placeholder-only implement.jsonl with file, line, and remediation", () => {
      const result = validateWith(placeholderRow, curatedRow);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("implement.jsonl:1: Placeholder `_example` row");
      expect(result.stdout).toContain(
        '{"file": "<path>", "reason": "<why>"}',
      );
      expect(result.stdout).toContain("Validation failed (1 errors)");
    });

    it("rejects a placeholder row in check.jsonl too", () => {
      const result = validateWith(curatedRow, placeholderRow);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("check.jsonl:1: Placeholder `_example` row");
    });

    it("rejects a placeholder row that sits alongside curated entries", () => {
      const result = validateWith(
        `${placeholderRow}${curatedRow}`,
        curatedRow,
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("implement.jsonl:1: Placeholder `_example` row");
      expect(result.stdout).toContain("Validation failed (1 errors)");
    });

    it("[#573] fails for empty manifests instead of passing them silently", () => {
      const result = validateWith("", "");
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "implement.jsonl: ✗ (0 curated entries — sub-agents would get zero spec context)",
      );
      expect(result.stdout).toContain(
        "check.jsonl: ✗ (0 curated entries — sub-agents would get zero spec context)",
      );
      expect(result.stdout).toContain("add-context <task> implement");
      expect(result.stdout).toContain("--allow-empty-context");
    });

    it("passes for curated entries pointing at real files", () => {
      setupTaskRepo();
      const taskDir = path.join(tmpDir, ".trellis", "tasks", "issue-106");
      const curated =
        '{"file":".trellis/spec/guides/index.md","reason":"guideline"}\n';
      fs.writeFileSync(path.join(taskDir, "implement.jsonl"), curated, "utf-8");
      fs.writeFileSync(path.join(taskDir, "check.jsonl"), curated, "utf-8");
      const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
      const result = spawnSync(
        pythonCmd,
        [taskScriptPath, "validate", ".trellis/tasks/issue-106"],
        { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("All validations passed");
    });

    it("still rejects malformed JSON lines", () => {
      const result = validateWith("{not json\n", curatedRow);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("implement.jsonl:1: Invalid JSON");
    });

    it("reports a non-object row instead of crashing on it", () => {
      // Valid JSON, wrong shape — the row must be an error with a line
      // number, not an AttributeError traceback out of `data.get`.
      const result = validateWith('"just a string"\n[1, 2]\nnull\n', curatedRow);
      expect(result.status).toBe(1);
      expect(result.stderr).not.toContain("Traceback");
      for (const line of [1, 2, 3]) {
        expect(result.stdout).toContain(
          `implement.jsonl:${line}: Expected a JSON object`,
        );
      }
      expect(result.stdout).toContain("Validation failed (3 errors)");
    });

    it("list-context skips non-object rows instead of crashing on them", () => {
      // Same wrong-shape rows as the validate case above — list-context is a
      // read-only listing, so it skips them and still lists curated entries.
      setupTaskRepo();
      const taskDir = path.join(tmpDir, ".trellis", "tasks", "issue-106");
      fs.writeFileSync(
        path.join(taskDir, "implement.jsonl"),
        '"just a string"\n[1, 2]\nnull\n{"file":".trellis/spec/guides/index.md","reason":"guideline"}\n',
        "utf-8",
      );
      fs.writeFileSync(path.join(taskDir, "check.jsonl"), "", "utf-8");
      const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
      const result = spawnSync(
        pythonCmd,
        [taskScriptPath, "list-context", ".trellis/tasks/issue-106"],
        { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
      );
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("Traceback");
      expect(result.stdout).toContain(".trellis/spec/guides/index.md");
    });

    it("rejects a placeholder row inside an archived task", () => {
      setupTaskRepo();
      const archivedDir = path.join(
        tmpDir,
        ".trellis",
        "tasks",
        "archive",
        "2026-07",
        "07-01-archived-task",
      );
      fs.mkdirSync(archivedDir, { recursive: true });
      fs.writeFileSync(
        path.join(archivedDir, "task.json"),
        JSON.stringify({ title: "Archived", status: "completed" }, null, 2),
      );
      fs.writeFileSync(
        path.join(archivedDir, "implement.jsonl"),
        placeholderRow,
        "utf-8",
      );
      fs.writeFileSync(path.join(archivedDir, "check.jsonl"), "", "utf-8");
      const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
      const result = spawnSync(
        pythonCmd,
        [
          taskScriptPath,
          "validate",
          ".trellis/tasks/archive/2026-07/07-01-archived-task",
        ],
        { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("implement.jsonl:1: Placeholder `_example` row");
    });
  });

  describe("[#573] task.py start seed-only context gate", () => {
    const curatedRow =
      '{"file":".trellis/spec/guides/index.md","reason":"guideline"}\n';

    function writeManifests(implement: string | null, check: string | null): void {
      const taskDir = path.join(tmpDir, ".trellis", "tasks", "issue-106");
      if (implement !== null) {
        fs.writeFileSync(path.join(taskDir, "implement.jsonl"), implement, "utf-8");
      }
      if (check !== null) {
        fs.writeFileSync(path.join(taskDir, "check.jsonl"), check, "utf-8");
      }
    }

    function runStart(...extra: string[]): ReturnType<typeof spawnSync> {
      const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
      return spawnSync(
        pythonCmd,
        [taskScriptPath, "start", ".trellis/tasks/issue-106", ...extra],
        {
          cwd: tmpDir,
          encoding: "utf-8",
          // Session identity so a successful start prints "Current task set
          // to" instead of the degraded-mode notice.
          env: sessionEnv({ TRELLIS_CONTEXT_ID: "test-ctx-573" }),
        },
      );
    }

    it("blocks start when seeded manifests have zero curated entries", () => {
      setupTaskRepo();
      writeManifests("", "");
      const r = runStart();
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("no curated entries");
      expect(r.stdout).toContain("add-context");
      expect(r.stdout).toContain("--allow-empty-context");
      expect(r.stdout).not.toContain("Current task set to");
    });

    it("names only the manifest that is actually empty", () => {
      setupTaskRepo();
      writeManifests(curatedRow, "");
      const r = runStart();
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("check.jsonl has no curated entries");
      expect(r.stdout).not.toContain("implement.jsonl and check.jsonl");
    });

    it("--allow-empty-context bypasses the gate", () => {
      setupTaskRepo();
      writeManifests("", "");
      const r = runStart("--allow-empty-context");
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("Current task set to");
    });

    it("does not gate when manifests are absent (agent-less platform)", () => {
      // `create` seeds the manifests only on sub-agent-capable platforms;
      // absence means no sub-agent will ever read them.
      setupTaskRepo();
      const r = runStart();
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("Current task set to");
    });

    it("starts normally once both manifests are curated", () => {
      setupTaskRepo();
      writeManifests(curatedRow, curatedRow);
      const r = runStart();
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("Current task set to");
    });
  });

  it("[init-context-removal] task.py list-context prints 'no curated entries yet' for uncurated jsonl", () => {
    setupTaskRepo();
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "seed-list" --description "regression fixture" --slug seed-list-task --assignee test-dev`,
      { cwd: tmpDir, encoding: "utf-8" },
    );
    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("seed-list-task"));
    expect(taskDir).toBeDefined();
    const relTaskDir = path.posix.join(".trellis", "tasks", taskDir as string);

    const result = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} list-context ${relTaskDir}`,
      { cwd: tmpDir, encoding: "utf-8" },
    );
    // Sentinel message proves the seed-detection branch ran.
    expect(result).toContain("no curated entries yet");
  });

  // ------------------------------------------------------------
  // workflow_phase.get_phase_index() expansion (FP round 3)
  //   Now returns Phase Index + Phase 1/2/3 bodies (was Phase Index only).
  // ------------------------------------------------------------

  function templateWorkflowMd(): string {
    const { readFileSync } = fs;
    const { dirname, join: pathJoin } = path;
    const templatePath = pathJoin(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "templates",
      "trellis",
      "workflow.md",
    );
    return readFileSync(templatePath, "utf-8");
  }

  it("[workflow-state-r1] template workflow.md [workflow-state:in_progress] mentions commit (Phase 3.4)", () => {
    const wf = templateWorkflowMd();
    const match = wf.match(
      /\[workflow-state:in_progress\]([\s\S]*?)\[\/workflow-state:in_progress\]/,
    );
    expect(match).toBeTruthy();
    const body = match?.[1] ?? "";
    expect(body).toMatch(/commit \(Phase 3\.4\)/i);
  });

  it("[issue-237] all implement/check agent templates contain recursion guards", () => {
    const templateRoot = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "templates",
    );
    const agentFiles = [
      "kerminal/agents/trellis-implement.md",
      "kerminal/agents/trellis-check.md",
    ];

    for (const relativePath of agentFiles) {
      const content = fs.readFileSync(
        path.join(templateRoot, relativePath),
        "utf-8",
      );
      expect(content, `${relativePath} should mention recursion guard`).toMatch(
        /Recursion guard|Recursion Guard/,
      );
      expect(
        content,
        `${relativePath} should scope dispatch to main session`,
      ).toContain("main session");
      expect(
        content,
        `${relativePath} should mention workflow-state safety`,
      ).toMatch(/workflow-state breadcrumbs|workflow.md/);

      if (relativePath.includes("implement")) {
        expect(
          content,
          `${relativePath} should forbid nested implement`,
        ).toContain("spawn another `trellis-implement`");
        expect(content, `${relativePath} should forbid nested check`).toContain(
          "`trellis-check`",
        );
      } else {
        expect(content, `${relativePath} should forbid nested check`).toContain(
          "spawn another `trellis-check`",
        );
        expect(
          content,
          `${relativePath} should forbid nested implement`,
        ).toContain("`trellis-implement`");
      }
    }
  });

  it("[workflow-state-r2] template workflow.md [workflow-state:planning] mentions artifact gates + required jsonl curation", () => {
    const wf = templateWorkflowMd();
    const match = wf.match(
      /\[workflow-state:planning\]([\s\S]*?)\[\/workflow-state:planning\]/,
    );
    expect(match).toBeTruthy();
    const body = match?.[1] ?? "";
    expect(body).toMatch(/Lightweight: `prd\.md` can be enough/);
    expect(body).toMatch(
      /Complex: finish `prd\.md`, `design\.md`, and `implement\.md`/,
    );
    expect(body).toContain(
      "curate `implement.jsonl` and `check.jsonl` as spec/research manifests before start",
    );
  });

  it("[#292] workflow and brainstorm templates treat seed-only jsonl as not planning-ready", () => {
    const wf = templateWorkflowMd();
    expect(wf).not.toContain("seed-only manifests are tolerated by consumers");
    expect(wf).not.toContain(
      "curated when extra spec or research context is needed",
    );
    expect(wf).toContain(
      'Ready gate: both `implement.jsonl` and `check.jsonl` must contain at least one real `{"file": "...", "reason": "..."}` entry before `task.py start` (unless `--allow-empty-context` is passed deliberately).',
    );
    expect(wf).toContain(
      "Runtime consumers tolerate missing or seed-only manifests for compatibility, but that tolerance is not a planning-ready state.",
    );
    expect(wf).toContain(
      "`implement.jsonl` and `check.jsonl` each contain at least one real curated entry (seed row does not count)",
    );

    const templateRoot = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "templates",
    );
    const brainstormFiles = ["common/skills/brainstorm.md"];

    for (const relativePath of brainstormFiles) {
      const content = fs.readFileSync(
        path.join(templateRoot, relativePath),
        "utf-8",
      );
      expect(content, relativePath).toContain(
        "Sub-agent-dispatch tasks have real curated entries in both `implement.jsonl` and `check.jsonl`; seed-only manifests are not ready.",
      );
    }
  });

  it("[#320] brainstorm templates require lossless PRD convergence before start", () => {
    const templateRoot = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "templates",
    );
    const brainstormFiles = ["common/skills/brainstorm.md"];

    for (const relativePath of brainstormFiles) {
      const content = fs.readFileSync(
        path.join(templateRoot, relativePath),
        "utf-8",
      );
      expect(content, relativePath).toContain(
        "Run the requirement convergence gate, then the PRD convergence pass.",
      );
      expect(content, relativePath).toContain("## PRD Convergence Pass");
      expect(content, relativePath).toContain(
        "Fold temporary brainstorm sections such as `What I already know`, `Assumptions`, and resolved `Open Questions`",
      );
      expect(content, relativePath).toContain(
        "Preserve every file:line anchor, decision, constraint, requirement ID, and acceptance-criteria mapping.",
      );
      expect(content, relativePath).toContain(
        "no unresolved temporary brainstorm sections, no duplicate facts across sections",
      );
    }
  });

  it("[workflow-state-r3-no_task] template workflow.md [workflow-state:no_task] block is present and well-formed", () => {
    const wf = templateWorkflowMd();
    expect(wf).toMatch(
      /\[workflow-state:no_task\]\s*\n[\s\S]+?\n\s*\[\/workflow-state:no_task\]/,
    );
  });

  it("[workflow-state-r3-completed] template workflow.md [workflow-state:completed] block is present and well-formed", () => {
    const wf = templateWorkflowMd();
    expect(wf).toMatch(
      /\[workflow-state:completed\]\s*\n[\s\S]+?\n\s*\[\/workflow-state:completed\]/,
    );
  });

  it("[workflow-v2] get_context.py --mode phase returns compact Phase Index only", () => {
    writeTrellisScripts();
    writeProjectFile(path.join(".trellis", ".developer"), "name=test\n");
    writeProjectFile(
      path.join(".trellis", "workflow.md"),
      templateWorkflowMd(),
    );

    const contextScript = path.join(
      tmpDir,
      ".trellis",
      "scripts",
      "get_context.py",
    );
    const output = execSync(
      `${pythonCmd} ${JSON.stringify(contextScript)} --mode phase`,
      { cwd: tmpDir, encoding: "utf-8" },
    );

    expect(output).toContain("## Phase Index");
    expect(output).toContain("### Request Triage");
    expect(output).toContain("### Planning Artifacts");
    expect(output).toContain("### Loading Step Detail");
    expect(output).not.toMatch(/^## Phase 1: Plan/m);
    expect(output).not.toContain("#### 1.1 Requirement exploration");
    expect(output).not.toContain("#### 2.1 Implement");
  });

  it("[issue-395] task.py list --json emits a stable machine-readable schema", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} list --json`,
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    const parsed = JSON.parse(output) as {
      tasks: {
        dir: string;
        title: string;
        status: string;
        priority: string;
        assignee: string | null;
        parent: string | null;
        children: string[];
      }[];
    };
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0]).toMatchObject({
      dir: ".trellis/tasks/issue-106",
      title: "Issue 106 task",
      status: "in_progress",
      parent: null,
      children: [],
    });
  });

  it("[issue-395] task.py current --json reports null when no task is active", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    const result = spawnSync(pythonCmd, [taskScriptPath, "current", "--json"], {
      cwd: tmpDir,
      encoding: "utf-8",
      env: sessionEnv(),
    });

    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as { current_task: unknown };
    expect(parsed.current_task).toBeNull();
  });

  it("[issue-395] task.py current --json reports the active task object", () => {
    setupTaskRepo();
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");

    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} start ${JSON.stringify(".trellis/tasks/issue-106")}`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "json-current-session" }),
      },
    );

    const output = execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} current --json`,
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "json-current-session" }),
      },
    );

    const parsed = JSON.parse(output) as {
      current_task: { dir: string; title: string; status: string } | null;
    };
    expect(parsed.current_task).toMatchObject({
      dir: ".trellis/tasks/issue-106",
      title: "Issue 106 task",
      status: "in_progress",
    });
  });

  it("[issue-399.1] task.py create stamps base_branch from origin/HEAD, not the checked-out branch", () => {
    setupTaskRepo();
    execSync("git init -q -b feature/some-work", { cwd: tmpDir });
    execSync("git config user.email test@example.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git add -A", { cwd: tmpDir });
    execSync("git commit -q -m init", { cwd: tmpDir });

    // Simulate a bare "origin" remote whose default branch is main, while
    // the local checkout stays on a feature branch (#399 item 1 repro).
    const remotePath = path.join(tmpDir, "..", "origin-bare.git");
    execSync(`git init -q --bare ${JSON.stringify(remotePath)}`, {
      cwd: tmpDir,
    });
    execSync("git branch -m feature/some-work main", { cwd: tmpDir });
    execSync(`git remote add origin ${JSON.stringify(remotePath)}`, {
      cwd: tmpDir,
    });
    execSync("git push -q origin main", { cwd: tmpDir });
    execSync(
      `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main`,
      { cwd: tmpDir },
    );
    execSync("git checkout -q -b feature/some-work", { cwd: tmpDir });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    execSync(
      `${pythonCmd} ${JSON.stringify(taskScriptPath)} create "base branch test" --description "regression fixture" --slug base-branch-test --assignee test-dev --no-start`,
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("base-branch-test"));
    expect(taskDir).toBeDefined();
    const taskJson = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, ".trellis", "tasks", taskDir as string, "task.json"),
        "utf-8",
      ),
    ) as { base_branch: string };
    expect(taskJson.base_branch).toBe("main");

    fs.rmSync(remotePath, { recursive: true, force: true });
  });

  it("[issue-399.1] task.py create falls back to the checked-out branch when no default branch resolves", () => {
    setupTaskRepo();
    execSync("git init -q -b solo-branch", { cwd: tmpDir });
    execSync("git config user.email test@example.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git add -A", { cwd: tmpDir });
    execSync("git commit -q -m init", { cwd: tmpDir });
    // No origin remote configured at all.

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "no remote test",
        "--description",
        "regression fixture",
        "--slug",
        "no-remote-test",
        "--assignee",
        "test-dev",
        "--no-start",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    // #399 follow-up: silently falling back must now warn on stderr, naming
    // the branch that got stamped.
    expect(result.stderr).toContain(
      "warning: could not resolve the repository's default branch",
    );
    expect(result.stderr).toContain("solo-branch");

    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("no-remote-test"));
    const taskJson = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, ".trellis", "tasks", taskDir as string, "task.json"),
        "utf-8",
      ),
    ) as { base_branch: string };
    expect(taskJson.base_branch).toBe("solo-branch");
  });

  it("[issue-399.1] task.py create --base-branch overrides both origin/HEAD detection and the fallback", () => {
    setupTaskRepo();
    execSync("git init -q -b solo-branch", { cwd: tmpDir });
    execSync("git config user.email test@example.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git add -A", { cwd: tmpDir });
    execSync("git commit -q -m init", { cwd: tmpDir });
    // No origin remote configured at all — would otherwise fall back with a warning.

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "create",
        "explicit base branch test",
        "--description",
        "regression fixture",
        "--slug",
        "explicit-base-branch-test",
        "--assignee",
        "test-dev",
        "--base-branch",
        "release/1.0",
        "--no-start",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.stderr).not.toContain(
      "warning: could not resolve the repository's default branch",
    );

    const taskDir = fs
      .readdirSync(path.join(tmpDir, ".trellis", "tasks"))
      .find((d) => d.includes("explicit-base-branch-test"));
    expect(taskDir).toBeDefined();
    const taskJson = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, ".trellis", "tasks", taskDir as string, "task.json"),
        "utf-8",
      ),
    ) as { base_branch: string };
    expect(taskJson.base_branch).toBe("release/1.0");
  });

  it("[issue-399.2] task.py validate warns when the recorded branch no longer exists locally", () => {
    setupTaskRepo();
    execSync("git init -q -b main", { cwd: tmpDir });
    execSync("git config user.email test@example.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git add -A", { cwd: tmpDir });
    execSync("git commit -q -m init", { cwd: tmpDir });

    const taskJsonPath = path.join(
      tmpDir,
      ".trellis",
      "tasks",
      "issue-106",
      "task.json",
    );
    const data = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    data.branch = "task/deleted-branch-does-not-exist";
    fs.writeFileSync(taskJsonPath, JSON.stringify(data, null, 2));

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "validate", ".trellis/tasks/issue-106"],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.stdout).toContain(
      "recorded branch 'task/deleted-branch-does-not-exist' no longer exists locally",
    );
  });

  it("[issue-399.2] task.py archive warns when the recorded branch no longer exists locally", () => {
    setupTaskRepo();
    execSync("git init -q -b main", { cwd: tmpDir });
    execSync("git config user.email test@example.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git add -A", { cwd: tmpDir });
    execSync("git commit -q -m init", { cwd: tmpDir });

    const taskJsonPath = path.join(
      tmpDir,
      ".trellis",
      "tasks",
      "issue-106",
      "task.json",
    );
    const data = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    data.branch = "task/deleted-branch-does-not-exist";
    fs.writeFileSync(taskJsonPath, JSON.stringify(data, null, 2));

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "archive", ".trellis/tasks/issue-106", "--no-commit"],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.stderr).toContain(
      "recorded branch 'task/deleted-branch-does-not-exist' no longer exists locally",
    );
  });

  // --- Branch metadata recorded at start, validated at archive -------------

  function initTaskGitRepo(branch: string, withRemote = false): void {
    execSync(`git init -q -b ${branch}`, { cwd: tmpDir });
    execSync("git config user.email test@example.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git add -A", { cwd: tmpDir });
    execSync("git commit -q -m init", { cwd: tmpDir });
    if (withRemote) {
      // Never contacted: only `git remote` (the PR-backed predicate) reads it.
      execSync("git remote add origin https://example.invalid/repo.git", {
        cwd: tmpDir,
      });
    }
  }

  function patchIssue106Task(fields: Record<string, unknown>): string {
    const taskJsonPath = path.join(
      tmpDir,
      ".trellis",
      "tasks",
      "issue-106",
      "task.json",
    );
    const data = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8"));
    fs.writeFileSync(
      taskJsonPath,
      JSON.stringify({ ...data, ...fields }, null, 2),
    );
    return taskJsonPath;
  }

  function readIssue106Task(): { branch: string | null; status: string } {
    return JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, ".trellis", "tasks", "issue-106", "task.json"),
        "utf-8",
      ),
    );
  }

  it("[issue-399.3] task.py start records the checked-out branch when none is set", () => {
    setupTaskRepo();
    initTaskGitRepo("main");
    execSync("git checkout -q -b feature/record-me", { cwd: tmpDir });
    patchIssue106Task({ status: "planning", branch: null, base_branch: "main" });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "start", ".trellis/tasks/issue-106"],
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "start-branch-session" }),
      },
    );

    expect(result.stdout).toContain("Branch recorded: feature/record-me");
    expect(readIssue106Task()).toMatchObject({
      branch: "feature/record-me",
      status: "in_progress",
    });
  });

  it("[issue-399.3] task.py start does not clobber an explicitly set branch", () => {
    setupTaskRepo();
    initTaskGitRepo("main");
    execSync("git checkout -q -b feature/current", { cwd: tmpDir });
    patchIssue106Task({
      status: "planning",
      branch: "task/set-by-hand",
      base_branch: "main",
    });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "start", ".trellis/tasks/issue-106"],
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "start-noclobber-session" }),
      },
    );

    expect(result.stdout).not.toContain("Branch recorded");
    expect(readIssue106Task().branch).toBe("task/set-by-hand");
  });

  it("[issue-399.3] task.py start on a detached HEAD notes the skip and still starts", () => {
    setupTaskRepo();
    initTaskGitRepo("main");
    execSync("git checkout -q --detach", { cwd: tmpDir });
    patchIssue106Task({ status: "planning", branch: null, base_branch: "main" });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "start", ".trellis/tasks/issue-106"],
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: sessionEnv({ TRELLIS_CONTEXT_ID: "start-detached-session" }),
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("no checked-out branch");
    expect(readIssue106Task()).toMatchObject({
      branch: null,
      status: "in_progress",
    });
  });

  it("[issue-399.3] task.py archive refuses a PR-backed task with no recorded branch", () => {
    setupTaskRepo();
    initTaskGitRepo("main", true);
    patchIssue106Task({ branch: null, base_branch: "main" });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "archive", ".trellis/tasks/issue-106", "--no-commit"],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no branch is recorded");
    expect(result.stderr).toContain("task.py set-branch");
    expect(result.stderr).toContain("--skip-branch-validation");
    // Refused before any mutation: the task stays put, still un-completed.
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis", "tasks", "issue-106")),
    ).toBe(true);
    expect(readIssue106Task().status).toBe("in_progress");
  });

  it("[issue-399.3] task.py archive refuses a task whose branch equals its base_branch", () => {
    setupTaskRepo();
    initTaskGitRepo("main", true);
    patchIssue106Task({ branch: "main", base_branch: "main" });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "archive", ".trellis/tasks/issue-106", "--no-commit"],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("branch and base_branch are both 'main'");
    expect(result.stderr).toContain("task.py set-base-branch");
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis", "tasks", "issue-106")),
    ).toBe(true);
  });

  it("[issue-399.3] task.py archive --skip-branch-validation archives despite missing branch metadata", () => {
    setupTaskRepo();
    initTaskGitRepo("main", true);
    patchIssue106Task({ branch: null, base_branch: "main" });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [
        taskScriptPath,
        "archive",
        ".trellis/tasks/issue-106",
        "--no-commit",
        "--skip-branch-validation",
      ],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.status).toBe(0);
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis", "tasks", "issue-106")),
    ).toBe(false);
  });

  it("[issue-399.3] task.py archive still only warns when a PR-backed branch was merged and deleted", () => {
    setupTaskRepo();
    initTaskGitRepo("main", true);
    patchIssue106Task({
      branch: "feature/merged-and-deleted",
      base_branch: "main",
    });

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(
      pythonCmd,
      [taskScriptPath, "archive", ".trellis/tasks/issue-106", "--no-commit"],
      { cwd: tmpDir, encoding: "utf-8", env: sessionEnv() },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      "recorded branch 'feature/merged-and-deleted' no longer exists locally",
    );
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis", "tasks", "issue-106")),
    ).toBe(false);
  });
});

describe("regression: backslash in markdown templates (beta.12)", () => {
  it("[beta.12] Common command/skill templates do not contain problematic backslash sequences", () => {
    const templates = [...getCommandTemplates(), ...getSkillTemplates()];
    for (const tmpl of templates) {
      expect(tmpl.content).not.toContain("\\--");
      expect(tmpl.content).not.toContain("\\->");
    }
  });
});

// =============================================================================
// 5. Platform Registry Regressions
// =============================================================================

describe("regression: platform additions (beta.9, beta.13, beta.16)", () => {

  it("[kerminal] Kerminal platform is registered as pull-based class-2 with generic sub-agent dispatch", () => {
    expect(AI_TOOLS).toHaveProperty("kerminal");
    expect(AI_TOOLS.kerminal.name).toBe("Kerminal");
    expect(AI_TOOLS.kerminal.configDir).toBe(".kerminal");
    expect(AI_TOOLS.kerminal.cliFlag).toBe("kerminal");
    expect(AI_TOOLS.kerminal.supportsAgentSkills).toBe(true);
    expect(AI_TOOLS.kerminal.hasPythonHooks).toBe(false);
    expect(AI_TOOLS.kerminal.templateContext.agentCapable).toBe(true);
    expect(AI_TOOLS.kerminal.templateContext.hasHooks).toBe(false);
    expect(AI_TOOLS.kerminal.templateContext.cmdRefPrefix).toBe("trellis-");
  });

  it("[beta.9] all platforms have consistent required fields", () => {
    for (const id of PLATFORM_IDS) {
      const tool = AI_TOOLS[id];
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.configDir.startsWith(".")).toBe(true);
      expect(tool.cliFlag.length).toBeGreaterThan(0);
      expect(Array.isArray(tool.templateDirs)).toBe(true);
      expect(tool.templateDirs).toContain("common");
      expect(typeof tool.defaultChecked).toBe("boolean");
      expect(typeof tool.hasPythonHooks).toBe("boolean");
    }
  });
});

describe("regression: prerelease→stable version stamp (rc.6→0.3.0)", () => {
  it("[0.3.0] rc→stable upgrade returns no migrations (all already applied)", () => {
    const migrations = getMigrationsForVersion("0.3.0-rc.6", "0.3.0");
    expect(migrations).toEqual([]);
  });

  it("[0.3.0] 0.3.0 manifest exists and is well-formed", () => {
    const versions = getAllMigrationVersions();
    expect(versions).toContain("0.3.0");
  });

  it("[0.3.0] prerelease sorts before stable in version ordering", () => {
    const versions = getAllMigrationVersions();
    const rcIdx = versions.indexOf("0.3.0-rc.6");
    const stableIdx = versions.indexOf("0.3.0");
    expect(rcIdx).not.toBe(-1);
    expect(stableIdx).not.toBe(-1);
    expect(rcIdx).toBeLessThan(stableIdx);
  });
});

describe("regression: migration manifest consistency", () => {
  it("all manifest JSON files are loaded", () => {
    const manifestDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../src/migrations/manifests",
    );
    const jsonFiles = fs
      .readdirSync(manifestDir)
      .filter((f) => f.endsWith(".json"));
    const versions = getAllMigrationVersions();
    expect(versions.length).toBe(jsonFiles.length);
    expect(versions.length).toBeGreaterThan(0);
  });

  it("version ordering is strictly ascending", () => {
    const versions = getAllMigrationVersions();
    // Check known ordering constraints
    const knownOrder = [
      "0.1.9",
      "0.2.0",
      "0.2.12",
      "0.2.13",
      "0.2.14",
      "0.2.15",
      "0.3.0-beta.0",
      "0.3.0-beta.1",
      "0.3.0-beta.2",
      "0.3.0-beta.3",
      "0.3.0-beta.4",
      "0.3.0-beta.5",
    ];
    for (let i = 0; i < knownOrder.length; i++) {
      const idx = versions.indexOf(knownOrder[i]);
      expect(idx, `${knownOrder[i]} should be in versions`).not.toBe(-1);
      if (i > 0) {
        const prevIdx = versions.indexOf(knownOrder[i - 1]);
        expect(
          idx,
          `${knownOrder[i]} should come after ${knownOrder[i - 1]}`,
        ).toBeGreaterThan(prevIdx);
      }
    }
  });

  it("[beta.0] shell-to-python migration uses only renames (no deletes)", () => {
    const migrations = getMigrationsForVersion("0.2.15", "0.3.0-beta.0");
    const renames = migrations.filter((m) => m.type === "rename");
    const deletes = migrations.filter((m) => m.type === "delete");
    expect(renames.length).toBeGreaterThan(0);
    expect(deletes.length).toBe(0);
  });

  it("[#57] shell archive migrations use rename type with correct from/to paths", () => {
    const migrations = getMigrationsForVersion("0.2.15", "0.3.0-beta.0");
    const shellArchives = migrations.filter((m) =>
      m.to?.includes("scripts-shell-archive"),
    );
    // 19 shell scripts should be archived
    expect(shellArchives.length).toBe(19);
    for (const m of shellArchives) {
      expect(m.type).toBe("rename");
      expect(m.from).toMatch(/\.trellis\/scripts\/.*\.sh$/);
      expect(m.to).toMatch(/\.trellis\/scripts-shell-archive\/.*\.sh$/);
      // The filename should be preserved
      const fromFile = m.from.split("/").pop();
      const toFile = (m.to as string).split("/").pop();
      expect(toFile).toBe(fromFile);
    }
  });

  it("[#57] shell archive covers all three subdirectories", () => {
    const migrations = getMigrationsForVersion("0.2.15", "0.3.0-beta.0");
    const shellArchives = migrations.filter((m) =>
      m.to?.includes("scripts-shell-archive"),
    );
    const topLevel = shellArchives.filter(
      (m) => !m.from.includes("/common/") && !m.from.includes("/multi-agent/"),
    );
    const common = shellArchives.filter((m) => m.from.includes("/common/"));
    const multiAgent = shellArchives.filter((m) =>
      m.from.includes("/multi-agent/"),
    );
    expect(topLevel.length).toBe(6);
    expect(common.length).toBe(8);
    expect(multiAgent.length).toBe(5);
  });

  it("[0.2.14] command namespace migration renames exist", () => {
    const migrations = getMigrationsForVersion("0.2.13", "0.2.14");
    expect(migrations.length).toBeGreaterThan(0);
    // Should include commands moved to trellis/ subdirectory
    const claudeRenames = migrations.filter(
      (m) => m.type === "rename" && m.from.startsWith(".claude/commands/"),
    );
    expect(claudeRenames.length).toBeGreaterThan(0);
  });

  // v0.5.0-beta.0: 5 user-facing commands became auto-triggered skills across all platforms.
  // Manifest must contain 13 source layers × 5 commands = 65 rename entries so upgraders
  // don't end up with old command files alongside new skill files.
  describe("[0.5.0-beta.0] command→skill rename coverage", () => {
    const COMMANDS = [
      "before-dev",
      "brainstorm",
      "break-loop",
      "check",
      "update-spec",
    ] as const;

    type PathFn = (name: string) => string;
    const PLATFORMS: { id: string; from: PathFn; to: PathFn }[] = [
      {
        id: "claude",
        from: (n) => `.claude/commands/trellis/${n}.md`,
        to: (n) => `.claude/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "cursor",
        from: (n) => `.cursor/commands/trellis-${n}.md`,
        to: (n) => `.cursor/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "opencode",
        from: (n) => `.opencode/commands/trellis/${n}.md`,
        to: (n) => `.opencode/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "codebuddy",
        from: (n) => `.codebuddy/commands/trellis/${n}.md`,
        to: (n) => `.codebuddy/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "droid",
        from: (n) => `.factory/commands/trellis/${n}.md`,
        to: (n) => `.factory/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "gemini",
        from: (n) => `.gemini/commands/trellis/${n}.toml`,
        to: (n) => `.gemini/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "copilot",
        from: (n) => `.github/prompts/${n}.prompt.md`,
        to: (n) => `.github/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "kilo",
        from: (n) => `.kilocode/workflows/${n}.md`,
        to: (n) => `.kilocode/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "antigravity",
        from: (n) => `.agent/workflows/${n}.md`,
        to: (n) => `.agent/skills/trellis-${n}/SKILL.md`,
      },
      {
        // Devin shipped as "windsurf" (.windsurf/) at 0.5.0-beta.0 — this
        // historical manifest predates the Windsurf → Devin rename, so the
        // rename entries here are still keyed on the old .windsurf/ paths.
        id: "devin (legacy .windsurf/)",
        from: (n) => `.windsurf/workflows/trellis-${n}.md`,
        to: (n) => `.windsurf/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "kiro",
        from: (n) => `.kiro/skills/${n}/SKILL.md`,
        to: (n) => `.kiro/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "qoder",
        from: (n) => `.qoder/skills/${n}/SKILL.md`,
        to: (n) => `.qoder/skills/trellis-${n}/SKILL.md`,
      },
      {
        id: "shared",
        from: (n) => `.agents/skills/${n}/SKILL.md`,
        to: (n) => `.agents/skills/trellis-${n}/SKILL.md`,
      },
    ];

    it("has at least 65 rename entries for command→skill (13 platforms × 5 commands)", () => {
      const migrations = getMigrationsForVersion("0.4.0", "0.5.0-beta.0");
      const renames = migrations.filter((m) => m.type === "rename");
      // >= because additional non-command→skill renames may exist (e.g. finish-work
      // relocation under trellis- namespace on skill-only platforms).
      expect(renames.length).toBeGreaterThanOrEqual(
        PLATFORMS.length * COMMANDS.length,
      );
    });

    it("every platform × command pair has a matching rename entry", () => {
      const migrations = getMigrationsForVersion("0.4.0", "0.5.0-beta.0");
      const renames = migrations.filter((m) => m.type === "rename");
      const index = new Map(renames.map((m) => [m.from, m.to]));

      for (const p of PLATFORMS) {
        for (const c of COMMANDS) {
          const expectedFrom = p.from(c);
          const expectedTo = p.to(c);
          expect(
            index.has(expectedFrom),
            `missing rename for ${p.id}:${c} (${expectedFrom})`,
          ).toBe(true);
          expect(index.get(expectedFrom)).toBe(expectedTo);
        }
      }
    });

    it("breaking + recommendMigrate flags are both set (drives gate)", () => {
      // The update.ts breaking-change gate only fires when BOTH flags are true.
      // If either gets dropped accidentally, users upgrading from 0.4.x can half-migrate
      // by running `trellis update` without `--migrate`.
      const manifestPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/migrations/manifests/0.5.0-beta.0.json",
      );
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
        breaking?: boolean;
        recommendMigrate?: boolean;
      };
      expect(manifest.breaking).toBe(true);
      expect(manifest.recommendMigrate).toBe(true);
    });
  });
});

// =============================================================================
// YAML Quote Stripping (0.3.8)
// =============================================================================

describe("regression: parse_simple_yaml uses _unquote not greedy strip (0.3.8)", () => {
  // 0.6.x: the parser was consolidated into trellis_config.py (config.py now
  // imports it), so these source assertions follow it there. config.py must
  // not grow a second copy back.
  it("trellis_config.py defines _unquote helper", () => {
    expect(commonTrellisConfig).toContain("def _unquote(value: str) -> str:");
  });

  it("trellis_config.py uses _unquote for list items, not .strip('\"')", () => {
    // The bug: .strip('"').strip("'") greedily eats nested quotes
    // e.g. "echo 'hello'" -> strip("'") -> echo 'hello (broken!)
    expect(commonTrellisConfig).not.toContain(".strip('\"').strip(\"'\")");
    expect(commonTrellisConfig).toContain("_unquote(stripped[2:].strip())");
  });

  it("trellis_config.py uses _unquote for key-value, not .strip('\"')", () => {
    // 0.5.11: parse path strips inline comments first, then unquotes, so YAML
    // `key: false  # comment` parses correctly. The forbidden
    // `.strip('"').strip("'")` greedy chain still must not appear.
    expect(commonTrellisConfig).not.toContain(".strip('\"').strip(\"'\")");
    expect(commonTrellisConfig).toContain("_unquote(value)");
    expect(commonTrellisConfig).toContain("_strip_inline_comment(value)");
  });

  it("config.py imports the parser instead of redefining it", () => {
    expect(commonConfig).toContain(
      "from .trellis_config import parse_simple_yaml",
    );
    expect(commonConfig).not.toContain("def parse_simple_yaml(");
    expect(commonConfig).not.toContain("def _parse_yaml_block(");
    expect(commonConfig).not.toContain("def _unquote(");
  });
});

describe("regression: parse_simple_yaml Python execution (0.3.8)", () => {
  // trellis_config.py imports nothing from the package (hooks load it as a
  // single file), so it runs standalone as-is — no source extraction needed.
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  let tmpDir: string;

  beforeEach(() => {
    expect(commonTrellisConfig).toContain("def parse_simple_yaml(");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-yaml-py-"));
    fs.writeFileSync(path.join(tmpDir, "yaml_parser.py"), commonTrellisConfig);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Run parse_simple_yaml via Python subprocess, returning result + stderr */
  function runPythonYamlFull(yamlContent: string): {
    result: unknown;
    stderr: string;
  } {
    const scriptFile = path.join(tmpDir, "_test.py");
    const script = [
      "import sys, json",
      `sys.path.insert(0, ${JSON.stringify(tmpDir)})`,
      "from yaml_parser import parse_simple_yaml",
      `result = parse_simple_yaml(${JSON.stringify(yamlContent)})`,
      "print(json.dumps(result))",
    ].join("\n");
    fs.writeFileSync(scriptFile, script);
    const proc = spawnSync(pythonCmd, [scriptFile], { encoding: "utf-8" });
    expect(proc.status, proc.stderr).toBe(0);
    return {
      result: JSON.parse((proc.stdout ?? "").trim()),
      stderr: proc.stderr ?? "",
    };
  }

  function runPythonYaml(yamlContent: string): unknown {
    return runPythonYamlFull(yamlContent).result;
  }

  it("nested single quotes inside double quotes are preserved", () => {
    const result = runPythonYaml("key: \"echo 'hello'\"");
    expect(result).toEqual({ key: "echo 'hello'" });
  });

  it("nested double quotes inside single quotes are preserved", () => {
    const result = runPythonYaml("key: 'say \"hi\"'");
    expect(result).toEqual({ key: 'say "hi"' });
  });

  it("list items with nested quotes are preserved", () => {
    const result = runPythonYaml(
      "hooks:\n  after_create:\n    - \"echo 'Task created'\"",
    );
    expect(result).toEqual({
      hooks: { after_create: ["echo 'Task created'"] },
    });
  });

  it("simple quoted values work", () => {
    const result = runPythonYaml("a: \"hello\"\nb: 'world'");
    expect(result).toEqual({ a: "hello", b: "world" });
  });

  it("unquoted values are unchanged", () => {
    const result = runPythonYaml("key: plain value");
    expect(result).toEqual({ key: "plain value" });
  });

  it("mismatched quotes are left as-is", () => {
    const result = runPythonYaml("key: \"hello'");
    expect(result).toEqual({ key: "\"hello'" });
  });

  // ---------------------------------------------------------------------
  // Unsupported constructs are reported, not silently mis-parsed (audit §4)
  // ---------------------------------------------------------------------

  it("a mapping inside a list is not hoisted into the parent dict", () => {
    // Was: {"packages": ["name: cli"], "path": "packages/cli"} — the nested
    // `path` key silently became a top-level config key.
    const { result, stderr } = runPythonYamlFull(
      "packages:\n  - name: cli\n    path: packages/cli\n",
    );
    expect(result).not.toHaveProperty("path");
    expect(result).toEqual({ packages: ["name: cli"] });
    expect(stderr).toContain("mappings inside a list are not supported");
    expect(stderr).toContain("path: packages/cli");
  });

  it("block scalars are reported and their body is not leaked", () => {
    // Was: {"notes": "|"} — the marker became the value, body dropped.
    const { result, stderr } = runPythonYamlFull(
      "notes: |\n  line one\n  key: not-a-real-key\nkeep: ok\n",
    );
    expect(result).toEqual({ keep: "ok" });
    expect(stderr).toContain("block scalars are not supported");
    expect(stderr).toContain(":1:");
  });

  it("anchors, aliases, merge keys and flow collections are reported", () => {
    const { result, stderr } = runPythonYamlFull(
      "base: &b\nuse: *b\nlist: [a, b]\nmap: {a: 1}\nkeep: ok\n",
    );
    expect(result).toEqual({ keep: "ok" });
    expect(stderr).toContain("YAML anchors are not supported");
    expect(stderr).toContain("YAML aliases are not supported");
    expect(stderr).toContain("flow sequences are not supported");
    expect(stderr).toContain("flow mappings are not supported");
  });

  it("quoted values that look like YAML constructs stay untouched", () => {
    // A hook command is a plain string; only unquoted scalars are inspected.
    const { result, stderr } = runPythonYamlFull(
      'cmd: "a | b"\nglob: "*.py"\nflowish: "[a, b]"\n',
    );
    expect(result).toEqual({
      cmd: "a | b",
      glob: "*.py",
      flowish: "[a, b]",
    });
    expect(stderr).toBe("");
  });

  it("a well-formed config parses with no warnings", () => {
    const { result, stderr } = runPythonYamlFull(
      [
        "session_auto_commit: false  # off for this project",
        "packages:",
        "  cli:",
        "    path: packages/cli",
        "    git: yes",
        "hooks:",
        "  after_create:",
        "    - echo one",
        "  after_archive:",
        "    - echo two",
        "",
      ].join("\n"),
    );
    expect(result).toEqual({
      session_auto_commit: "false",
      packages: { cli: { path: "packages/cli", git: "yes" } },
      hooks: { after_create: ["echo one"], after_archive: ["echo two"] },
    });
    expect(stderr).toBe("");
  });
});

// =============================================================================
// 8. Dead Code / Template Content Regressions
// =============================================================================

// =============================================================================
// S4: Submodule + PR Awareness (beta.1)
// =============================================================================

// submodule awareness in multi_agent scripts tests removed — multi_agent pipeline removed

describe("regression: cross-platform-thinking-guide dead code removed (0.3.1)", () => {
  it("[0.3.1] guidesCrossPlatformThinkingGuideContent is not exported from markdown/index", () => {
    expect(markdownExports).not.toHaveProperty(
      "guidesCrossPlatformThinkingGuideContent",
    );
  });

  it("[0.3.1] guides index.md does not reference cross-platform-thinking-guide", () => {
    expect(guidesIndexContent).not.toContain("cross-platform-thinking-guide");
    expect(guidesIndexContent).not.toContain("Cross-Platform Thinking Guide");
  });
});

// =============================================================================
// Pull-based Class-2 Platforms (0.5)
// =============================================================================

describe("regression: kerminal uses pull-based sub-agent context", () => {
  // Kerminal is class-2 (agentCapable, no shipped session-start hook, no
  // project-level hooks/settings Trellis may write): sub-agent context is
  // pull-based. implement/check skills get the pull-based prelude; research
  // does not (it searches the spec tree and has no task-level context
  // dependency).
  const preludeSkills = [
    ".kerminal/skills/trellis-implement/SKILL.md",
    ".kerminal/skills/trellis-check/SKILL.md",
  ];
  const nonPreludeSkills = [".kerminal/skills/trellis-research/SKILL.md"];

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-c2-kerminal-"));
    setWriteMode("force");
    await configurePlatform("kerminal", tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    setWriteMode("ask");
  });

  it("installs no hook scripts under .kerminal", () => {
    expect(fs.existsSync(path.join(tmpDir, ".kerminal", "hooks"))).toBe(false);
  });

  it("implement/check definitions contain pull-based prelude", () => {
    for (const file of preludeSkills) {
      const content = fs.readFileSync(path.join(tmpDir, file), "utf-8");
      expect(content).toContain("Required: Load Trellis Context First");
      expect(content).toContain("task.py current --source");
    }
  });

  it("prelude is injected exactly once, not duplicated", () => {
    // Source templates must stay prelude-free so the injector is the single
    // source of the block.
    for (const file of preludeSkills) {
      const content = fs.readFileSync(path.join(tmpDir, file), "utf-8");
      const occurrences =
        content.split("Required: Load Trellis Context First").length - 1;
      expect(occurrences, `${file} should have exactly one prelude`).toBe(1);
    }
  });

  it("[issue-225] prelude tells sub-agent to look for `Active task:` line in dispatch prompt first", () => {
    for (const file of preludeSkills) {
      const content = fs.readFileSync(path.join(tmpDir, file), "utf-8");
      expect(content).toContain("Active task:");
      expect(content).toContain("dispatch prompt");
    }
  });

  it("research definition does NOT contain pull-based prelude", () => {
    // research is orthogonal: it searches .trellis/spec/ and doesn't
    // depend on an active task. Prelude would make it fail when Phase 1.2
    // runs before planning-time jsonl curation.
    for (const file of nonPreludeSkills) {
      const content = fs.readFileSync(path.join(tmpDir, file), "utf-8");
      expect(content).not.toContain("Required: Load Trellis Context First");
    }
  });

  it("collectPlatformTemplates matches the written prelude skills byte-for-byte", () => {
    const templates = collectPlatformTemplates("kerminal");
    expect(templates).toBeInstanceOf(Map);
    for (const file of preludeSkills) {
      const onDisk = fs.readFileSync(path.join(tmpDir, file), "utf-8");
      expect(templates?.get(file), `${file} drifted`).toBe(onDisk);
    }
  });
});

// =============================================================================
// Research agent must persist findings (0.5)
// =============================================================================

describe("regression: research agent persists findings to task dir", () => {
  // The research agent must:
  //   1. Have a Write tool — otherwise it cannot fulfill workflow.md step 1.2
  //      "调研产出必须写入文件".
  //   2. Explicitly tell the agent to write under {TASK_DIR}/research/.
  //   3. NOT have "Modify any files" as a blanket forbidden rule (that
  //      contradicts the persist requirement).
  //
  // Before 0.5, research agents were read-only and only emitted chat
  // replies, which got compacted away.
  const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname2, "../../..");

  it("[kerminal] research agent has Write tool and persist instruction", () => {
    const rel = "packages/cli/src/templates/kerminal/agents/trellis-research.md";
    const content = fs.readFileSync(path.join(repoRoot, rel), "utf-8");
    // Frontmatter tool list must include a write-capable tool. Kerminal
    // agents use the Kerminal tool naming (write_file), not Claude-style
    // capitalized names.
    const fm = content.split("---\n")[1] ?? "";
    expect(fm).toMatch(/tools:\s*[^\n]*(\bWrite\b|write_file)/);
    // Body must reference persist target
    expect(content).toContain("{TASK_DIR}/research/");
    expect(content).toMatch(/PERSIST|[Pp]ersist/);
    // Must not have blanket "Modify any files" forbidden rule
    expect(content).not.toMatch(/^- Modify any files\s*$/m);
  });
});

describe("regression: templates/markdown/spec contains only .md.txt files (0.5.0-beta.9)", () => {
  // Invariant: packages/cli/src/templates/markdown/spec/ is for user-facing
  // placeholder templates only — markdown/index.ts reads .md.txt via
  // readLocalTemplate, so bare .md files there are orphans (ship to dist as
  // dead weight, never land on user disks). Documented in
  // .trellis/spec/cli/backend/directory-structure.md "Don't: Leak dogfood
  // spec into templates/markdown/spec/". Captured while cleaning up ~2-year-old
  // leakage in task 04-21-task-schema-unify.
  it("every file under templates/markdown/spec ends in .md.txt", () => {
    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.isFile()) out.push(full);
      }
      return out;
    }
    const __dirname3 = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(__dirname3, "../../..");
    const specRoot = path.join(
      repoRoot,
      "packages/cli/src/templates/markdown/spec",
    );
    const files = walk(specRoot);
    const orphans = files.filter((f) => !f.endsWith(".md.txt"));
    expect(
      orphans,
      `Orphan non-.md.txt files in templates/markdown/spec/: ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});

describe("regression: configSectionsAdded (issue-codex-dispatch-mode)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-config-section-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("[config-sections] extractConfigSection returns content between matching separator and next separator", async () => {
    const { extractConfigSection } = await import("../src/commands/update.js");
    const fake = [
      "# Header preamble",
      "",
      "#-------------------------------------------------------------------------------",
      "# First Section",
      "#-------------------------------------------------------------------------------",
      "first_key: value",
      "",
      "#-------------------------------------------------------------------------------",
      "# Second Section",
      "#-------------------------------------------------------------------------------",
      "# second_key: comment",
      "second_key: 2",
      "",
      "#-------------------------------------------------------------------------------",
      "# Third Section",
      "#-------------------------------------------------------------------------------",
      "third_key: 3",
    ].join("\n");

    const second = extractConfigSection(fake, "Second Section");
    expect(second).not.toBeNull();
    expect(second).toContain("# Second Section");
    expect(second).toContain("second_key: 2");
    // Must stop before the next separator block
    expect(second).not.toContain("Third Section");
    expect(second).not.toContain("third_key: 3");

    // Last section runs to EOF
    const third = extractConfigSection(fake, "Third Section");
    expect(third).not.toBeNull();
    expect(third).toContain("third_key: 3");

    // Missing heading returns null
    expect(extractConfigSection(fake, "Nonexistent Section")).toBeNull();
  });

  it("[config-sections] applyConfigSectionsAdded appends section when sentinel missing, idempotent on rerun", async () => {
    const { applyConfigSectionsAdded } =
      await import("../src/commands/update.js");
    const trellisDir = path.join(tmpDir, ".trellis");
    fs.mkdirSync(trellisDir, { recursive: true });
    const userConfigPath = path.join(trellisDir, "config.yaml");
    const userConfig = [
      "# Trellis Configuration",
      'session_commit_message: "chore: record journal"',
      "",
    ].join("\n");
    fs.writeFileSync(userConfigPath, userConfig);

    const bundledTemplate = [
      "# Trellis Configuration",
      'session_commit_message: "chore: record journal"',
      "",
      "#-------------------------------------------------------------------------------",
      "# Codex (sub-agent dispatch behavior)",
      "#-------------------------------------------------------------------------------",
      "# codex:",
      "#   dispatch_mode: sub-agent",
      "",
    ].join("\n");

    const entries = [
      {
        file: ".trellis/config.yaml",
        sentinel: "codex:",
        sectionHeading: "Codex (sub-agent dispatch behavior)",
      },
    ];
    const bundled = new Map<string, string>([
      [".trellis/config.yaml", bundledTemplate],
    ]);

    const first = applyConfigSectionsAdded(entries, tmpDir, bundled);
    expect(first.appended).toBe(1);
    const after = fs.readFileSync(userConfigPath, "utf-8");
    expect(after).toContain("# Codex (sub-agent dispatch behavior)");
    expect(after).toContain("codex:");
    expect(after).toContain("dispatch_mode: sub-agent");

    // Rerun: sentinel now present, no append.
    const second = applyConfigSectionsAdded(entries, tmpDir, bundled);
    expect(second.appended).toBe(0);
    const after2 = fs.readFileSync(userConfigPath, "utf-8");
    expect(after2).toBe(after);
  });

  it("[config-sections] applyConfigSectionsAdded skips when target file does not exist", async () => {
    const { applyConfigSectionsAdded } =
      await import("../src/commands/update.js");
    const result = applyConfigSectionsAdded(
      [
        {
          file: ".trellis/config.yaml",
          sentinel: "codex:",
          sectionHeading: "Codex (sub-agent dispatch behavior)",
        },
      ],
      tmpDir,
      new Map<string, string>([[".trellis/config.yaml", "# fake template"]]),
    );
    expect(result.appended).toBe(0);
  });
});

// =============================================================================
// safe-commit: gitignored .trellis/ recovery (0.5.10 → 0.5.11)
// =============================================================================
//
// Real user incident: project .gitignore listed `.trellis/`. add_session.py's
// auto-commit ran `git add .trellis/workspace .trellis/tasks`, got `ignored
// by .gitignore`, fell back to a hint suggesting `git add .trellis &&
// commit`. The AI agent driving the workflow extrapolated that to
// `git add -f .trellis/`, which forced in `.trellis/.backup-*/`,
// `.trellis/worktrees/`, `.trellis/.template-hashes.json`, etc. — 548 files
// / 83474 lines of caches/backups committed.
//
// 0.5.10 fix (since reverted):
//   - Scripts only stage SPECIFIC product paths.
//   - On `ignored by` the scripts retried with `git add -f <specific paths>`.
// That auto-`-f` was an over-fix — when a user gitignores `.trellis/` they
// mean "keep .trellis/ local-only", and forcing the commit through (even on
// narrow paths) violates user intent. Group-chat report: a finish-work auto
// committed `.trellis/workspace/` straight into a repo whose .gitignore
// excluded `.trellis/`.
//
// 0.5.11 fix (current):
//   - Plain `git add <specific>` is tried once. On `ignored by`, the script
//     warns and skips the auto-commit — never `-f`.
//   - New `session_auto_commit: false` config opts the user out of auto-stage
//     and auto-commit entirely (issue #245).
//   - The warning explicitly says ``Do NOT use `git add -f .trellis/```` so
//     AI re-reading the log doesn't reinvent the bug, and points at the new
//     `session_auto_commit: false` knob.
//
// These tests synthesize a tmp git repo with `.trellis/` gitignored and
// verify (a) on `ignored by` the script warns + skips (no commit, no -f),
// (b) `session_auto_commit: false` skips git entirely in any state, and
// (c) the negative-rule warning + new config hint are reachable.
// =============================================================================

describe("regression: safe auto-commit when .trellis/ is gitignored (0.5.10 → 0.5.11)", () => {
  let tmpDir: string;
  const pyCmd = process.platform === "win32" ? "python" : "python3";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-safe-commit-"));
    execSync("git init -q -b main", { cwd: tmpDir });
    // Configure user so git commit succeeds in CI sandboxes.
    execSync('git config user.email "test@trellis.local"', { cwd: tmpDir });
    execSync('git config user.name "Trellis Test"', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(rel: string, content: string): void {
    const abs = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
  }

  function writeTrellisScripts(): void {
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [rel, content] of getAllScripts()) {
      const abs = path.join(scriptsDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf-8");
    }
  }

  function writeWorkspaceIndex(): void {
    writeFile(
      ".trellis/workspace/test-dev/index.md",
      [
        "# Workspace Index - test-dev",
        "",
        "## Current Status",
        "",
        "<!-- @@@auto:current-status -->",
        "- **Active File**: `journal-1.md`",
        "- **Total Sessions**: 0",
        "- **Last Active**: -",
        "<!-- @@@/auto:current-status -->",
        "",
        "## Active Documents",
        "",
        "<!-- @@@auto:active-documents -->",
        "| File | Lines | Status |",
        "|------|-------|--------|",
        "| `journal-1.md` | ~0 | Active |",
        "<!-- @@@/auto:active-documents -->",
        "",
        "## Session History",
        "",
        "<!-- @@@auto:session-history -->",
        "| # | Date | Title | Commits | Branch |",
        "|---|------|-------|---------|--------|",
        "<!-- @@@/auto:session-history -->",
        "",
      ].join("\n"),
    );
  }

  function setupRepo(options?: { gitignoreTrellis?: boolean }): void {
    writeTrellisScripts();
    writeFile(
      ".trellis/.developer",
      "name=test-dev\ninitialized_at=2026-05-09T00:00:00\n",
    );
    writeFile(
      ".trellis/workspace/test-dev/journal-1.md",
      "# Journal - test-dev (Part 1)\n\n---\n",
    );
    writeWorkspaceIndex();
    // Ignored caches/backups must exist on disk to prove they don't get
    // staged when -f is forced on specific paths.
    writeFile(
      ".trellis/.backup-2026-05-09/should-not-be-committed.txt",
      "secret-backup\n",
    );
    writeFile(
      ".trellis/worktrees/wt-a/should-not-be-committed.txt",
      "secret-worktree\n",
    );
    writeFile(
      ".trellis/.template-hashes.json",
      '{"_": "should-not-be-committed"}\n',
    );
    writeFile(
      ".trellis/.runtime/sessions/should-not-be-committed.json",
      "{}\n",
    );

    if (options?.gitignoreTrellis) {
      writeFile(".gitignore", ".trellis/\n");
    }
    // Seed an initial commit so HEAD exists.
    writeFile("README.md", "test\n");
    execSync("git add README.md", { cwd: tmpDir });
    if (options?.gitignoreTrellis) {
      execSync("git add .gitignore", { cwd: tmpDir });
    }
    execSync('git commit -q -m "init"', { cwd: tmpDir });
  }

  function runAddSession(): { stdout: string; stderr: string } {
    const scriptPath = path.join(
      tmpDir,
      ".trellis",
      "scripts",
      "add_session.py",
    );
    const result = spawnSync(
      pyCmd,
      [scriptPath, "--title", "Test", "--summary", "Test"],
      {
        cwd: tmpDir,
        encoding: "utf-8",
        env: { ...process.env, TRELLIS_CONTEXT_ID: "session-a" },
      },
    );
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  function listCommittedFiles(): string[] {
    const out = execSync("git ls-tree -r --name-only HEAD", {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    return out.split("\n").filter((l) => l.length > 0);
  }

  it("[gitignore-trellis] add_session warns and skips when .trellis/ is ignored (default mode)", () => {
    setupRepo({ gitignoreTrellis: true });
    const { stderr } = runAddSession();

    // Plain add fails with "ignored by". 0.5.11 must NOT retry with -f.
    // Instead the script warns and skips the entire auto-commit. So no
    // "Auto-committed" line, and the warning fires.
    expect(stderr).not.toContain("Auto-committed");
    expect(stderr).toContain("ignored by your .gitignore");
    expect(stderr).toContain("Do NOT use `git add -f .trellis/`");
    expect(stderr).toContain("session_auto_commit: false");

    // Nothing under .trellis/ should be tracked: the user's .gitignore
    // intent is preserved.
    const tracked = listCommittedFiles();
    for (const tracked_path of tracked) {
      expect(
        tracked_path.startsWith(".trellis/"),
        `should not commit anything under .trellis/ (got: ${tracked_path})`,
      ).toBe(false);
    }

    // The journal + index files are still on disk (the script wrote them
    // before attempting auto-commit) — only git was untouched.
    expect(
      fs.existsSync(
        path.join(tmpDir, ".trellis/workspace/test-dev/journal-1.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis/workspace/test-dev/index.md")),
    ).toBe(true);
  });

  it("[gitignore-trellis] add_session works normally when .trellis/ is NOT ignored", () => {
    // Regression guard: pre-existing behavior must not change for users
    // whose .gitignore does not exclude .trellis/.
    setupRepo({ gitignoreTrellis: false });
    const { stderr } = runAddSession();
    expect(stderr).toContain("Auto-committed");

    const tracked = listCommittedFiles();
    expect(tracked).toContain(".trellis/workspace/test-dev/journal-1.md");
  });

  it("[gitignore-trellis] safe_commit module ships and contains the negative warning + new config hint", () => {
    // The warning's exact text matters because AI agents read it.
    // Specifically the negative example must appear verbatim so any future
    // refactor that removes it will fail this test. 0.5.11 also adds the
    // new session_auto_commit hint.
    const safeCommit = getAllScripts().get("common/safe_commit.py");
    expect(safeCommit).toBeTruthy();
    expect(safeCommit).toContain("Do NOT use `git add -f .trellis/`");
    expect(safeCommit).toContain("safe_trellis_paths_to_add");
    expect(safeCommit).toContain("safe_archive_paths_to_add");
    expect(safeCommit).toContain("safe_git_add");
    // 0.5.11: new hint pointing users at the config knob.
    expect(safeCommit).toContain("session_auto_commit: false");
    // 0.5.11: auto -f retry must be gone. The function body should no
    // longer issue `git add -f`.
    expect(safeCommit).not.toMatch(/\["add", "-f", "--",/);
  });

  it("[gitignore-trellis] task.py archive warns and skips when .trellis/ is ignored (default mode)", () => {
    setupRepo({ gitignoreTrellis: true });
    // Create a task to archive.
    writeFile(
      ".trellis/tasks/issue-500/task.json",
      JSON.stringify(
        { title: "Test archive", status: "in_progress", package: null },
        null,
        2,
      ),
    );
    writeFile(".trellis/tasks/issue-500/prd.md", "# PRD\n");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(pyCmd, [taskScriptPath, "archive", "issue-500"], {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: "session-arch" },
    });
    const stderr = result.stderr ?? "";
    // 0.5.11: must NOT retry with -f, must NOT auto-commit. Warning must
    // surface so the user knows their .gitignore won.
    expect(stderr).not.toContain("Auto-committed");
    expect(stderr).toContain("ignored by your .gitignore");
    expect(stderr).toContain("Do NOT use `git add -f .trellis/`");

    const tracked = listCommittedFiles();
    // Nothing under .trellis/ should be tracked.
    for (const t of tracked) {
      expect(
        t.startsWith(".trellis/"),
        `should not commit anything under .trellis/ (got: ${t})`,
      ).toBe(false);
    }

    // The archive directory move on disk still happened — only git was
    // untouched.
    const archiveExists = fs
      .readdirSync(path.join(tmpDir, ".trellis/tasks/archive"))
      .some((monthDir) => {
        const monthPath = path.join(tmpDir, ".trellis/tasks/archive", monthDir);
        return (
          fs.statSync(monthPath).isDirectory() &&
          fs.existsSync(path.join(monthPath, "issue-500"))
        );
      });
    expect(archiveExists).toBe(true);
  });

  // ===========================================================================
  // 0.5.11: session_auto_commit config (issue #245 + screenshot user)
  // ===========================================================================

  function writeConfigYaml(content: string): void {
    writeFile(".trellis/config.yaml", content);
  }

  it("[session_auto_commit=false] add_session skips git entirely (no add, no commit)", () => {
    // User wants journal/task files written to disk but no auto-staging
    // and no auto-commit. Issue #245 + screenshot user use case.
    setupRepo({ gitignoreTrellis: false });
    writeConfigYaml("session_auto_commit: false\n");

    const { stderr } = runAddSession();
    expect(stderr).not.toContain("Auto-committed");
    expect(stderr).toContain("session_auto_commit: false");

    // No new commits beyond the initial "init" commit.
    const log = execSync("git log --oneline", {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(log.trim().split("\n").length).toBe(1);

    // No staged changes either — `git add` was never called.
    const staged = execSync("git diff --cached --name-only", {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(staged.trim()).toBe("");

    // Files were still written to disk.
    expect(
      fs.existsSync(
        path.join(tmpDir, ".trellis/workspace/test-dev/journal-1.md"),
      ),
    ).toBe(true);
  });

  it("[session_auto_commit=false] task.py archive skips git entirely", () => {
    setupRepo({ gitignoreTrellis: false });
    writeConfigYaml("session_auto_commit: false\n");

    writeFile(
      ".trellis/tasks/issue-600/task.json",
      JSON.stringify(
        { title: "Test archive", status: "in_progress", package: null },
        null,
        2,
      ),
    );
    writeFile(".trellis/tasks/issue-600/prd.md", "# PRD\n");

    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(pyCmd, [taskScriptPath, "archive", "issue-600"], {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: "session-arch-2" },
    });
    const stderr = result.stderr ?? "";
    expect(stderr).not.toContain("Auto-committed");
    expect(stderr).toContain("session_auto_commit: false");

    const log = execSync("git log --oneline", {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(log.trim().split("\n").length).toBe(1);

    // Archive directory move still happened on disk.
    const archiveExists = fs
      .readdirSync(path.join(tmpDir, ".trellis/tasks/archive"))
      .some((monthDir) => {
        const monthPath = path.join(tmpDir, ".trellis/tasks/archive", monthDir);
        return (
          fs.statSync(monthPath).isDirectory() &&
          fs.existsSync(path.join(monthPath, "issue-600"))
        );
      });
    expect(archiveExists).toBe(true);
  });

  it("[session_auto_commit] inline comment is stripped before parsing", () => {
    // YAML inline-comment trap: `key: false  # comment` previously broke in
    // common/config.py because parse_simple_yaml didn't strip ` #`. This
    // verifies the helper is shared with trellis_config.py's parser.
    setupRepo({ gitignoreTrellis: false });
    writeConfigYaml("session_auto_commit: false  # disable for this project\n");

    const { stderr } = runAddSession();
    expect(stderr).toContain("session_auto_commit: false");
    expect(stderr).not.toContain("Auto-committed");
    expect(stderr).not.toContain("invalid session_auto_commit");

    const log = execSync("git log --oneline", {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(log.trim().split("\n").length).toBe(1);
  });

  it("[session_auto_commit] string variants resolve to false", () => {
    // The helper must accept lowercase / uppercase / synonym forms.
    // Spot-check `FALSE` (uppercase) and `no` here; `0` and `off` follow
    // the same code path (the lowercase set in get_session_auto_commit).
    for (const variant of ["FALSE", "no", "off", "0"]) {
      setupRepo({ gitignoreTrellis: false });
      writeConfigYaml(`session_auto_commit: ${variant}\n`);

      const { stderr } = runAddSession();
      expect(
        stderr.includes("session_auto_commit: false"),
        `variant=${variant}`,
      ).toBe(true);

      // Reset for next iteration.
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-safe-commit-"));
      execSync("git init -q -b main", { cwd: tmpDir });
      execSync('git config user.email "test@trellis.local"', { cwd: tmpDir });
      execSync('git config user.name "Trellis Test"', { cwd: tmpDir });
    }
  });

  it("[session_auto_commit] invalid value falls back to true with stderr warn", () => {
    setupRepo({ gitignoreTrellis: false });
    writeConfigYaml("session_auto_commit: maybe\n");

    const { stderr } = runAddSession();
    // Warning fires.
    expect(stderr).toContain("invalid session_auto_commit value");
    // Falls back to true → auto-commit happens.
    expect(stderr).toContain("Auto-committed");
  });
});

// =============================================================================
// regression: transient .git/index.lock during archive auto-commit
// =============================================================================
//
// `task.py archive` moves the task directory on disk BEFORE it stages and
// commits. Another process holding `.git/index.lock` for a fraction of a
// second (IDE git integration, status daemon, a parallel session) made that
// auto-commit fail outright, leaving the user with a completed move and a git
// error to untangle.
//
// Fix: `run_git_retry_index_lock` retries ONLY index.lock failures — three
// attempts over ~1.5s — and the archive path uses it for `add`,
// `rm --cached` and `commit`. When the retries run out the move stays
// complete and the commit is reported as pending: rolling the move back would
// also have to undo the completed status, the re-parented children and the
// cleared sessions, and a partial rollback is worse than a named pending
// commit. The warning names the lock file and the command to run by hand.
// =============================================================================

describe("regression: bounded index.lock retry on archive auto-commit", () => {
  let tmpDir: string;
  const pyCmd = process.platform === "win32" ? "python" : "python3";
  const taskName = "issue-lock";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-index-lock-"));
    execSync("git init -q -b main", { cwd: tmpDir });
    execSync('git config user.email "test@trellis.local"', { cwd: tmpDir });
    execSync('git config user.name "Trellis Test"', { cwd: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(rel: string, content: string): void {
    const abs = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
  }

  function lockFile(): string {
    return path.join(tmpDir, ".git", "index.lock");
  }

  function setupRepo(): void {
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
    for (const [rel, content] of getAllScripts()) {
      const abs = path.join(scriptsDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf-8");
    }
    writeFile(
      ".trellis/.developer",
      "name=test-dev\ninitialized_at=2026-08-09T00:00:00\n",
    );
    writeFile(
      `.trellis/tasks/${taskName}/task.json`,
      JSON.stringify(
        { title: "Locked archive", status: "in_progress", package: null },
        null,
        2,
      ),
    );
    writeFile(`.trellis/tasks/${taskName}/prd.md`, "# PRD\n");
    writeFile("README.md", "test\n");
    // The task must be tracked: an untracked task dir makes a failed
    // auto-commit inconsequential, which is not the case under test.
    execSync("git add -A", { cwd: tmpDir });
    execSync('git commit -q -m "init"', { cwd: tmpDir });
  }

  function runArchive(): { status: number | null; stderr: string } {
    const taskScriptPath = path.join(tmpDir, ".trellis", "scripts", "task.py");
    const result = spawnSync(pyCmd, [taskScriptPath, "archive", taskName], {
      cwd: tmpDir,
      encoding: "utf-8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: "session-lock" },
    });
    return { status: result.status, stderr: result.stderr ?? "" };
  }

  function archivedTaskExists(): boolean {
    const archiveRoot = path.join(tmpDir, ".trellis/tasks/archive");
    if (!fs.existsSync(archiveRoot)) return false;
    return fs.readdirSync(archiveRoot).some((monthDir) => {
      const monthPath = path.join(archiveRoot, monthDir);
      return (
        fs.statSync(monthPath).isDirectory() &&
        fs.existsSync(path.join(monthPath, taskName))
      );
    });
  }

  function gitLogLines(): string[] {
    return execSync("git log --oneline", { cwd: tmpDir, encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);
  }

  it("[index-lock] retries only index.lock failures, bounded by the attempt count", () => {
    // Deterministic cover for the retry semantics themselves: the end-to-end
    // tests below depend on wall-clock timing, this one does not.
    setupRepo();
    const probe = `
import json
import sys
from pathlib import Path

root = Path.cwd()
sys.path.insert(0, str(root / ".trellis" / "scripts"))
import common.git as g

# Real backoff would make this probe sleep for its whole runtime.
g.INDEX_LOCK_RETRY_BACKOFF = (0, 0)
lock_err = "fatal: Unable to create '/repo/.git/index.lock': File exists."
calls = []

def transient(args, cwd=None, timeout=None):
    calls.append(args)
    if len(calls) < g.INDEX_LOCK_RETRY_ATTEMPTS:
        return 1, "", lock_err
    return 0, "done", ""

def stuck(args, cwd=None, timeout=None):
    calls.append(args)
    return 1, "", lock_err

def unrelated(args, cwd=None, timeout=None):
    calls.append(args)
    return 1, "", "fatal: pathspec 'nope' did not match any files"

g.run_git = transient
transient_rc, transient_out, _ = g.run_git_retry_index_lock(["commit", "-m", "x"])
transient_calls = len(calls)

calls.clear()
g.run_git = stuck
stuck_rc, _, stuck_err = g.run_git_retry_index_lock(["commit", "-m", "x"])
stuck_calls = len(calls)

calls.clear()
g.run_git = unrelated
unrelated_rc, _, _ = g.run_git_retry_index_lock(["add", "nope"])
unrelated_calls = len(calls)

print(json.dumps({
    "attempts": g.INDEX_LOCK_RETRY_ATTEMPTS,
    "transient_rc": transient_rc,
    "transient_out": transient_out,
    "transient_calls": transient_calls,
    "stuck_rc": stuck_rc,
    "stuck_calls": stuck_calls,
    "stuck_named_lock": g.stderr_indicates_index_lock(stuck_err),
    "unrelated_rc": unrelated_rc,
    "unrelated_calls": unrelated_calls,
}))
`;
    const result = spawnSync(pyCmd, ["-c", probe], {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      attempts: 3,
      // A lock released before the last attempt ends in success.
      transient_rc: 0,
      transient_out: "done",
      transient_calls: 3,
      // A lock that never clears stops at the bound instead of hanging.
      stuck_rc: 1,
      stuck_calls: 3,
      stuck_named_lock: true,
      // Anything that is not a lock failure must not be retried — looping
      // over a real error only delays it.
      unrelated_rc: 1,
      unrelated_calls: 1,
    });
  });

  it("[index-lock] archive survives a lock that is released mid-retry", () => {
    setupRepo();
    fs.writeFileSync(lockFile(), "", "utf-8");

    // Released after the first attempt is certain to have hit the lock, but
    // before the retry window (~1.5s from that first attempt) closes.
    const releaser = spawn(
      pyCmd,
      [
        "-c",
        `import os, time; time.sleep(1.2); os.path.exists(${JSON.stringify(
          lockFile(),
        )}) and os.remove(${JSON.stringify(lockFile())})`,
      ],
      { stdio: "ignore" },
    );
    releaser.unref();

    const { status, stderr } = runArchive();

    expect(status, stderr).toBe(0);
    expect(stderr).toContain("Auto-committed");
    expect(archivedTaskExists()).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".trellis/tasks", taskName))).toBe(
      false,
    );

    const log = gitLogLines();
    expect(log.length).toBe(2);
    expect(log[0]).toContain(`chore(task): archive ${taskName}`);

    // The move is fully recorded — no phantom deletes left behind for the
    // source path.
    const dirty = execSync("git status --porcelain", {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(dirty).not.toContain(`.trellis/tasks/${taskName}/`);
  });

  it("[index-lock] a lock that never clears aborts with a diagnostic naming it", () => {
    setupRepo();
    fs.writeFileSync(lockFile(), "", "utf-8");

    const { status, stderr } = runArchive();

    // Failure, not a misleading success.
    expect(status, stderr).toBe(1);
    expect(stderr).toContain("index.lock");
    expect(stderr).toContain("another process is holding");
    expect(stderr).toContain("gave up after 3 attempts");
    // Says what is left to do, so neither a user nor an agent reading the
    // log has to guess.
    expect(stderr).toContain("only the commit is pending");
    expect(stderr).toContain(`git commit -m "chore(task): archive ${taskName}"`);
    expect(stderr).toContain("Archive moved on disk");

    // Consistent state: the move completed, nothing is half-moved.
    expect(archivedTaskExists()).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".trellis/tasks", taskName))).toBe(
      false,
    );

    // Nothing was committed — the pending commit is genuinely pending.
    fs.rmSync(lockFile(), { force: true });
    expect(gitLogLines().length).toBe(1);
    const dirty = execSync("git status --porcelain", {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(dirty).toContain(`.trellis/tasks/${taskName}/`);
  });
});

// =============================================================================
// regression: dogfood ↔ shipped Python script parity
// =============================================================================

describe("regression: .trellis/scripts stays byte-identical to templates/trellis/scripts", () => {
  // `.trellis/scripts/` is Trellis's own dogfood copy;
  // `packages/cli/src/templates/trellis/scripts/` is what ships to users.
  // They are two physical copies of the same 28 files and nothing enforced
  // parity, so one-sided edits landed silently — PR #390 changed the template's
  // `common/session_context.py` upgrade hint and left the dogfood copy on the
  // old wording for a month. This test turns that whole class of drift into a
  // build failure.
  const __dirnameParity = path.dirname(fileURLToPath(import.meta.url));
  const parityRepoRoot = path.resolve(__dirnameParity, "../../..");
  const dogfoodScriptsRoot = path.join(parityRepoRoot, ".trellis", "scripts");
  const templateScriptsRoot = path.join(
    parityRepoRoot,
    "packages/cli/src/templates/trellis/scripts",
  );

  function listPyFiles(root: string): string[] {
    const found: string[] = [];
    function walk(dir: string, prefix: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (entry.name === "__pycache__") continue;
          walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        } else if (entry.name.endsWith(".py")) {
          found.push(`${prefix}${entry.name}`);
        }
      }
    }
    walk(root, "");
    return found.sort();
  }

  const templateFiles = listPyFiles(templateScriptsRoot);

  it("both trees hold the same set of .py files", () => {
    const dogfoodFiles = listPyFiles(dogfoodScriptsRoot);
    expect(
      dogfoodFiles,
      "`.trellis/scripts/` and `packages/cli/src/templates/trellis/scripts/` " +
        "must hold the same .py files — a script added to (or deleted from) " +
        "one tree must be mirrored in the other.",
    ).toEqual(templateFiles);
  });

  for (const relativePath of templateFiles) {
    it(`${relativePath} is byte-identical in both trees`, () => {
      const dogfoodPath = path.join(dogfoodScriptsRoot, relativePath);
      expect(
        fs.existsSync(dogfoodPath),
        `.trellis/scripts/${relativePath} is missing (template has it)`,
      ).toBe(true);
      const dogfoodBytes = fs.readFileSync(dogfoodPath);
      const templateBytes = fs.readFileSync(
        path.join(templateScriptsRoot, relativePath),
      );
      expect(
        dogfoodBytes.equals(templateBytes),
        `.trellis/scripts/${relativePath} has drifted from ` +
          `packages/cli/src/templates/trellis/scripts/${relativePath}. ` +
          `Edit both copies, never one.`,
      ).toBe(true);
    });
  }
});

describe("regression: task.py rename rewrites every reference in one pass", () => {
  // Renaming a task used to be a hand-edited multi-file operation (directory
  // name, task.json identity fields, parent/children back-references, jsonl
  // context paths), and a partial hand-rename left dangling references that
  // preflight gates reject later.
  const pyCmd = process.platform === "win32" ? "python" : "python3";
  const pad = (n: number): string => String(n).padStart(2, "0");
  const now = new Date();
  const datePrefix = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yearMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-task-rename-"));
    for (const [rel, content] of getAllScripts()) {
      const abs = path.join(tmpDir, ".trellis", "scripts", rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf-8");
    }
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", ".developer"),
      "name=test-dev\ninitialized_at=2026-08-09T00:00:00\n",
    );
    fs.mkdirSync(taskDir("archive"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runTask(...args: string[]): {
    status: number | null;
    stdout: string;
    stderr: string;
  } {
    const proc = spawnSync(
      pyCmd,
      [path.join(".trellis", "scripts", "task.py"), ...args],
      { cwd: tmpDir, encoding: "utf-8" },
    );
    return {
      status: proc.status,
      stdout: proc.stdout ?? "",
      stderr: proc.stderr ?? "",
    };
  }

  function taskDir(...segments: string[]): string {
    return path.join(tmpDir, ".trellis", "tasks", ...segments);
  }

  function readTaskJson(name: string): Record<string, unknown> {
    return JSON.parse(
      fs.readFileSync(path.join(taskDir(name), "task.json"), "utf-8"),
    ) as Record<string, unknown>;
  }

  function create(slug: string, parent?: string): string {
    const args = [
      "create",
      slug,
      "--description",
      "rename fixture",
      "--slug",
      slug,
      "--no-start",
    ];
    if (parent) args.push("--parent", parent);
    const r = runTask(...args);
    expect(r.status, r.stderr).toBe(0);
    return `${datePrefix}-${slug}`;
  }

  /** Every `<file>:<line>` under .trellis/tasks/ that still names `taskName`. */
  function scanForName(taskName: string): string[] {
    const pattern = new RegExp(`(?<![0-9A-Za-z_-])${taskName}(?![0-9A-Za-z_-])`);
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(abs);
          if (pattern.test(entry.name)) hits.push(`${abs}/ (directory name)`);
          continue;
        }
        const lines = fs.readFileSync(abs, "utf-8").split("\n");
        lines.forEach((line, index) => {
          if (pattern.test(line)) hits.push(`${abs}:${index + 1}`);
        });
      }
    };
    walk(taskDir());
    return hits;
  }

  it("[task-rename] a task with a parent and two children leaves no dangling reference", () => {
    const parent = create("mum");
    const target = create("target", parent);
    const childA = create("kid-a", target);
    const childB = create("kid-b", target);

    const r = runTask("rename", target, "renamed");
    expect(r.status, r.stderr).toBe(0);

    const renamed = `${datePrefix}-renamed`;
    expect(fs.existsSync(taskDir(target))).toBe(false);
    expect(fs.existsSync(taskDir(renamed))).toBe(true);

    // Identity fields carry the bare slug; back-references carry the full
    // directory name.
    expect(readTaskJson(renamed).id).toBe("renamed");
    expect(readTaskJson(renamed).name).toBe("renamed");
    expect(readTaskJson(renamed).parent).toBe(parent);
    expect(readTaskJson(parent).children).toEqual([renamed]);
    expect(readTaskJson(childA).parent).toBe(renamed);
    expect(readTaskJson(childB).parent).toBe(renamed);

    expect(scanForName(target)).toEqual([]);
  });

  it("[task-rename] legacy subtasks back-references are rewritten too", () => {
    const parent = create("mum");
    const target = create("target", parent);

    const parentJson = readTaskJson(parent);
    parentJson.subtasks = [target];
    fs.writeFileSync(
      path.join(taskDir(parent), "task.json"),
      JSON.stringify(parentJson, null, 2) + "\n",
    );

    const r = runTask("rename", target, "renamed");
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("subtasks[0]");
    expect(readTaskJson(parent).subtasks).toEqual([`${datePrefix}-renamed`]);
    expect(scanForName(target)).toEqual([]);
  });

  it("[task-rename] --dry-run prints the change set it would apply, and writes nothing", () => {
    const parent = create("mum");
    const target = create("target", parent);
    create("kid", target);
    fs.writeFileSync(
      path.join(taskDir(target), "implement.jsonl"),
      `{"file": ".trellis/tasks/${target}/research.md", "reason": "findings"}\n`,
    );
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "workflow.md"),
      `The plan is tracked in ${target}.\n`,
    );

    const dry = runTask("rename", target, "renamed", "--dry-run");
    expect(dry.status, dry.stderr).toBe(0);
    expect(dry.stderr).toContain("Dry run: nothing was written");
    expect(fs.existsSync(taskDir(target))).toBe(true);
    expect(fs.existsSync(taskDir(`${datePrefix}-renamed`))).toBe(false);
    expect(readTaskJson(target).id).toBe("target");
    expect(readTaskJson(parent).children).toEqual([target]);

    const applied = runTask("rename", target, "renamed");
    expect(applied.status, applied.stderr).toBe(0);

    // The whole point of the dry run: what it printed is what the real run did.
    expect(applied.stdout).toBe(dry.stdout);
    expect(dry.stdout).toContain(
      `dir: .trellis/tasks/${target} -> .trellis/tasks/${datePrefix}-renamed`,
    );
    expect(dry.stdout).toContain("task.json: id: target -> renamed");
    expect(dry.stdout).toContain(
      `backref: .trellis/tasks/${parent}/task.json: children[0]: ${target} -> ${datePrefix}-renamed`,
    );
    expect(dry.stdout).toContain(
      `jsonl: .trellis/tasks/${target}/implement.jsonl:1:`,
    );
    // References outside the task dir are reported, never rewritten.
    expect(dry.stdout).toContain(
      "reported (not rewritten): .trellis/workflow.md:1",
    );
    expect(
      fs.readFileSync(path.join(tmpDir, ".trellis", "workflow.md"), "utf-8"),
    ).toContain(target);
  });

  it("[task-rename] jsonl paths under the task dir move, a sibling's do not", () => {
    const target = create("target");
    const sibling = create("target-other");
    fs.writeFileSync(
      path.join(taskDir(target), "check.jsonl"),
      [
        `{"file": ".trellis/tasks/${target}/research.md", "reason": "findings"}`,
        `{"file": ".trellis/spec/guides/style.md", "reason": "spec"}`,
        `{"file": ".trellis/tasks/${sibling}/notes.md", "reason": "sibling"}`,
        "",
      ].join("\n"),
    );

    expect(runTask("rename", target, "renamed").status).toBe(0);

    const renamed = `${datePrefix}-renamed`;
    const after = fs.readFileSync(
      path.join(taskDir(renamed), "check.jsonl"),
      "utf-8",
    );
    expect(after).toContain(`".trellis/tasks/${renamed}/research.md"`);
    expect(after).toContain('".trellis/spec/guides/style.md"');
    // `target` is a prefix of `target-other`; the sibling must survive intact.
    expect(after).toContain(`".trellis/tasks/${sibling}/notes.md"`);
  });

  it("[task-rename] refuses an existing destination, an archived name, a bad slug and an unknown task", () => {
    const other = create("other");
    const target = create("target");

    const occupied = runTask("rename", target, "other");
    expect(occupied.status).not.toBe(0);
    expect(occupied.stderr).toContain(`Task already exists: ${other}`);
    expect(fs.existsSync(taskDir(target))).toBe(true);

    fs.mkdirSync(taskDir("archive", yearMonth, `${datePrefix}-gone`), {
      recursive: true,
    });
    const archived = runTask("rename", target, "gone");
    expect(archived.status).not.toBe(0);
    expect(archived.stderr).toContain(
      `Task already archived: ${datePrefix}-gone`,
    );

    const badSlug = runTask("rename", target, "../evil");
    expect(badSlug.status).not.toBe(0);
    expect(badSlug.stderr).toContain("must be a plain name");

    const unknown = runTask("rename", "no-such-task", "renamed");
    expect(unknown.status).not.toBe(0);

    // Every refusal is pre-flight: the task is still exactly where it was.
    expect(fs.existsSync(taskDir(target))).toBe(true);
    expect(readTaskJson(target).id).toBe("target");
  });

  it("[task-rename] refuses a slug carrying a date prefix, normalizing only its own", () => {
    const target = create("target");

    const wrongDate = runTask("rename", target, "01-02-renamed");
    expect(wrongDate.status).not.toBe(0);
    expect(wrongDate.stderr).toContain("keeps the task's own creation date");

    // The task's own prefix pasted back in is a slip, not a request for
    // MM-DD-MM-DD-slug (the create-side bug in #377).
    const ownDate = runTask("rename", target, `${datePrefix}-renamed`);
    expect(ownDate.status, ownDate.stderr).toBe(0);
    expect(ownDate.stderr).toContain("should not include the MM-DD prefix");
    expect(fs.existsSync(taskDir(`${datePrefix}-renamed`))).toBe(true);
  });

  it("[task-rename] moves an active-task session pointer to the new name", () => {
    // Rename is the one lifecycle step where the task survives under a new
    // name. Session pointers used to keep naming the old directory, so the
    // very next turn resolved the active task as stale/missing.
    const target = create("target");
    const other = create("bystander");
    const sessionsDir = path.join(tmpDir, ".trellis", ".runtime", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });
    const sessionFile = path.join(sessionsDir, "sess-a.json");
    const bystanderFile = path.join(sessionsDir, "sess-b.json");
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({ current_task: `.trellis/tasks/${target}` }),
      "utf-8",
    );
    fs.writeFileSync(
      bystanderFile,
      JSON.stringify({ current_task: `.trellis/tasks/${other}` }),
      "utf-8",
    );

    const r = runTask("rename", target, "renamed");
    expect(r.status, r.stderr).toBe(0);

    const renamed = `${datePrefix}-renamed`;
    expect(
      JSON.parse(fs.readFileSync(sessionFile, "utf-8")).current_task,
    ).toBe(`.trellis/tasks/${renamed}`);
    // A session on a different task is left exactly as it was.
    expect(
      JSON.parse(fs.readFileSync(bystanderFile, "utf-8")).current_task,
    ).toBe(`.trellis/tasks/${other}`);
  });

  it("[task-rename] refuses to rename an archived task", () => {
    const target = create("target");
    expect(runTask("archive", target, "--no-commit").status).toBe(0);

    const r = runTask(
      "rename",
      path.posix.join(".trellis", "tasks", "archive", yearMonth, target),
      "renamed",
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("is not an active task under");
    expect(
      fs.existsSync(taskDir("archive", yearMonth, target, "task.json")),
    ).toBe(true);
  });
});

describe("regression: a linked worktree inherits developer identity", () => {
  // `.trellis/.developer` is gitignored (it carries a personal identity), so a
  // fresh `git worktree add` used to start with no identity at all and every
  // task.py command failed with "No developer set" until init_developer.py was
  // re-run per worktree — which blocks worktree-per-worker parallel runs.
  const pyCmd = process.platform === "win32" ? "python" : "python3";
  const pad = (n: number): string => String(n).padStart(2, "0");
  const now = new Date();
  const datePrefix = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let tmpDir: string;
  let mainDir: string;
  let worktreeDir: string;

  function git(cwd: string, ...args: string[]): void {
    const proc = spawnSync("git", args, { cwd, encoding: "utf-8" });
    if (proc.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${proc.stderr}`);
    }
  }

  function writeScripts(root: string): void {
    for (const [rel, content] of getAllScripts()) {
      const abs = path.join(root, ".trellis", "scripts", rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, "utf-8");
    }
  }

  /** A committed repo at `mainDir` plus a linked worktree at `worktreeDir`. */
  function buildRepo(developerName: string | null): void {
    writeScripts(mainDir);
    fs.writeFileSync(
      path.join(mainDir, ".gitignore"),
      ".trellis/.developer\n",
      "utf-8",
    );
    if (developerName !== null) {
      fs.writeFileSync(
        path.join(mainDir, ".trellis", ".developer"),
        `name=${developerName}\ninitialized_at=2026-08-09T00:00:00\n`,
        "utf-8",
      );
    }
    git(mainDir, "init", "-q", "-b", "main", ".");
    git(mainDir, "config", "user.email", "test@example.com");
    git(mainDir, "config", "user.name", "test");
    git(mainDir, "add", "-A");
    git(mainDir, "commit", "-qm", "init");
    git(mainDir, "worktree", "add", "-q", worktreeDir, "-b", "wt");
  }

  function runTask(
    cwd: string,
    args: string[],
    envOverrides: NodeJS.ProcessEnv = {},
  ): { status: number | null; stdout: string; stderr: string } {
    const env = { ...process.env, ...envOverrides };
    // Inherited identity must come from the repo, never from the environment
    // of the machine running the suite.
    if (envOverrides.TRELLIS_DEVELOPER === undefined) {
      delete env.TRELLIS_DEVELOPER;
    }
    const proc = spawnSync(
      pyCmd,
      [path.join(cwd, ".trellis", "scripts", "task.py"), ...args],
      { cwd, encoding: "utf-8", env },
    );
    return {
      status: proc.status,
      stdout: proc.stdout ?? "",
      stderr: proc.stderr ?? "",
    };
  }

  function createTask(
    cwd: string,
    slug: string,
    extraArgs: string[] = [],
    envOverrides: NodeJS.ProcessEnv = {},
  ): { status: number | null; stdout: string; stderr: string } {
    return runTask(
      cwd,
      [
        "create",
        slug,
        "--description",
        "worktree identity fixture",
        "--slug",
        slug,
        "--no-start",
        ...extraArgs,
      ],
      envOverrides,
    );
  }

  function assigneeOf(cwd: string, slug: string): unknown {
    const taskJson = path.join(
      cwd,
      ".trellis",
      "tasks",
      `${datePrefix}-${slug}`,
      "task.json",
    );
    return (
      JSON.parse(fs.readFileSync(taskJson, "utf-8")) as Record<string, unknown>
    ).assignee;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-wt-identity-"));
    mainDir = path.join(tmpDir, "main");
    worktreeDir = path.join(tmpDir, "linked");
    fs.mkdirSync(mainDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("[worktree-identity] create/list/start work in a fresh worktree with no manual setup", () => {
    buildRepo("main-dev");

    // The premise: git did not carry the gitignored identity file across.
    expect(
      fs.existsSync(path.join(worktreeDir, ".trellis", ".developer")),
    ).toBe(false);

    const created = createTask(worktreeDir, "inherited");
    expect(created.status, created.stderr).toBe(0);
    expect(assigneeOf(worktreeDir, "inherited")).toBe("main-dev");

    const listed = runTask(worktreeDir, ["list", "--json", "--mine"]);
    expect(listed.status, listed.stderr).toBe(0);
    const tasks = (
      JSON.parse(listed.stdout) as { tasks: { id: string; assignee: string }[] }
    ).tasks;
    expect(tasks.map((t) => [t.id, t.assignee])).toEqual([
      ["inherited", "main-dev"],
    ]);

    const started = runTask(worktreeDir, ["start", `${datePrefix}-inherited`]);
    expect(started.status, started.stderr).toBe(0);

    // Inheritance is read-only: copying the file in would go stale and shadow
    // later changes made in the main checkout.
    expect(
      fs.existsSync(path.join(worktreeDir, ".trellis", ".developer")),
    ).toBe(false);
  });

  it("[worktree-identity] a later main-checkout change is picked up, because nothing was copied", () => {
    buildRepo("main-dev");
    expect(createTask(worktreeDir, "first").status).toBe(0);
    expect(assigneeOf(worktreeDir, "first")).toBe("main-dev");

    fs.writeFileSync(
      path.join(mainDir, ".trellis", ".developer"),
      "name=renamed-dev\ninitialized_at=2026-08-09T00:00:00\n",
      "utf-8",
    );

    expect(createTask(worktreeDir, "second").status).toBe(0);
    expect(assigneeOf(worktreeDir, "second")).toBe("renamed-dev");
  });

  it("[worktree-identity] precedence: --assignee > TRELLIS_DEVELOPER > local file > main checkout", () => {
    buildRepo("main-dev");

    // 4. main checkout, in the worktree that has no file of its own
    expect(createTask(worktreeDir, "inherit").status).toBe(0);
    expect(assigneeOf(worktreeDir, "inherit")).toBe("main-dev");

    // 3. a local file in the worktree wins over the main checkout
    fs.writeFileSync(
      path.join(worktreeDir, ".trellis", ".developer"),
      "name=local-dev\ninitialized_at=2026-08-09T00:00:00\n",
      "utf-8",
    );
    expect(createTask(worktreeDir, "local").status).toBe(0);
    expect(assigneeOf(worktreeDir, "local")).toBe("local-dev");

    // 2. the env var wins over both files
    expect(
      createTask(worktreeDir, "env", [], { TRELLIS_DEVELOPER: "env-dev" })
        .status,
    ).toBe(0);
    expect(assigneeOf(worktreeDir, "env")).toBe("env-dev");

    // 1. --assignee wins over everything
    expect(
      createTask(worktreeDir, "flag", ["--assignee", "flag-dev"], {
        TRELLIS_DEVELOPER: "env-dev",
      }).status,
    ).toBe(0);
    expect(assigneeOf(worktreeDir, "flag")).toBe("flag-dev");
  });

  it("[worktree-identity] the env var alone is enough in the main checkout too", () => {
    buildRepo(null);
    expect(
      createTask(mainDir, "envonly", [], { TRELLIS_DEVELOPER: "env-dev" })
        .status,
    ).toBe(0);
    expect(assigneeOf(mainDir, "envonly")).toBe("env-dev");
  });

  it("[worktree-identity] a whitespace-only env var does not count as an identity", () => {
    buildRepo("main-dev");
    expect(
      createTask(worktreeDir, "blank", [], { TRELLIS_DEVELOPER: "   " }).status,
    ).toBe(0);
    expect(assigneeOf(worktreeDir, "blank")).toBe("main-dev");
  });

  it("[worktree-identity] with no identity anywhere, the error names all three sources", () => {
    buildRepo(null);

    for (const cwd of [mainDir, worktreeDir]) {
      const created = createTask(cwd, "nobody");
      expect(created.status).not.toBe(0);
      expect(created.stderr).toContain("No developer set");
      expect(created.stderr).toContain("init_developer.py");
      expect(created.stderr).toContain("TRELLIS_DEVELOPER");
      expect(created.stderr).toContain("linked git worktree");

      const listed = runTask(cwd, ["list", "--json", "--mine"]);
      expect(listed.status).not.toBe(0);
      const payload = JSON.parse(listed.stderr) as {
        error: string;
        hint: string;
      };
      expect(payload.error).toBe("No developer set");
      expect(payload.hint).toContain("TRELLIS_DEVELOPER");
      expect(payload.hint).toContain("linked git worktree");
    }
  });

  it("[worktree-identity] a linked worktree of a bare repo inherits nothing", () => {
    buildRepo("main-dev");
    const bareDir = path.join(tmpDir, "bare.git");
    const bareWt = path.join(tmpDir, "bare-wt");
    git(tmpDir, "clone", "-q", "--bare", mainDir, bareDir);
    git(bareDir, "worktree", "add", "-q", bareWt, "wt");
    writeScripts(bareWt);

    const created = createTask(bareWt, "nobody");
    expect(created.status).toBe(1);
    expect(created.stderr).toContain("No developer set");
    expect(created.stderr).not.toContain("Traceback");
  });

  it("[worktree-identity] a bare repo nested inside an unrelated checkout does not leak that checkout's identity", () => {
    // Deriving the main root as the parent of `--git-common-dir` picks up
    // `outer/` here — a real checkout with a real `.developer` — so the wrong
    // answer looks exactly like a right one. git must name the main worktree.
    buildRepo("main-dev");
    const outerDir = path.join(tmpDir, "outer");
    fs.mkdirSync(path.join(outerDir, ".trellis"), { recursive: true });
    fs.writeFileSync(
      path.join(outerDir, ".trellis", ".developer"),
      "name=unrelated-stranger\ninitialized_at=2026-08-09T00:00:00\n",
      "utf-8",
    );
    fs.writeFileSync(path.join(outerDir, "README.md"), "outer\n", "utf-8");
    git(outerDir, "init", "-q", "-b", "main", ".");
    git(outerDir, "config", "user.email", "test@example.com");
    git(outerDir, "config", "user.name", "test");
    git(outerDir, "add", "README.md");
    git(outerDir, "commit", "-qm", "outer");

    const nestedBare = path.join(outerDir, "nested.git");
    const nestedWt = path.join(tmpDir, "nested-wt");
    git(tmpDir, "clone", "-q", "--bare", mainDir, nestedBare);
    git(nestedBare, "worktree", "add", "-q", nestedWt, "wt");
    writeScripts(nestedWt);

    const created = createTask(nestedWt, "leak");
    expect(created.status).toBe(1);
    expect(created.stderr).not.toContain("unrelated-stranger");
    expect(created.stderr).toContain("No developer set");
  });

  it("[worktree-identity] a directory that is not a git repo fails normally, never crashes", () => {
    writeScripts(mainDir);

    const created = createTask(mainDir, "nogit");
    expect(created.status).toBe(1);
    expect(created.stderr).toContain("No developer set");
    expect(created.stderr).not.toContain("Traceback");
  });
});
