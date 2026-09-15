import { describe, expect, it } from "vitest";
import { collectKerminalTemplates } from "../../src/configurators/kerminal.js";

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
    // Command-as-skill files stay kerminal-private: the shared root only
    // carries the auto-triggered workflow + bundled skills.
    expect(files.has(".agents/skills/trellis-start/SKILL.md")).toBe(false);
    expect(files.has(".agents/skills/trellis-finish-work/SKILL.md")).toBe(
      false,
    );
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

  it("ships trellis agent prompts as skills for generic sub-agent dispatch", () => {
    const files = collectKerminalTemplates();
    expect(files.has(".kerminal/skills/trellis-implement/SKILL.md")).toBe(true);
    expect(files.has(".kerminal/skills/trellis-check/SKILL.md")).toBe(true);
    expect(files.has(".kerminal/skills/trellis-research/SKILL.md")).toBe(true);

    // The main session pastes the skill content into a generic sub-agent's
    // prompt, so each prompt must carry its own recursion guard and the
    // pull-based prelude (implement/check) for task-context loading.
    const implement = files.get(".kerminal/skills/trellis-implement/SKILL.md");
    expect(implement).toContain("Recursion Guard");
    expect(implement).toContain("Active task: <path");
    expect(implement).toContain("Load Trellis Context First");
    expect(files.get(".kerminal/skills/trellis-check/SKILL.md")).toContain(
      "Load Trellis Context First",
    );
    // Research stays standalone (no jsonl context bucket).
    expect(files.get(".kerminal/skills/trellis-research/SKILL.md")).not.toContain(
      "Load Trellis Context First",
    );
  });

  it("operator guide documents the .git project-detection requirement", () => {
    const files = collectKerminalTemplates();
    expect(files.get(".kerminal/KERMINAL.md")).toContain("`.git`");
  });
});
