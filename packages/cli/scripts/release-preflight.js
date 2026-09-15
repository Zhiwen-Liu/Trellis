#!/usr/bin/env node
/**
 * Shared release / publish preflight.
 *
 * One source of truth for:
 *   1. Version match between `packages/cli/package.json` (published as
 *      `trellis-kerminal`) and the current git tag when checked from a
 *      tag context.
 *   2. The npm dist-tag derived from the version (`beta`, `rc`, `alpha`,
 *      or `latest`).
 *   3. An idempotent publish plan that checks npm for the package + version
 *      and reports whether a fresh publish is needed.
 *
 * Used by both `packages/cli` release scripts (humans) and
 * `.github/workflows/publish.yml` (CI) so the rules cannot drift.
 *
 * Commands:
 *   check-versions [--require-tag]   Verify package.json (and optional
 *                                    GITHUB_REF tag) agree on the exact
 *                                    version.
 *   npm-tag                          Print the computed npm dist-tag.
 *   publish-plan [--json|--github]   Decide whether the package still needs
 *                                    a publish. Idempotent: if the version
 *                                    already exists on npm it is skipped
 *                                    (but version mismatches still fail
 *                                    loudly).
 *   verify-npm                       Verify the published package version
 *                                    and dist-tag are visible on the public
 *                                    npm registry. Used after CI publish so
 *                                    a registry visibility problem fails the
 *                                    release pipeline instead of being fixed
 *                                    by a local publish.
 *
 * Idempotency rule: a CI rerun on the same tag must not republish an
 * already-published version, but must also never silently paper over a
 * version/tag mismatch. Version equality is checked first; npm existence
 * decides the skip.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLI_PKG = path.join(REPO_ROOT, "packages/cli/package.json");

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function readVersions() {
  const cli = readJSON(CLI_PKG);
  return {
    name: cli.name,
    version: cli.version,
  };
}

function tagVersionFromEnv() {
  // GITHUB_REF for `push: tags: v*` looks like `refs/tags/v0.6.0-beta.12`.
  // GITHUB_REF_NAME on `release.published` is the tag name.
  const ref = process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || "";
  const m = ref.match(/(?:refs\/tags\/)?v(\d+\.\d+\.\d+(?:-[A-Za-z0-9.+-]+)?)$/);
  return m ? m[1] : null;
}

export function computeNpmTag(version) {
  if (/-beta\./.test(version)) return "beta";
  if (/-rc\./.test(version)) return "rc";
  if (/-alpha\./.test(version)) return "alpha";
  return "latest";
}

export function npmVersionExists(pkgName, version) {
  try {
    const out = execSync(
      `npm view ${pkgName}@${version} version --json --registry=https://registry.npmjs.org/`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 },
    ).trim();
    if (!out) return false;
    // npm returns the literal version string for an exact-version match,
    // and an empty body for unknown versions.
    return JSON.parse(out) === version;
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    if (stderr.includes("E404") || stderr.includes("not found")) return false;
    // Any other npm failure (network, auth) should surface; don't pretend
    // the version doesn't exist, because that would trigger a republish.
    throw err;
  }
}

function npmViewJSON(args) {
  const out = execSync(
    `npm view ${args} --json --registry=https://registry.npmjs.org/`,
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], timeout: 15_000 },
  ).trim();
  return out ? JSON.parse(out) : null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(label, fn) {
  const attempts = 6;
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      if (i === attempts) break;
      console.error(
        `${YELLOW}! ${label} not visible yet; retrying (${i}/${attempts})${RESET}`,
      );
      await sleep(10_000);
    }
  }
  throw lastError;
}

function fail(msg) {
  console.error(`${RED}x ${msg}${RESET}`);
  process.exit(1);
}

function checkVersions({ requireTag, quiet = false }) {
  const v = readVersions();
  const tagVersion = tagVersionFromEnv();
  if (requireTag) {
    if (!tagVersion) {
      fail(
        `Expected a git tag like v${v.version} via GITHUB_REF / GITHUB_REF_NAME but found "${
          process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || ""
        }".`,
      );
    }
    if (tagVersion !== v.version) {
      fail(
        `Git tag version (${tagVersion}) does not match package version (${v.version}).\n` +
          `Refusing to publish: the tag and the package must agree.`,
      );
    }
  } else if (tagVersion && tagVersion !== v.version) {
    fail(
      `Git tag version (${tagVersion}) does not match package version (${v.version}).`,
    );
  }
  if (!quiet) {
    console.log(
      `${GREEN}ok${RESET} versions match: ${v.name}@${v.version}` +
        (tagVersion ? ` = git tag v${tagVersion}` : ""),
    );
  }
  return { ...v, tagVersion };
}

function publishPlan({ output }) {
  const v = checkVersions({ requireTag: false, quiet: output === "json" });
  const tag = computeNpmTag(v.version);
  const exists = npmVersionExists(v.name, v.version);
  const plan = {
    version: v.version,
    tag,
    publish: !exists,
    alreadyOnNpm: exists,
  };
  if (output === "json") {
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    return plan;
  }
  if (output === "github") {
    const gh = process.env.GITHUB_OUTPUT;
    if (!gh) fail(`--github requested but GITHUB_OUTPUT is not set.`);
    fs.appendFileSync(
      gh,
      [
        `version=${plan.version}`,
        `tag=${plan.tag}`,
        `publish=${plan.publish}`,
        `already_on_npm=${plan.alreadyOnNpm}`,
      ].join("\n") + "\n",
    );
  }
  const status = plan.publish
    ? `${GREEN}publish${RESET}`
    : `${YELLOW}skip (already on npm)${RESET}`;
  console.log(
    `${DIM}plan for v${plan.version} -> npm tag "${plan.tag}":${RESET}\n` +
      `  ${v.name}@${plan.version}: ${status}`,
  );
  return plan;
}

async function verifyNpm() {
  const v = checkVersions({ requireTag: false });
  const tag = computeNpmTag(v.version);
  await retry(`${v.name}@${v.version}`, () => {
    const version = npmViewJSON(`${v.name}@${v.version} version`);
    if (version !== v.version) {
      fail(
        `${v.name}@${v.version} is not visible on the public npm registry.`,
      );
    }
    const taggedVersion = npmViewJSON(`${v.name}@${tag} version`);
    if (taggedVersion !== v.version) {
      fail(
        `${v.name}@${tag} resolves to ${taggedVersion ?? "nothing"}, expected ${v.version}.`,
      );
    }
    console.log(
      `${GREEN}ok${RESET} ${v.name}@${v.version} visible on npm tag "${tag}".`,
    );
  });
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(
      `release-preflight <command>\n\n` +
        `commands:\n` +
        `  check-versions [--require-tag]\n` +
        `  npm-tag\n` +
        `  publish-plan [--json|--github]\n` +
        `  verify-npm\n`,
    );
    return;
  }
  if (cmd === "check-versions") {
    checkVersions({ requireTag: rest.includes("--require-tag") });
    return;
  }
  if (cmd === "npm-tag") {
    const v = readVersions();
    process.stdout.write(computeNpmTag(v.version) + "\n");
    return;
  }
  if (cmd === "publish-plan") {
    const output = rest.includes("--json")
      ? "json"
      : rest.includes("--github")
        ? "github"
        : "text";
    publishPlan({ output });
    return;
  }
  if (cmd === "verify-npm") {
    await verifyNpm();
    return;
  }
  fail(`unknown command: ${cmd}`);
}

main();
