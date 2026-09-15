/**
 * Scrubber for structured config files during `trellis uninstall`.
 *
 * TrellisKerminal is a single-platform distribution: the only structured file
 * Trellis writes into user projects is `AGENTS.md` (a shared file where the
 * user may keep their own instructions). It is handled by
 * `scrubManagedMarkdownBlock` below. Legacy per-platform scrubbers (hooks
 * JSON, Codex TOML, OpenCode package.json, Pi settings) were removed together
 * with their platforms in the Kerminal-only registry collapse.
 *
 * A scrubber takes the file content and returns `{ content, fullyEmpty }`:
 * - `content` is the post-scrub text to write back if the file should remain.
 * - `fullyEmpty` is true when, after stripping every trellis-managed value,
 *   nothing meaningful is left. The caller deletes the file in that case.
 */

export interface ScrubResult {
  /** Post-scrub text to write back if the file should remain. */
  content: string;
  /** True → caller should delete the file instead of writing. */
  fullyEmpty: boolean;
}

/**
 * Remove the Trellis-managed markdown block delimited by `startMarker` /
 * `endMarker`, preserving everything the user wrote outside the block.
 *
 * Invariants (shared with the removed legacy scrubbers):
 * - Malformed marker pairs (missing start or end) are left untouched —
 *   we never half-rewrite a file we cannot confidently parse.
 * - No throws, no I/O, no logging: pure function over the input text.
 */
export function scrubManagedMarkdownBlock(
  content: string,
  startMarker: string,
  endMarker: string,
): ScrubResult {
  const start = content.indexOf(startMarker);
  if (start === -1) {
    return { content, fullyEmpty: false };
  }

  const end = content.indexOf(endMarker, start);
  if (end === -1) {
    return { content, fullyEmpty: false };
  }

  const blockEnd = end + endMarker.length;
  const result = (content.slice(0, start) + content.slice(blockEnd))
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  const normalized = result.length > 0 ? `${result}\n` : "";

  return {
    content: normalized,
    fullyEmpty: normalized.trim().length === 0,
  };
}
