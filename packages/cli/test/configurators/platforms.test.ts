import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  getConfiguredPlatforms,
  configurePlatform,
  collectPlatformTemplates,
  PLATFORM_IDS,
} from "../../src/configurators/index.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";
import { setWriteMode, startRecordingWrites, stopRecordingWrites } from "../../src/utils/file-writer.js";
import { initializeHashes } from "../../src/utils/template-hash.js";
import {
  replacePythonCommandLiterals,
  setResolvedPythonCommand,
  resetResolvedPythonCommand,
} from "../../src/configurators/shared.js";

// =============================================================================
// configure ⟷ collectTemplates parity oracle
//
// `collectTemplates` is the single description of a platform's file set;
// `configure` writes it. Both directions must hold, and only the forward one
// ("every collected file is on disk") used to be asserted — which is how
// 0.5.5 shipped `.agents/skills/trellis-start/SKILL.md` from `configureCodex`
// with no matching `collectTemplates` entry, leaving upgraders without the
// file after `trellis update` (see manifests/0.5.7.json).
// =============================================================================

/** Every file under `root`, as POSIX paths relative to `root`. */
function walkFiles(root: string, rel = ""): string[] {
  const found: string[] = [];
  const absDir = rel ? path.join(root, ...rel.split("/")) : root;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const relEntry = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...walkFiles(root, relEntry));
    } else {
      found.push(relEntry);
    }
  }
  return found;
}

/** Directories under `root` with no file anywhere beneath them. */
function walkEmptyDirs(root: string, rel = ""): string[] {
  const found: string[] = [];
  const absDir = rel ? path.join(root, ...rel.split("/")) : root;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relEntry = rel ? `${rel}/${entry.name}` : entry.name;
    if (walkFiles(root, relEntry).length === 0) {
      found.push(relEntry);
    } else {
      found.push(...walkEmptyDirs(root, relEntry));
    }
  }
  return found;
}

function readConfiguredFile(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf-8");
}

/** Snapshot every file under `root` as path → content. */
function snapshotDir(root: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const relPath of walkFiles(root)) {
    snapshot.set(relPath, readConfiguredFile(root, relPath));
  }
  return snapshot;
}

// =============================================================================
// getConfiguredPlatforms — detects Trellis-owned platform files
// =============================================================================

describe("getConfiguredPlatforms", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-platforms-"));
    setWriteMode("force");
  });

  afterEach(() => {
    stopRecordingWrites();
    setWriteMode("ask");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty set when no platform dirs exist", () => {
    const result = getConfiguredPlatforms(tmpDir);
    expect(result.size).toBe(0);
  });

  it("does not treat native platform directories as Trellis installations", () => {
    for (const id of PLATFORM_IDS) {
      fs.mkdirSync(path.join(tmpDir, AI_TOOLS[id].configDir), {
        recursive: true,
      });
    }

    expect([...getConfiguredPlatforms(tmpDir)]).toEqual([]);
  });

  it("detects every platform from the files Trellis tracked for it", async () => {
    for (const id of PLATFORM_IDS) {
      const platformRoot = path.join(tmpDir, id);
      fs.mkdirSync(platformRoot, { recursive: true });
      const written = startRecordingWrites(platformRoot);
      try {
        await configurePlatform(id, platformRoot);
      } finally {
        stopRecordingWrites();
      }
      fs.mkdirSync(path.join(platformRoot, ".trellis"), { recursive: true });
      initializeHashes(platformRoot, { trackedPaths: written });

      expect([...getConfiguredPlatforms(platformRoot)]).toEqual([id]);
    }
  });

  it("ignores unrelated directories", () => {
    fs.mkdirSync(path.join(tmpDir, ".vscode"));
    fs.mkdirSync(path.join(tmpDir, ".git"));
    const result = getConfiguredPlatforms(tmpDir);
    expect(result.size).toBe(0);
  });
});

// =============================================================================
// configurePlatform — copies templates to target directory
// =============================================================================

describe("configurePlatform", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-configure-"));
    // Use force mode to avoid interactive prompts
    setWriteMode("force");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    setWriteMode("ask");
  });

  it("configurePlatform('kerminal') creates .kerminal and .agents/skills", async () => {
    await configurePlatform("kerminal", tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".kerminal"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".kerminal", "KERMINAL.md"))).toBe(
      true,
    );
    expect(
      fs.existsSync(
        path.join(tmpDir, ".kerminal", "skills", "trellis-start", "SKILL.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".agents", "skills", "trellis-meta")),
    ).toBe(true);
  });

  it("configurePlatform writes collected templates byte-for-byte for every platform", async () => {
    for (const id of PLATFORM_IDS) {
      const platformDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `trellis-parity-${id}-`),
      );
      try {
        await configurePlatform(id, platformDir);
        const templates = collectPlatformTemplates(id);
        expect(
          templates,
          `${id} should expose template tracking`,
        ).toBeInstanceOf(Map);
        if (!templates) {
          throw new Error(`${id} did not expose template tracking`);
        }

        for (const [relativePath, expectedContent] of templates) {
          const targetPath = path.join(platformDir, ...relativePath.split("/"));
          expect(
            fs.existsSync(targetPath),
            `${id} should write ${relativePath}`,
          ).toBe(true);
          expect(readConfiguredFile(platformDir, relativePath)).toBe(
            expectedContent,
          );
        }
      } finally {
        fs.rmSync(platformDir, { recursive: true, force: true });
      }
    }
  });

  it("configurePlatform writes no file collectTemplates does not describe, for every platform", async () => {
    // The reverse of the assertion above. Without it, "configure writes a file
    // collectTemplates forgot" passes the suite silently — the exact failure
    // mode that shipped in 0.5.5 (codex trellis-start).
    for (const id of PLATFORM_IDS) {
      const platformDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `trellis-reverse-${id}-`),
      );
      try {
        await configurePlatform(id, platformDir);
        const templates = collectPlatformTemplates(id);
        if (!templates) {
          throw new Error(`${id} did not expose template tracking`);
        }

        const undescribed = walkFiles(platformDir).filter(
          (relPath) => !templates.has(relPath),
        );
        expect(
          undescribed,
          `${id} wrote files that collectTemplates does not describe`,
        ).toEqual([]);

        expect(
          walkEmptyDirs(platformDir),
          `${id} created empty directories`,
        ).toEqual([]);

        // Idempotency: init runs configure, update runs collectTemplates, and
        // re-running init must not accumulate or rewrite anything.
        const first = snapshotDir(platformDir);
        await configurePlatform(id, platformDir);
        expect(snapshotDir(platformDir), `${id} is not idempotent`).toEqual(
          first,
        );
      } finally {
        fs.rmSync(platformDir, { recursive: true, force: true });
      }
    }
  });

  it("configurePlatform and collectTemplates agree under Windows python rendering", async () => {
    // `collectPlatformTemplates` rewrites python3 → python for the whole map in
    // one place; `configure` has to reach the same bytes. A site that writes
    // raw content is invisible on macOS/Linux, where the rewrite is a no-op.
    setResolvedPythonCommand("python");
    try {
      for (const id of PLATFORM_IDS) {
        const platformDir = fs.mkdtempSync(
          path.join(os.tmpdir(), `trellis-win-${id}-`),
        );
        try {
          await configurePlatform(id, platformDir);
          const templates = collectPlatformTemplates(id);
          if (!templates) {
            throw new Error(`${id} did not expose template tracking`);
          }

          const onDisk = walkFiles(platformDir);
          expect(
            onDisk.filter((relPath) => !templates.has(relPath)),
            `${id} wrote undescribed files under Windows rendering`,
          ).toEqual([]);

          for (const [relativePath, expectedContent] of templates) {
            expect(
              onDisk.includes(relativePath),
              `${id} should write ${relativePath}`,
            ).toBe(true);
            expect(
              readConfiguredFile(platformDir, relativePath),
              `${id}: ${relativePath} differs under Windows rendering`,
            ).toBe(expectedContent);
          }
        } finally {
          fs.rmSync(platformDir, { recursive: true, force: true });
        }
      }
    } finally {
      resetResolvedPythonCommand();
    }
  });

  it("does not throw for any platform", async () => {
    for (const id of PLATFORM_IDS) {
      const platformDir = fs.mkdtempSync(
        path.join(os.tmpdir(), `trellis-cfg-${id}-`),
      );
      try {
        setWriteMode("force");
        await expect(configurePlatform(id, platformDir)).resolves.not.toThrow();
      } finally {
        fs.rmSync(platformDir, { recursive: true, force: true });
      }
    }
  });

  it("collectPlatformTemplates('kerminal') renders placeholders and matches the guide", async () => {
    const templates = collectPlatformTemplates("kerminal");
    expect(templates).toBeInstanceOf(Map);
    for (const [, content] of templates ?? new Map()) {
      expect(content).not.toContain("{{PYTHON_CMD}}");
    }
    // The operator guide is rendered through the same python-command rewrite
    // as every other file.
    const { getKerminalGuide } = await import(
      "../../src/templates/kerminal/index.js"
    );
    expect(templates?.get(".kerminal/KERMINAL.md")).toBe(
      replacePythonCommandLiterals(getKerminalGuide()),
    );
  });
});
