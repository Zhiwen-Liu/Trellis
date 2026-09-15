# Release Process

> Release, versioning, and npm publishing rules for the TrellisKerminal repo.

---

## Overview

TrellisKerminal publishes one npm package from one git tag:

| Package | Role | Published by |
|---|---|---|
| `trellis-kerminal` | User-facing CLI plus the bundled core domain modules | GitHub Actions only |

(Pre-0.7 the fork shipped a version-locked `@zhiwenliu/trellis` + `@zhiwenliu/trellis-core` pair; the core SDK was merged into the CLI package at 0.7.0.)

---

## CI-only publishing

Official npm publishing must happen through `.github/workflows/publish.yml`.

Do not run `npm publish` or `pnpm publish` locally for official Trellis packages. Local machines may run `pnpm pack`, `release-preflight`, tests, lint, typecheck, and dry-run checks, but not package publication.

If a CI publish looks partial or inconsistent:

1. Inspect the GitHub Actions publish run.
2. Verify public npm visibility:
   ```bash
   npm view trellis-kerminal@<version> version dist-tags --json --registry=https://registry.npmjs.org/
   ```
3. Fix the workflow or release scripts.
4. Re-run the CI path or move the tag after the fix when the same version is still the intended release artifact.

Do not compensate by publishing one missing package locally. That creates a release artifact without CI provenance and hides the workflow failure from the next release.

The publish workflow must verify the package after publish with:

```bash
node packages/cli/scripts/release-preflight.js verify-npm
```

---

## Version invariants

| Invariant | Rule |
|---|---|
| Package version | `packages/cli/package.json` is the only package manifest; its `version` is the release version. |
| Shared tag | Git tag `v<version>` must match the package version. |
| Shared npm dist-tag | `beta` for `-beta.N`, `rc` for `-rc.N`, `alpha` for `-alpha.N`, `latest` for GA. |

`packages/cli/scripts/release-preflight.js` is the source of truth for these checks.

Required gates:

```bash
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js publish-plan
```

---

## Branch and release tracks

| Track | Branch pattern | Version pattern | npm tag | Notes |
|---|---|---|---|---|
| Stable | `main` | `X.Y.Z` | `latest` | Patch/minor/major GA releases. |
| Beta | `feat/vX.Y.Z-beta` or equivalent long-lived beta branch | `X.Y.Z-beta.N` | `beta` | Feature incubation. CLI and core both publish beta versions. |
| RC | release candidate branch or the stabilized beta branch | `X.Y.Z-rc.N` | `rc` | Pre-GA validation. CLI and core both publish rc versions. |
| GA promotion | stable release branch / `main` | `X.Y.Z` | `latest` | Promote the release candidate into the stable docs and latest npm tag. |

A new beta cycle starts from the current stable/release baseline and uses the next minor or major version, for example `0.6.0-beta.0` after `0.5.x`. It does not continue an older beta line after that line has moved to RC or GA.

Stable fixes normally flow from `main` to beta/rc by cherry-pick. Beta-only features do not flow back to `main` by cherry-pick; rewrite them as stable-ready commits when needed.

---

## Docs and submodules

Docs live in this repo (`docs/`, plain Markdown) — there is no docs-site and
no git submodules. The former `docs-site` / `marketplace` submodules and their
release-time lifecycle scripts were removed at 0.7.0, so there is no submodule
commit ordering or pointer-reachability contract anymore.

### Contract: the pre-release sweep MUST exclude `.trellis/`

The pre-release `git add` in `release.js` (the `chore: pre-release updates`
commit) **must** exclude `.trellis/` from its pathspec:

```js
run("git add -A -- ':!.trellis'");
```

`.trellis/tasks/` is not gitignored, so a blanket `git add -A` sweeps in any
dirty in-progress task dirs, workspace journal drafts, and runtime artifacts
that happen to be present in the release session. Staging `.trellis/` is only
ever allowed through `common/safe_commit.py`'s precise allowlist (see the
"unscoped `.trellis` staging" bug class in `script-conventions.md`) — never
through a release-time blanket stage.

> **Incident note (2026-06, #303).** A `release.js` pre-release `git add -A`
> that excluded only `docs-site`/`marketplace` swept 6 unrelated in-progress
> community-governance task files into the pre-release commit twice
> (`5ee43ecc`, `ec123deb`). The maintainer had to `git rm --cached` three
> times (`d66405d9`, `81960120`, `3c3219cf`) before finally tracking the
> drafts to stop the bleed (`e83233c9`). The same staging-scope defect also
> lives in `add_session.py` (the #303 body) and in ad-hoc human/AI
> `git add -A`. This contract exists so the release route can never re-open
> that escape hatch. See `script-conventions.md` → "Absolute prohibition:
> never blanket-stage" for the full bug-class writeup.

---

## Manifest continuity across branches

Each release branch maintains its own `packages/cli/src/migrations/manifests/<version>.json`. The CLI update logic walks the manifest chain between `fromVersion` and `toVersion`, so every published version that a user can upgrade through must have a local manifest on the release branch.

When a stable patch manifest is missing from a beta branch:

```bash
git show main:packages/cli/src/migrations/manifests/<version>.json \
  > packages/cli/src/migrations/manifests/<version>.json
git add packages/cli/src/migrations/manifests/<version>.json
git commit -m "chore: restore manifest <version> from main"
```

Restore published manifests deliberately. Do not auto-merge whole manifest directories across release branches, because branch-specific manifests can mention files that do not exist on the other branch.

---

## Release command sequence

The root release scripts delegate to the CLI package:

```bash
pnpm release
pnpm release:beta
pnpm release:rc
pnpm release:promote
```

`packages/cli/scripts/release.js` runs:

1. `check-manifest-continuity`
2. tests
3. pre-release commit excluding `.trellis`
4. `bump-versions.js <type>` to update the package version
5. `release-preflight check-versions`
6. version commit with the version string as the commit message
7. git tag `v<version>`
8. push branch and tags
9. GitHub Actions publish workflow builds, tests, packs, publishes, and verifies the package

The release script does not publish locally. The pushed tag is what starts official npm publication.

---

## Publish workflow sequence

`.github/workflows/publish.yml` runs on `v*` tag push and GitHub Release publication. It is idempotent for reruns on the same tag.

Required order:

1. install dependencies
2. `release-preflight check-versions --require-tag`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test`
6. `release-preflight publish-plan --github`
7. publish `trellis-kerminal` if missing
8. `release-preflight verify-npm`

---

## Artifact verification for release-claimed assets

Any changelog, docs page, or marketplace entry that says a feature is "bundled",
"installed automatically", or "included with Trellis" must be verified against
the built package artifact, not only against the source tree.

Before tagging a release that adds or changes a bundled template, skill,
workflow, hook, script, or generated platform asset:

1. Run the CLI build.
2. Run `npm pack --dry-run --json` from `packages/cli/` and check the expected
   `dist/templates/**` paths are present.
3. Use the built binary (`node packages/cli/bin/trellis.js`) in a fresh temp
   git repository and run the user-facing command that should install the
   asset.
4. Check both the generated files and `.trellis/.template-hashes.json` for the
   expected paths.
5. Run `trellis update --dry-run` from the temp repository and confirm it
   reports the project is already up to date.

This gate is required when docs are updated before or separately from the code
branch that actually adds the distributable files. A source file existing on
another branch, or on a docs branch is not evidence that
the npm package contains it.

Example for a built-in multi-file skill:

```bash
pnpm -C packages/cli build

cd packages/cli
npm pack --dry-run --json | grep 'dist/templates/common/bundled-skills/<skill>/SKILL.md'
cd ../..

tmpdir=$(mktemp -d /tmp/trellis-release-smoke-XXXXXX)
printf '{"name":"trellis-smoke","version":"0.0.0"}\n' > "$tmpdir/package.json"
git -C "$tmpdir" init -q
(
  cd "$tmpdir"
  node /path/to/TrellisKerminal/packages/cli/bin/trellis.js init -u smoke --yes --kerminal
  test -f .kerminal/skills/<skill>/SKILL.md
  test -f .agents/skills/<skill>/SKILL.md
  grep -q '<skill>' .trellis/.template-hashes.json
  node /path/to/Trellis/packages/cli/bin/trellis.js update --dry-run
)
```

---

## Pre-release checklist

- [ ] Worktree is clean except intentional release changes.
- [ ] Relevant coding specs have been read.
- [ ] Manifest exists for the target version.
- [ ] `node packages/cli/scripts/release-preflight.js check-versions` passes.
- [ ] Release-claimed bundled assets are verified in `npm pack --dry-run --json` and a fresh temp-directory `trellis init` / `trellis update --dry-run` smoke test.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass or the blocker is recorded.
- [ ] Breaking releases include `migrationGuide` and `aiInstructions` in the manifest.
- [ ] Official package publication is left to CI.

---

## Cross-references

- Core/CLI code ownership and module boundaries: `trellis-core-sdk.md`
- Manifest format and migration types: `migrations.md`
- Native dependency policy: `quality-guidelines.md`
