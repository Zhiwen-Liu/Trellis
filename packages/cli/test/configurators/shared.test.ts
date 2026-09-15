import { describe, expect, it, afterEach } from "vitest";
import {
  getPythonCommandForPlatform,
  replacePythonCommandLiterals,
  resolvePlaceholders,
  resolvePlaceholdersNeutral,
  resolveSkillsNeutral,
} from "../../src/configurators/shared.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";
import type { TemplateContext } from "../../src/types/ai-tools.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const kerminalCtx: TemplateContext = {
  cmdRefPrefix: "trellis-",
  executorAI: "Bash scripts or tool calls",
  userActionLabel: "Skills",
  agentCapable: true,
  hasHooks: false,
  cliFlag: "kerminal",
};

// A hook-based variant to exercise the conditional-block machinery both ways.
const hooksCtx: TemplateContext = {
  cmdRefPrefix: "/trellis:",
  executorAI: "Bash scripts or Task calls",
  userActionLabel: "Slash commands",
  agentCapable: true,
  hasHooks: true,
  cliFlag: "kerminal",
};

// An agent-less variant for the negated-conditional paths.
const inlineCtx: TemplateContext = {
  cmdRefPrefix: "/trellis-",
  executorAI: "Bash scripts or file reads",
  userActionLabel: "Slash commands",
  agentCapable: false,
  hasHooks: false,
  cliFlag: "kerminal",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// replacePythonCommandLiterals — platform-mocked unit tests
// ---------------------------------------------------------------------------

describe("replacePythonCommandLiterals", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    // Restore original platform descriptor
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  function mockPlatform(platform: string) {
    Object.defineProperty(process, "platform", { value: platform });
  }

  it("replaces python3 with python on win32", () => {
    mockPlatform("win32");
    expect(replacePythonCommandLiterals("run python3 script.py")).toBe(
      "run python script.py",
    );
  });

  it("replaces multiple occurrences on win32", () => {
    mockPlatform("win32");
    expect(replacePythonCommandLiterals("python3 a.py && python3 b.py")).toBe(
      "python a.py && python b.py",
    );
  });

  it("preserves shebang lines on win32", () => {
    mockPlatform("win32");
    const input = "#!/usr/bin/env python3\npython3 script.py";
    const result = replacePythonCommandLiterals(input);
    expect(result).toBe("#!/usr/bin/env python3\npython script.py");
  });

  it("does not replace python3 on non-Windows platforms", () => {
    mockPlatform("linux");
    expect(replacePythonCommandLiterals("run python3 script.py")).toBe(
      "run python3 script.py",
    );
  });

  it("preserves shebang lines on non-Windows platforms", () => {
    mockPlatform("darwin");
    const input = "#!/usr/bin/env python3\npython3 script.py";
    expect(replacePythonCommandLiterals(input)).toBe(input);
  });

  it("is idempotent on win32", () => {
    mockPlatform("win32");
    const once = replacePythonCommandLiterals("python3 script.py");
    const twice = replacePythonCommandLiterals(once);
    expect(once).toBe("python script.py");
    expect(twice).toBe("python script.py");
  });

  it("handles empty string", () => {
    mockPlatform("win32");
    expect(replacePythonCommandLiterals("")).toBe("");
  });

  it("does not replace python3 that is part of a longer word", () => {
    mockPlatform("win32");
    // "python3" as a standalone token is replaced; "python3x" contains "python3"
    // so it WILL be replaced to "pythonx" — this is expected behavior
    expect(replacePythonCommandLiterals("python3x")).toBe("pythonx");
  });

  it("handles multiline content with mixed shebangs and commands", () => {
    mockPlatform("win32");
    const input = [
      "#!/usr/bin/env python3",
      "# comment about python3",
      'exec python3 "$0" "$@"',
      "python3 ./.trellis/scripts/task.py",
    ].join("\n");
    const expected = [
      "#!/usr/bin/env python3",
      "# comment about python",
      'exec python "$0" "$@"',
      "python ./.trellis/scripts/task.py",
    ].join("\n");
    expect(replacePythonCommandLiterals(input)).toBe(expected);
  });
});

describe("getPythonCommandForPlatform", () => {
  it("returns python on Windows", () => {
    expect(getPythonCommandForPlatform("win32")).toBe("python");
  });

  it("returns python3 on macOS and Linux", () => {
    expect(getPythonCommandForPlatform("darwin")).toBe("python3");
    expect(getPythonCommandForPlatform("linux")).toBe("python3");
  });
});

describe("resolvePlaceholders", () => {
  // -----------------------------------------------------------------------
  // Legacy behavior (no context)
  // -----------------------------------------------------------------------

  describe("without context (legacy)", () => {
    it("resolves {{PYTHON_CMD}}", () => {
      const result = resolvePlaceholders("run {{PYTHON_CMD}} script.py");
      const expected =
        process.platform === "win32"
          ? "run python script.py"
          : "run python3 script.py";
      expect(result).toBe(expected);
    });

    it("leaves other placeholders untouched when no context", () => {
      const input = "See {{CMD_REF:brainstorm}} and {{EXECUTOR_AI}}";
      expect(resolvePlaceholders(input)).toBe(input);
    });
  });

  // -----------------------------------------------------------------------
  // CMD_REF substitution
  // -----------------------------------------------------------------------

  describe("{{CMD_REF:name}}", () => {
    it("resolves with the context's prefix", () => {
      const result = resolvePlaceholders(
        "See {{CMD_REF:brainstorm}} for details",
        hooksCtx,
      );
      expect(result).toBe("See /trellis:brainstorm for details");
    });

    it("resolves with a bare-name prefix", () => {
      const result = resolvePlaceholders(
        "Run {{CMD_REF:check}} after coding",
        kerminalCtx,
      );
      expect(result).toBe("Run trellis-check after coding");
    });

    it("handles multiple CMD_REF in one template", () => {
      const input =
        "{{CMD_REF:start}} then {{CMD_REF:brainstorm}} then {{CMD_REF:check}}";
      expect(resolvePlaceholders(input, hooksCtx)).toBe(
        "/trellis:start then /trellis:brainstorm then /trellis:check",
      );
    });

    it("handles hyphenated command names", () => {
      expect(resolvePlaceholders("{{CMD_REF:finish-work}}", hooksCtx)).toBe(
        "/trellis:finish-work",
      );
      expect(
        resolvePlaceholders("{{CMD_REF:check-cross-layer}}", kerminalCtx),
      ).toBe("trellis-check-cross-layer");
    });
  });

  // -----------------------------------------------------------------------
  // Simple substitutions
  // -----------------------------------------------------------------------

  describe("simple substitutions", () => {
    it("resolves {{EXECUTOR_AI}}", () => {
      expect(
        resolvePlaceholders("| `[AI]` | {{EXECUTOR_AI}} |", hooksCtx),
      ).toBe("| `[AI]` | Bash scripts or Task calls |");
      expect(
        resolvePlaceholders("| `[AI]` | {{EXECUTOR_AI}} |", kerminalCtx),
      ).toBe("| `[AI]` | Bash scripts or tool calls |");
    });

    it("resolves {{USER_ACTION_LABEL}}", () => {
      expect(
        resolvePlaceholders("| `[USER]` | {{USER_ACTION_LABEL}} |", hooksCtx),
      ).toBe("| `[USER]` | Slash commands |");
      expect(
        resolvePlaceholders(
          "| `[USER]` | {{USER_ACTION_LABEL}} |",
          kerminalCtx,
        ),
      ).toBe("| `[USER]` | Skills |");
    });

    it("resolves {{PYTHON_CMD}} alongside context placeholders", () => {
      const result = resolvePlaceholders(
        "{{PYTHON_CMD}} ./.trellis/scripts/task.py and {{CMD_REF:start}}",
        hooksCtx,
      );
      const py = process.platform === "win32" ? "python" : "python3";
      expect(result).toBe(
        `${py} ./.trellis/scripts/task.py and /trellis:start`,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Conditional blocks
  // -----------------------------------------------------------------------

  describe("conditional blocks", () => {
    describe("{{#AGENT_CAPABLE}}", () => {
      const template = [
        "Before",
        "{{#AGENT_CAPABLE}}",
        "Call Implement Agent",
        "{{/AGENT_CAPABLE}}",
        "After",
      ].join("\n");

      it("includes block when agentCapable=true", () => {
        const result = resolvePlaceholders(template, kerminalCtx);
        expect(result).toContain("Call Implement Agent");
        expect(result).toContain("Before");
        expect(result).toContain("After");
      });

      it("removes block when agentCapable=false", () => {
        const result = resolvePlaceholders(template, inlineCtx);
        expect(result).not.toContain("Call Implement Agent");
        expect(result).toContain("Before");
        expect(result).toContain("After");
      });
    });

    describe("{{^AGENT_CAPABLE}} (negated)", () => {
      const template = [
        "{{^AGENT_CAPABLE}}",
        "Implement the changes directly",
        "{{/AGENT_CAPABLE}}",
      ].join("\n");

      it("removes block when agentCapable=true", () => {
        const result = resolvePlaceholders(template, kerminalCtx);
        expect(result).not.toContain("Implement the changes directly");
      });

      it("includes block when agentCapable=false", () => {
        const result = resolvePlaceholders(template, inlineCtx);
        expect(result).toContain("Implement the changes directly");
      });
    });

    describe("{{#HAS_HOOKS}} / {{^HAS_HOOKS}}", () => {
      const template = [
        "{{#HAS_HOOKS}}",
        "code-spec context is auto-injected by hook",
        "{{/HAS_HOOKS}}",
        "{{^HAS_HOOKS}}",
        "read specs manually before coding",
        "{{/HAS_HOOKS}}",
      ].join("\n");

      it("hasHooks=true gets hook text", () => {
        const result = resolvePlaceholders(template, hooksCtx);
        expect(result).toContain("auto-injected by hook");
        expect(result).not.toContain("read specs manually");
      });

      it("hasHooks=false gets manual text", () => {
        const result = resolvePlaceholders(template, kerminalCtx);
        expect(result).not.toContain("auto-injected by hook");
        expect(result).toContain("read specs manually");
      });
    });

    describe("nested conditionals", () => {
      const template = [
        "{{#AGENT_CAPABLE}}",
        "Agents available",
        "{{#HAS_HOOKS}}",
        "Hook injection active",
        "{{/HAS_HOOKS}}",
        "{{^HAS_HOOKS}}",
        "No hooks, manual injection",
        "{{/HAS_HOOKS}}",
        "{{/AGENT_CAPABLE}}",
        "{{^AGENT_CAPABLE}}",
        "No agents, do it inline",
        "{{/AGENT_CAPABLE}}",
      ].join("\n");

      it("agent+hooks: agents + hook injection", () => {
        const result = resolvePlaceholders(template, hooksCtx);
        expect(result).toContain("Agents available");
        expect(result).toContain("Hook injection active");
        expect(result).not.toContain("No hooks");
        expect(result).not.toContain("No agents");
      });

      it("agent, no hooks: agents + manual injection", () => {
        const result = resolvePlaceholders(template, kerminalCtx);
        expect(result).toContain("Agents available");
        expect(result).not.toContain("Hook injection active");
        expect(result).toContain("No hooks, manual injection");
        expect(result).not.toContain("No agents");
      });

      it("no agent, no hooks: inline only", () => {
        const result = resolvePlaceholders(template, inlineCtx);
        expect(result).not.toContain("Agents available");
        expect(result).not.toContain("Hook injection");
        expect(result).toContain("No agents, do it inline");
      });
    });
  });

  // -----------------------------------------------------------------------
  // Blank line cleanup
  // -----------------------------------------------------------------------

  describe("blank line cleanup", () => {
    it("collapses 3+ consecutive blank lines to 2", () => {
      const template =
        "A\n\n{{#AGENT_CAPABLE}}\nRemoved\n{{/AGENT_CAPABLE}}\n\nB";
      const result = resolvePlaceholders(template, inlineCtx);
      expect(result).not.toMatch(/\n{3,}/);
      expect(result).toContain("A");
      expect(result).toContain("B");
    });
  });

  // -----------------------------------------------------------------------
  // CLI_FLAG substitution (migrate-flow-bugs Bug B fix: platform propagation)
  // -----------------------------------------------------------------------

  describe("{{CLI_FLAG}}", () => {
    it("substitutes to the platform's cliFlag value", () => {
      const input = "--platform {{CLI_FLAG}}";
      expect(resolvePlaceholders(input, kerminalCtx)).toBe(
        "--platform kerminal",
      );
      expect(resolvePlaceholders(input, hooksCtx)).toBe("--platform kerminal");
    });

    it("substitutes multiple occurrences in one string", () => {
      const input = "a={{CLI_FLAG}} b={{CLI_FLAG}}";
      expect(resolvePlaceholders(input, kerminalCtx)).toBe(
        "a=kerminal b=kerminal",
      );
    });

    it("leaves {{CLI_FLAG}} literal when no context is provided", () => {
      const input = "--platform {{CLI_FLAG}}";
      expect(resolvePlaceholders(input)).toBe(input);
    });

    it("works alongside {{PYTHON_CMD}} in a realistic init-context invocation", () => {
      const input =
        '{{PYTHON_CMD}} ./.trellis/scripts/task.py init-context "$TASK_DIR" <type> --platform {{CLI_FLAG}}';
      const py = process.platform === "win32" ? "python" : "python3";
      expect(resolvePlaceholders(input, kerminalCtx)).toBe(
        `${py} ./.trellis/scripts/task.py init-context "$TASK_DIR" <type> --platform kerminal`,
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty content", () => {
      expect(resolvePlaceholders("", kerminalCtx)).toBe("");
    });

    it("handles content with no placeholders", () => {
      const plain = "# Just a heading\n\nSome text.";
      expect(resolvePlaceholders(plain, kerminalCtx)).toBe(plain);
    });

    it("does not resolve unknown placeholders", () => {
      const input = "{{UNKNOWN}} and {{#UNKNOWN_FLAG}}x{{/UNKNOWN_FLAG}}";
      expect(resolvePlaceholders(input, kerminalCtx)).toBe(input);
    });
  });
});

// ---------------------------------------------------------------------------
// resolvePlaceholdersNeutral — neutral CMD_REF for shared `.agents/skills/`
// (issue #224 fix: avoid last-writer-wins on identical files when multiple
// platforms share the skills root)
// ---------------------------------------------------------------------------

describe("resolvePlaceholdersNeutral", () => {
  it("renders {{CMD_REF:name}} as `name` (Trellis command) — platform-neutral", () => {
    expect(
      resolvePlaceholdersNeutral("See {{CMD_REF:brainstorm}}", kerminalCtx),
    ).toBe("See `brainstorm` (Trellis command)");
    expect(
      resolvePlaceholdersNeutral("See {{CMD_REF:brainstorm}}", hooksCtx),
    ).toBe("See `brainstorm` (Trellis command)");
  });

  it("produces byte-identical CMD_REF output across contexts", () => {
    const input =
      "Run {{CMD_REF:check}} then {{CMD_REF:finish-work}} after coding.";
    const a = resolvePlaceholdersNeutral(input, kerminalCtx);
    const b = resolvePlaceholdersNeutral(input, hooksCtx);
    const c = resolvePlaceholdersNeutral(input, inlineCtx);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("still resolves {{PYTHON_CMD}}", () => {
    const result = resolvePlaceholdersNeutral(
      "{{PYTHON_CMD}} script.py",
      kerminalCtx,
    );
    const py = process.platform === "win32" ? "python" : "python3";
    expect(result).toBe(`${py} script.py`);
  });

  it("still resolves {{CLI_FLAG}} per platform", () => {
    expect(
      resolvePlaceholdersNeutral("--platform {{CLI_FLAG}}", kerminalCtx),
    ).toBe("--platform kerminal");
  });

  it("still resolves {{EXECUTOR_AI}} and {{USER_ACTION_LABEL}} per platform", () => {
    // Defensive: not used in current shared skills, but kept functional for
    // future templates.
    expect(resolvePlaceholdersNeutral("{{EXECUTOR_AI}}", hooksCtx)).toBe(
      "Bash scripts or Task calls",
    );
    expect(
      resolvePlaceholdersNeutral("{{USER_ACTION_LABEL}}", kerminalCtx),
    ).toBe("Skills");
  });

  it("still applies conditional blocks per context", () => {
    const template = [
      "{{#AGENT_CAPABLE}}",
      "Spawn agent",
      "{{/AGENT_CAPABLE}}",
      "{{^AGENT_CAPABLE}}",
      "Inline edit",
      "{{/AGENT_CAPABLE}}",
    ].join("\n");
    expect(resolvePlaceholdersNeutral(template, kerminalCtx)).toContain(
      "Spawn agent",
    );
    expect(resolvePlaceholdersNeutral(template, inlineCtx)).toContain(
      "Inline edit",
    );
  });

  it("returns content unchanged when no context is provided (legacy parity)", () => {
    const input = "See {{CMD_REF:brainstorm}}";
    expect(resolvePlaceholdersNeutral(input)).toBe(input);
  });

  it("handles empty content", () => {
    expect(resolvePlaceholdersNeutral("", kerminalCtx)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// resolveSkillsNeutral — shared `.agents/skills/` writes
// ---------------------------------------------------------------------------

describe("resolveSkillsNeutral", () => {
  it("uses the kerminal template context from the registry", () => {
    const skills = resolveSkillsNeutral(AI_TOOLS.kerminal.templateContext);
    expect(skills.length).toBeGreaterThan(0);
    for (const skill of skills) {
      expect(skill.name).toMatch(/^trellis-/);
      expect(skill.content).toContain(`name: ${skill.name}`);
    }
  });

  it("renders CMD_REF without platform-specific prefix", () => {
    // The neutral output must not contain platform-prefixed tokens for any
    // command that CMD_REF references in the shared skills.
    const neutral = resolveSkillsNeutral(AI_TOOLS.kerminal.templateContext);
    const cmdRefNames = [
      "start",
      "brainstorm",
      "check",
      "break-loop",
      "update-spec",
      "finish-work",
    ];
    for (const skill of neutral) {
      for (const name of cmdRefNames) {
        expect(
          skill.content,
          `${skill.name} leaks prefix for ${name}`,
        ).not.toContain(`$${name}`);
        expect(
          skill.content,
          `${skill.name} leaks prefix for ${name}`,
        ).not.toContain(`/trellis:${name}`);
        expect(
          skill.content,
          `${skill.name} leaks prefix for ${name}`,
        ).not.toContain(`/trellis-${name}`);
      }
    }
  });
});
