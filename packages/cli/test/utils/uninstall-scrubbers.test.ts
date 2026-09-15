/**
 * Unit tests for uninstall-scrubbers.
 *
 * TrellisKerminal writes exactly one structured file into user projects
 * (`AGENTS.md`), so the only scrubber is the managed-markdown-block one.
 */

import { describe, it, expect } from "vitest";
import { scrubManagedMarkdownBlock } from "../../src/utils/uninstall-scrubbers.js";

const TEST_BLOCK_START = "<!-- TRELLIS:TEST:START -->";
const TEST_BLOCK_END = "<!-- TRELLIS:TEST:END -->";

describe("scrubManagedMarkdownBlock", () => {
  it("removes the managed block and preserves user markdown", () => {
    const input = `# User Guidance

Keep this.

${TEST_BLOCK_START}
# Managed
Remove this.
${TEST_BLOCK_END}

## Tail

Also keep this.
`;

    const { content, fullyEmpty } = scrubManagedMarkdownBlock(
      input,
      TEST_BLOCK_START,
      TEST_BLOCK_END,
    );

    expect(content).toBe(`# User Guidance

Keep this.

## Tail

Also keep this.
`);
    expect(fullyEmpty).toBe(false);
  });

  it("reports fullyEmpty when only the managed block remains", () => {
    const { content, fullyEmpty } = scrubManagedMarkdownBlock(
      `${TEST_BLOCK_START}\nmanaged\n${TEST_BLOCK_END}\n`,
      TEST_BLOCK_START,
      TEST_BLOCK_END,
    );

    expect(content).toBe("");
    expect(fullyEmpty).toBe(true);
  });

  it("leaves malformed marker pairs untouched", () => {
    const input = `${TEST_BLOCK_START}\nmanaged\n`;
    const { content, fullyEmpty } = scrubManagedMarkdownBlock(
      input,
      TEST_BLOCK_START,
      TEST_BLOCK_END,
    );

    expect(content).toBe(input);
    expect(fullyEmpty).toBe(false);
  });

  it("leaves files without any marker untouched", () => {
    const input = "# Pure user instructions\n";
    const { content, fullyEmpty } = scrubManagedMarkdownBlock(
      input,
      TEST_BLOCK_START,
      TEST_BLOCK_END,
    );

    expect(content).toBe(input);
    expect(fullyEmpty).toBe(false);
  });
});
