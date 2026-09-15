/**
 * Integration tests for the uninstall() command.
 *
 * Each test runs init() in a fresh tmpdir, then exercises uninstall under
 * different flag combinations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import inquirer from "inquirer";

vi.mock("figlet", () => ({
  default: { textSync: vi.fn(() => "TRELLIS") },
}));

vi.mock("inquirer", () => ({
  default: { prompt: vi.fn() },
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
import { uninstall } from "../../src/commands/uninstall.js";
import { DIR_NAMES } from "../../src/constants/paths.js";
import { loadHashes } from "../../src/utils/template-hash.js";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

describe("uninstall() integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-uninstall-int-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(noop);
    vi.spyOn(console, "error").mockImplementation(noop);
    // Default: confirm = yes for all prompts.
    vi.mocked(inquirer.prompt).mockResolvedValue({ proceed: true });
    // Force prompt path (treat stdin as TTY in test env).
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("#1 friendly exit when .trellis/ is missing", async () => {
    // No init — tmpDir is empty.
    await uninstall({ yes: true });
    // Nothing was created or deleted; tmpDir should still be empty.
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it("#2 errors when manifest is missing but .trellis/ exists", async () => {
    fs.mkdirSync(path.join(tmpDir, DIR_NAMES.WORKFLOW));
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code ?? 0})`);
      }) as never);

    await expect(uninstall({ yes: true })).rejects.toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("#3 init → uninstall → project is clean", async () => {
    await init({ yes: true, kerminal: true, force: true });

    // Sanity: init wrote things.
    expect(fs.existsSync(path.join(tmpDir, ".trellis"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".kerminal"))).toBe(true);

    const hashesBefore = loadHashes(tmpDir);
    expect(Object.keys(hashesBefore).length).toBeGreaterThan(0);

    await uninstall({ yes: true });

    // .trellis/ should be gone.
    expect(fs.existsSync(path.join(tmpDir, ".trellis"))).toBe(false);

    // Every opaque manifest path (non-structured files) should be gone.
    // Structured config files (settings.json/hooks.json/config.toml/
    // package.json) may legitimately remain when the trellis template
    // shipped non-trellis fields too (e.g. .claude/settings.json's `env`
    // and `enabledPlugins`). Such residuals are scrubbed but kept on
    // disk per the PRD ("settings.json 剥离后若仅剩空 hooks 对象 → 文件被删除；
    // 否则保留").
    const STRUCTURED_TAILS = [
      "/settings.json",
      "/hooks.json",
      "/config.toml",
      "/package.json",
    ];
    const stillPresentOpaque = Object.keys(hashesBefore).filter((p) => {
      const isStructured = STRUCTURED_TAILS.some((tail) => p.endsWith(tail));
      if (isStructured) return false;
      return fs.existsSync(path.join(tmpDir, ...p.split("/")));
    });
    expect(stillPresentOpaque).toEqual([]);

    // Any structured file that remains must have been scrubbed: it must NOT
    // contain any references to the deleted manifest paths.
    for (const p of Object.keys(hashesBefore)) {
      const isStructured = STRUCTURED_TAILS.some((tail) => p.endsWith(tail));
      if (!isStructured) continue;
      const abs = path.join(tmpDir, ...p.split("/"));
      if (!fs.existsSync(abs)) continue;
      const text = fs.readFileSync(abs, "utf-8");
      for (const otherPath of Object.keys(hashesBefore)) {
        if (otherPath === p) continue;
        if (STRUCTURED_TAILS.some((tail) => otherPath.endsWith(tail))) continue;
        // The deleted file should not be referenced any more.
        expect(text).not.toContain(otherPath);
      }
    }
  });

  it("#4 dry-run does not modify anything", async () => {
    await init({ yes: true, kerminal: true, force: true });

    // Snapshot file tree contents.
    const snapshot: Record<string, string> = {};
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else snapshot[full] = fs.readFileSync(full, "utf-8");
      }
    }
    walk(tmpDir);

    await uninstall({ dryRun: true });

    // No files changed.
    for (const [p, content] of Object.entries(snapshot)) {
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.readFileSync(p, "utf-8")).toBe(content);
    }
    // Inquirer not prompted.
    expect(inquirer.prompt).not.toHaveBeenCalled();
  });

  it("#5 user input 'no' aborts without modification", async () => {
    await init({ yes: true, kerminal: true, force: true });
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ proceed: false });

    await uninstall({});

    expect(fs.existsSync(path.join(tmpDir, ".trellis"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".kerminal"))).toBe(true);
  });

  it("#6 user-modified trellis file is still deleted (manifest defines scope)", async () => {
    await init({ yes: true, kerminal: true, force: true });

    // Pick any manifest-tracked file under .kerminal/ and overwrite it.
    const hashesBefore = loadHashes(tmpDir);
    const cursorTrackedPath = Object.keys(hashesBefore).find((p) =>
      p.startsWith(".kerminal/"),
    );
    if (!cursorTrackedPath) {
      throw new Error(
        "Test fixture: expected at least one .kerminal/ entry in manifest",
      );
    }
    const abs = path.join(tmpDir, ...cursorTrackedPath.split("/"));
    fs.writeFileSync(abs, "USER MODIFIED CONTENT\n");

    await uninstall({ yes: true });

    expect(fs.existsSync(abs)).toBe(false);
  });

  it("#7 user-added file in a managed dir is NOT deleted", async () => {
    await init({ yes: true, kerminal: true, force: true });

    // Drop a user file into .kerminal/skills/ that the manifest doesn't
    // track.
    const userHookDir = path.join(tmpDir, ".kerminal", "skills");
    fs.mkdirSync(userHookDir, { recursive: true });
    const userHook = path.join(userHookDir, "user-custom");
    fs.writeFileSync(userHook, "# user content\n");

    await uninstall({ yes: true });

    expect(fs.existsSync(userHook)).toBe(true);
    // The cleanup function only removes empty dirs, so .kerminal/skills/
    // must still exist (since user-custom lives there) and .kerminal/ too.
    expect(fs.existsSync(userHookDir)).toBe(true);
  });

  it("#8a empty managed sub-dirs and root dir are pruned (kerminal: no structured config)", async () => {
    // Kerminal has no hooks.json/settings.json/config.toml/package.json —
    // every manifest file is opaque and gets deleted, so the entire
    // .kerminal/ tree should disappear, demonstrating both nested-subdir
    // cleanup and empty-platform-root cleanup.
    await init({ yes: true, kerminal: true, force: true });

    // Detect kerminal's actual config dir from manifest entries.
    const hashesBefore = loadHashes(tmpDir);
    const kiloEntry = Object.keys(hashesBefore).find(
      (p) => !p.startsWith(".trellis/") && p !== "AGENTS.md",
    );
    if (!kiloEntry) throw new Error("test fixture: no kerminal entries found");
    const kiloRoot = kiloEntry.split("/")[0];
    expect(fs.existsSync(path.join(tmpDir, kiloRoot))).toBe(true);

    await uninstall({ yes: true });

    // Empty platform root dir should be removed.
    expect(fs.existsSync(path.join(tmpDir, kiloRoot))).toBe(false);
  });
});
