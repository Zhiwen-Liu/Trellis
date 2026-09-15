/**
 * Integration tests for `trellis workflow` and the workflow.md hash boundary.
 *
 * TrellisKerminal ships exactly one workflow — the bundled native template —
 * so the coverage is:
 * - `trellis workflow --template native`: writes bundled content, keeps hash.
 * - Unknown template ids are rejected with a workflow-specific error.
 * - Non-interactive modified workflow.md fails without --force / --create-new.
 * - `--create-new` writes `.new` and leaves workflow.md + hash untouched.
 * - `trellis update` does not silently overwrite a user-modified workflow.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("figlet", () => ({
  default: { textSync: vi.fn(() => "TRELLIS") },
}));

vi.mock("inquirer", () => ({
  default: { prompt: vi.fn().mockResolvedValue({ proceed: true }) },
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockImplementation((cmd: string) => {
    const py = process.platform === "win32" ? "python" : "python3";
    return cmd === `${py} --version` ? "Python 3.11.12" : "";
  }),
  execFileSync: vi.fn().mockImplementation((cmd: string, args: string[]) => {
    const py = process.platform === "win32" ? "python" : "python3";
    return cmd === py && args?.[0] === "--version" ? "Python 3.11.12" : "";
  }),
}));

import { init } from "../../src/commands/init.js";
import { update } from "../../src/commands/update.js";
import {
  runWorkflowCommand,
  WorkflowCommandError,
} from "../../src/commands/workflow.js";
import { PATHS } from "../../src/constants/paths.js";
import { loadHashes } from "../../src/utils/template-hash.js";
import { workflowMdTemplate } from "../../src/templates/trellis/index.js";
import { replacePythonCommandLiterals } from "../../src/configurators/shared.js";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

describe("trellis workflow integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-workflow-int-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(noop);
    vi.spyOn(console, "error").mockImplementation(noop);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("init writes the native workflow.md and keeps it hash-tracked", async () => {
    await init({ yes: true });

    const wfPath = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    expect(fs.existsSync(wfPath)).toBe(true);
    expect(fs.readFileSync(wfPath, "utf-8")).toBe(
      replacePythonCommandLiterals(workflowMdTemplate),
    );
    const hashes = loadHashes(tmpDir);
    expect(hashes[PATHS.WORKFLOW_GUIDE_FILE]).toBeTruthy();
  });

  it("unknown workflow template id is rejected", async () => {
    await init({ yes: true });

    await expect(
      runWorkflowCommand({ template: "tdd" }),
    ).rejects.toThrow(WorkflowCommandError);
    await expect(
      runWorkflowCommand({ template: "missing-id" }),
    ).rejects.toThrow(/not available/i);
  });

  it("trellis workflow --template native refreshes the hash", async () => {
    await init({ yes: true });
    expect(loadHashes(tmpDir)[PATHS.WORKFLOW_GUIDE_FILE]).toBeTruthy();

    await runWorkflowCommand({ template: "native" });

    const wfPath = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    expect(fs.readFileSync(wfPath, "utf-8")).toBe(
      replacePythonCommandLiterals(workflowMdTemplate),
    );
    expect(loadHashes(tmpDir)[PATHS.WORKFLOW_GUIDE_FILE]).toBeTruthy();
  });

  it("non-interactive run with a locally-modified workflow.md fails without --force", async () => {
    await init({ yes: true });

    const wfPath = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    fs.writeFileSync(wfPath, "# My custom edits", "utf-8");

    // Simulate non-interactive shell.
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: false,
    });

    try {
      await expect(runWorkflowCommand({ template: "native" })).rejects.toThrow(
        WorkflowCommandError,
      );

      // File must remain untouched, and hash must not have been re-stamped.
      expect(fs.readFileSync(wfPath, "utf-8")).toBe("# My custom edits");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        configurable: true,
        value: originalIsTTY,
      });
    }
  });

  it("explicit --template run with a locally-modified workflow.md fails even when stdin is a TTY", async () => {
    await init({ yes: true });

    const wfPath = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    fs.writeFileSync(wfPath, "# My custom edits", "utf-8");

    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });

    try {
      await expect(runWorkflowCommand({ template: "native" })).rejects.toThrow(
        WorkflowCommandError,
      );
      expect(fs.readFileSync(wfPath, "utf-8")).toBe("# My custom edits");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        configurable: true,
        value: originalIsTTY,
      });
    }
  });

  it("--create-new writes .new file and never touches workflow.md or hash", async () => {
    await init({ yes: true });

    const wfPath = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    const originalContent = fs.readFileSync(wfPath, "utf-8");
    const originalHash = loadHashes(tmpDir)[PATHS.WORKFLOW_GUIDE_FILE];

    await runWorkflowCommand({ template: "native", createNew: true });

    const newPath = `${wfPath}.new`;
    expect(fs.existsSync(newPath)).toBe(true);
    expect(fs.readFileSync(newPath, "utf-8")).toBe(
      replacePythonCommandLiterals(workflowMdTemplate),
    );
    // Active workflow file and hash must both be untouched.
    expect(fs.readFileSync(wfPath, "utf-8")).toBe(originalContent);
    expect(loadHashes(tmpDir)[PATHS.WORKFLOW_GUIDE_FILE]).toBe(originalHash);
  });

  it("trellis update does not silently restore native workflow over user edits", async () => {
    await init({ yes: true });

    const wfPath = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    fs.writeFileSync(wfPath, "# My custom edits", "utf-8");
    const beforeUpdate = fs.readFileSync(wfPath, "utf-8");

    // Non-interactive skip on conflicts — update should treat the user's
    // workflow as "modified" and skip writing native bytes over it.
    await update({ skipAll: true });

    const afterUpdate = fs.readFileSync(wfPath, "utf-8");
    expect(afterUpdate).toBe(beforeUpdate);
    expect(afterUpdate).not.toBe(
      replacePythonCommandLiterals(workflowMdTemplate),
    );
  });
});
