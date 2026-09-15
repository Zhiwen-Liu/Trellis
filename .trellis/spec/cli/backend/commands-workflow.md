# `trellis workflow` Command

`trellis workflow` lists and resets the project's active `.trellis/workflow.md`
template. TrellisKerminal ships exactly one workflow — the bundled `native`
template — so the command is an offline reset/inspect tool. (The upstream
marketplace mechanism was removed in the Kerminal-only registry collapse; see
git history for the multi-source resolver.)

## Scenario: workflow switcher over the bundled native template

### 1. Scope / Trigger

Trigger: editing a command that writes the runtime-parsed
`.trellis/workflow.md` template and manages `.trellis/.template-hashes.json`
ownership for it.

This spec applies when editing:

- `packages/cli/src/commands/workflow.ts`
- `packages/cli/src/utils/workflow-resolver.ts`
- `packages/cli/src/configurators/workflow.ts`
- workflow-related tests

### 2. Signatures

CLI signatures:

```text
trellis workflow
trellis workflow --list
trellis workflow --template native
trellis workflow --template native --force
trellis workflow --template native --create-new
```

Resolver signatures:

```typescript
export const NATIVE_WORKFLOW_ID = "native";

export interface ResolvedWorkflowTemplate {
  id: string;
  type: "workflow";
  name: string;
  description?: string;
  path: string;
  content: string;
  source: "bundled";
}

export interface WorkflowTemplateListing {
  id: string;
  type: "workflow";
  name: string;
  description?: string;
  path: string;
  source: "bundled";
}

export function listWorkflowTemplates(): Promise<{
  templates: WorkflowTemplateListing[];
  errorMessage?: string;
}>;

export function resolveWorkflowTemplate(
  id: string,
): Promise<ResolvedWorkflowTemplate>;
```

Configurator signature:

```typescript
export interface WorkflowOptions {
  projectType: ProjectType;
  packages?: DetectedPackage[];
}
```

### 3. Contracts

- `resolveWorkflowTemplate(id)` resolves only `native` (bundled
  `workflowMdTemplate`, offline, never errors); any other id throws
  `WorkflowResolveError` naming the single available template.
- `listWorkflowTemplates()` returns exactly the native entry.

Ownership contract:

- `native` is Trellis-managed. After writing it, refresh the
  `.trellis/workflow.md` hash with `updateHashes`.
- A workflow.md with no stored hash is conservatively treated as
  user-managed local content by `trellis update` — it is never silently
  restored to native bytes; the normal modified-file decision path applies.

Runtime parser contract:

- The native workflow template must keep `## Phase Index`,
  `## Phase 1: Plan`, `#### X.Y` step headings, platform marker syntax, and
  all required `[workflow-state:*]` blocks.
- SessionStart, per-turn workflow-state hooks, `trellis-start`, and
  `get_context.py --mode phase` read the current `.trellis/workflow.md`; do not
  duplicate workflow-specific behavior in hook scripts or skills.

Native source-of-truth contract:

- `packages/cli/src/templates/trellis/workflow.md` is the source of truth for
  the native workflow. The resolver imports `workflowMdTemplate` from the
  bundled templates module — never re-read or duplicate the file.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| `trellis workflow --template <id>` and current workflow is modified | Exit 1 with guidance to use `--force` or `--create-new`; do not prompt, even on a TTY |
| Interactive `trellis workflow` picker and current workflow is modified | Prompt for overwrite, create-new, or skip |
| `--create-new` | Write a generated `workflow.md.new` file beside `.trellis/workflow.md`; do not change active workflow or hash file |
| `--force` | Overwrite active workflow and refresh the native hash |
| Unknown workflow id | Throw `WorkflowResolveError` / command error; CLI exits non-zero |
| `trellis update` over a hash-less (user-edited) workflow | Treat workflow as modified/user-managed; never silently restore native |

### 5. Good/Base/Bad Cases

- Good: `trellis workflow --template native` resets a user-edited workflow
  (with `--force`) and re-tracks the hash so `trellis update` manages it again.
- Base: `trellis init` writes the bundled native workflow and keeps
  `.trellis/workflow.md` hash-tracked.
- Bad: recording edited workflow content as the pristine template hash. The
  next `trellis update` sees a pristine file and overwrites the user's edits
  with native workflow.

### 6. Tests Required

Unit tests:

- `resolveWorkflowTemplate("native")` returns bundled content offline.
- Unknown ids throw `WorkflowResolveError` mentioning the native template.

Integration tests (see `test/commands/workflow.integration.test.ts`):

- `init` writes the native workflow.md and keeps it hash-tracked.
- Unknown workflow template id is rejected.
- `trellis workflow --template native` refreshes the hash.
- Non-interactive run with a locally-modified workflow.md fails without
  `--force`.
- Explicit `--template` with modified workflow fails even when `stdin.isTTY`
  is true.
- `--create-new` writes a generated `workflow.md.new` file beside
  `.trellis/workflow.md` and does not touch the active workflow or hash.
- `trellis update` does not silently restore native workflow over user edits.

Runtime parsing validation:

```bash
python3 ./.trellis/scripts/get_context.py --mode phase
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.2
```

### 7. Wrong vs Correct

#### Wrong

```typescript
// Records edited content as the pristine template hash.
fs.writeFileSync(".trellis/workflow.md", editedContent);
updateHashes(cwd, new Map([[PATHS.WORKFLOW_GUIDE_FILE, editedContent]]));
```

This makes `trellis update` auto-replace the user's edits with the bundled
native workflow later.

#### Correct

```typescript
fs.writeFileSync(".trellis/workflow.md", editedContent);
removeHash(cwd, PATHS.WORKFLOW_GUIDE_FILE);
```

Missing hash means update conservatively treats the workflow as user-managed and
routes it through the normal modified-file decision path.

#### Wrong

```typescript
if (isInteractive()) {
  await promptForOverwrite();
}
```

An explicit `trellis workflow --template <id>` can hang in a TTY even though it
is a scriptable command path.

#### Correct

```typescript
const explicitTemplate = Boolean(options.template);
if (explicitTemplate || !isInteractive()) {
  throw new WorkflowCommandError("... use --force or --create-new ...");
}
```

Only the no-argument interactive picker may prompt for conflict resolution.
