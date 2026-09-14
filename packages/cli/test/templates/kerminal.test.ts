import { describe, expect, it } from "vitest";
import { collectKerminalTemplates } from "../../src/configurators/kerminal.js";
import { collectPiTemplates } from "../../src/configurators/pi.js";

describe("kerminal collectKerminalTemplates", () => {
  it("writes entry skills under .kerminal/skills/ (kerminal-native project root)", () => {
    const files = collectKerminalTemplates();

    // User-invocable entry points (no slash palette → delivered as skills)
    expect(files.has(".kerminal/skills/trellis-start/SKILL.md")).toBe(true);
    expect(files.has(".kerminal/skills/trellis-continue/SKILL.md")).toBe(true);
    expect(files.has(".kerminal/skills/trellis-finish-work/SKILL.md")).toBe(
      true,
    );

    // Platform-resolved placeholders: get_context.py calls carry --platform kerminal
    const start = files.get(".kerminal/skills/trellis-start/SKILL.md");
    expect(start).toContain("--platform kerminal");
    expect(start).toContain("name: trellis-start");
  });

  it("renders CMD_REF as bare trellis-<name> skill references in entry skills", () => {
    const files = collectKerminalTemplates();
    const finish = files.get(".kerminal/skills/trellis-finish-work/SKILL.md");
    // `{{CMD_REF:finish-work}}` → `` `trellis-finish-work` `` (kerminal loads
    // skills by name through its skill tool)
    expect(finish).toContain("`trellis-finish-work`");
  });

  it("writes workflow + bundled skills to the shared .agents/skills/ root only", () => {
    const files = collectKerminalTemplates();
    expect(files.has(".agents/skills/trellis-check/SKILL.md")).toBe(true);
    expect(files.has(".agents/skills/trellis-before-dev/SKILL.md")).toBe(true);
    expect(files.has(".agents/skills/trellis-meta/SKILL.md")).toBe(true);
    // Command-as-skill files stay kerminal-private (Codex owns the shared
    // trellis-start/continue/finish-work fallback copies).
    expect(files.has(".agents/skills/trellis-start/SKILL.md")).toBe(false);
    expect(files.has(".agents/skills/trellis-finish-work/SKILL.md")).toBe(
      false,
    );
  });

  it("renders .agents/skills/ files byte-identically to Pi's shared writes", () => {
    const kerminalFiles = collectKerminalTemplates();
    const piFiles = collectPiTemplates();
    for (const [key, content] of kerminalFiles) {
      if (!key.startsWith(".agents/skills/")) continue;
      expect(
        piFiles.get(key),
        `${key} must be byte-identical to Pi's shared-skill write`,
      ).toBe(content);
    }
  });

  it("ships an operator guide and no hooks/settings files", () => {
    const files = collectKerminalTemplates();
    expect(files.get(".kerminal/KERMINAL.md")).toBeDefined();
    for (const key of files.keys()) {
      expect(key.startsWith(".kerminal/hooks")).toBe(false);
      expect(key).not.toBe(".kerminal/settings.json");
      expect(key).not.toBe(".kerminal/config.toml");
    }
  });

  it("operator guide documents the .git project-detection requirement", () => {
    const files = collectKerminalTemplates();
    expect(files.get(".kerminal/KERMINAL.md")).toContain("`.git`");
  });
});
