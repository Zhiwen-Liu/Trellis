/**
 * Workflow template resolver.
 *
 * Resolves `.trellis/workflow.md` content for `trellis init` and
 * `trellis workflow`. TrellisKerminal ships exactly one workflow — the bundled
 * native template — so the resolver is a thin offline lookup. (The upstream
 * marketplace mechanism was removed in the Kerminal-only registry collapse;
 * see git history for the multi-source resolver.)
 *
 * Boundary: command-layer callers (init.ts, commands/workflow.ts) should NOT
 * touch raw template structures. They go through `resolveWorkflowTemplate`
 * and `listWorkflowTemplates` only.
 */

import { workflowMdTemplate } from "../templates/trellis/index.js";

/**
 * The id used to refer to the bundled native workflow.
 *
 * Treated as Trellis-managed for hash-tracking: when this id is selected by
 * `trellis workflow`, `.trellis/workflow.md` stays in `.template-hashes.json`.
 */
export const NATIVE_WORKFLOW_ID = "native";

/**
 * Resolved workflow template entry.
 *
 * `content` is the workflow.md body bytes (LF-normalized in storage).
 * `path` is `bundled:trellis/workflow.md`.
 */
export interface ResolvedWorkflowTemplate {
  id: string;
  type: "workflow";
  name: string;
  description?: string;
  path: string;
  content: string;
  /** Where the content came from. Always bundled in this distribution. */
  source: "bundled";
}

/**
 * Workflow template listing (metadata only, no content).
 */
export interface WorkflowTemplateListing {
  id: string;
  type: "workflow";
  name: string;
  description?: string;
  path: string;
  source: "bundled";
}

export class WorkflowResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowResolveError";
  }
}

function nativeListingEntry(): WorkflowTemplateListing {
  return {
    id: NATIVE_WORKFLOW_ID,
    type: "workflow",
    name: "Native Trellis Workflow",
    description:
      "Default Trellis Plan / Execute / Finish workflow bundled with the CLI",
    path: "bundled:trellis/workflow.md",
    source: "bundled",
  };
}

function nativeResolvedEntry(): ResolvedWorkflowTemplate {
  return {
    ...nativeListingEntry(),
    content: workflowMdTemplate,
  };
}

/**
 * List available workflow templates. The bundled native entry is the only
 * one; offline, never errors.
 */
export async function listWorkflowTemplates(): Promise<{
  templates: WorkflowTemplateListing[];
  errorMessage?: string;
}> {
  return { templates: [nativeListingEntry()] };
}

/**
 * Resolve a workflow id to its content. Only `native` exists; any other id
 * throws a workflow-specific error.
 */
export async function resolveWorkflowTemplate(
  id: string,
): Promise<ResolvedWorkflowTemplate> {
  if (id === NATIVE_WORKFLOW_ID) {
    return nativeResolvedEntry();
  }
  throw new WorkflowResolveError(
    `Workflow template "${id}" is not available. TrellisKerminal ships only the "${NATIVE_WORKFLOW_ID}" workflow template.`,
  );
}
