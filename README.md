<p align="center">
<picture>
<source srcset="assets/trellis.png" media="(prefers-color-scheme: dark)">
<source srcset="assets/trellis.png" media="(prefers-color-scheme: light)">
<img src="assets/trellis.png" alt="Trellis Logo" width="500" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;">
</picture>
</p>

<p align="center">
<strong>An out-of-the-box engineering framework for AI coding.</strong><br/>
<sub>AI writes code fast, but every session it starts from scratch — no memory of your project, your conventions, or your team's requirements. Trellis persists specs, tasks, and memory into your repo, so any coding agent works to your engineering standards.</sub>
</p>

> [!NOTE]
> **TrellisKerminal** is the Kerminal-only distribution of [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) — it builds on upstream's ideas (specs, tasks, and memory persisted in your repo) but ships a single `trellis-kerminal` npm package with Kerminal as the only supported platform. Docs are plain Markdown in [`docs/`](./docs/).

<p align="center">
<a href="./README_CN.md">简体中文</a> •
<a href="./docs/">Docs</a> •
<a href="./docs/quickstart.md">Quick Start</a> •
<a href="./docs/kerminal.md">Kerminal Reference</a>
</p>

<p align="center">
<a href="https://github.com/Zhiwen-Liu/TrellisKerminal/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-16a34a.svg?style=flat-square" alt="license" /></a>
<a href="https://github.com/Zhiwen-Liu/TrellisKerminal/stargazers"><img src="https://img.shields.io/github/stars/Zhiwen-Liu/TrellisKerminal?style=flat-square&color=eab308" alt="stars" /></a>
<a href="./docs/"><img src="https://img.shields.io/badge/docs-markdown-0f766e?style=flat-square" alt="docs" /></a>
<a href="https://discord.com/invite/tWcCZ3aRHc"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
<a href="https://github.com/Zhiwen-Liu/TrellisKerminal/issues"><img src="https://img.shields.io/github/issues/Zhiwen-Liu/TrellisKerminal?style=flat-square&color=e67e22" alt="open issues" /></a>
<a href="https://github.com/Zhiwen-Liu/TrellisKerminal/pulls"><img src="https://img.shields.io/github/issues-pr/Zhiwen-Liu/TrellisKerminal?style=flat-square&color=9b59b6" alt="open PRs" /></a>
<a href="https://deepwiki.com/mindfold-ai/Trellis"><img src="https://img.shields.io/badge/Ask-DeepWiki-blue?style=flat-square" alt="Ask DeepWiki" /></a>
<a href="https://chatgpt.com/?q=Explain+the+project+mindfold-ai/Trellis+on+GitHub"><img src="https://img.shields.io/badge/Ask-ChatGPT-74aa9c?style=flat-square&logo=openai&logoColor=white" alt="Ask ChatGPT" /></a>
</p>

<p align="center">
<img src="assets/trellis-demo.gif" alt="Trellis workflow demo" width="100%">
</p>

## Why Trellis?

| Capability | What it changes |
| --- | --- |
| **Auto-injected specs** | Write conventions once in `.trellis/spec/`, then let Trellis inject the relevant context into each session instead of repeating yourself. |
| **Task-centered workflow** | Keep PRDs, implementation context, review context, and task status in `.trellis/tasks/` so AI work stays structured. |
| **Project memory** | Journals in `.trellis/workspace/` preserve what happened last time, so each new session starts with real context. |
| **Team-shared standards** | Specs live in the repo, so one person's hard-won workflow or rule can benefit the whole team. |
| **Kerminal-first** | This fork evolves the Kerminal integration only — upstream Trellis supported 23 AI coding platforms up to 0.6.x (see upstream for those). |

## Prerequisites:

- **Node.js** >= 18
- **Python** >= 3.9

## Quick Start

```bash
# 1. Install the CLI from npm
npm install -g trellis-kerminal@latest

# 2. Initialize in your repo with Kerminal
trellis init --kerminal -u your-name

# 3. Open the project in Kerminal and describe your task
```

To hack on the source instead:

```bash
git clone https://github.com/Zhiwen-Liu/TrellisKerminal.git
cd TrellisKerminal
pnpm install && pnpm build
cd packages/cli && pnpm link --global   # provides `trellis` (alias `tl`)
#    the global link resolves into this clone — keep it around
```

See [Quick Start](./docs/quickstart.md) and the [Kerminal reference](./docs/kerminal.md) for setup details.

## How to Use

The workflow is simple:

1. **Describe what you want** in natural language.
2. **Brainstorm** with the AI one question at a time until the PRD is clear, then implementation begins.
3. **Let it run** — the AI calls Trellis Implement and auto-checks the result against specs, lint, type-check, and tests.
4. **Ask the agent to finish the trellis task** when the work is done or the session context fills up (Kerminal has no slash palette, so `/trellis:finish-work` becomes a plain request). Trellis archives the task and updates journals.

## How It Works

Trellis runs a 4-phase loop with auto-invoked skills and sub-agents:

1. **Plan** — `trellis-brainstorm` walks through requirements one question at a time and writes `prd.md`. Research-heavy items go to a `trellis-research` sub-agent. The result is curated specs + research files referenced from `implement.jsonl` / `check.jsonl`.
2. **Implement** — a `trellis-implement` sub-agent writes code from the PRD with the curated context auto-injected, no git commit.
3. **Verify** — a `trellis-check` sub-agent reviews the diff against specs and runs lint, type-check, and tests, self-fixing where it can.
4. **Finish** — a final check runs, then `trellis-update-spec` promotes new learnings back into `.trellis/spec/` so the next session starts smarter.

## Resources

| Need                    | Link                                     |
| ----------------------- | ---------------------------------------- |
| Install in a repo       | [Quick Start](./docs/quickstart.md)      |
| Kerminal platform model | [Kerminal Reference](./docs/kerminal.md) |

## FAQ

<details>
<summary><strong>How is Trellis different from <code>CLAUDE.md</code>, <code>AGENTS.md</code>, or <code>.cursorrules</code>?</strong></summary>

Those files are useful entry points, but they tend to become monolithic. Trellis adds scoped specs, task PRDs, workflow gates, workspace memory, and platform-aware generated files around them.

</details>

<details>
<summary><strong>Is Trellis only for Claude Code?</strong></summary>

TrellisKerminal targets [Kerminal](https://kerminal.cn/) as its only supported platform. Upstream Trellis supported 23 platforms; this distribution ships a single `trellis-kerminal` npm package.

</details>

<details>
<summary><strong>Is Trellis for solo developers or teams?</strong></summary>

Both. Solo developers use it for memory and repeatable workflow. Teams get the larger benefit: shared standards, task boundaries, and reviewable context.

</details>

<details>
<summary><strong>Do I have to write every spec file manually?</strong></summary>

No. Many teams start by letting AI draft specs from existing code and then tighten the important parts by hand. Trellis works best when you keep the high-signal rules explicit and versioned.

</details>

<details>
<summary><strong>Can teams use this without constant conflicts?</strong></summary>

Yes. Personal workspace journals stay separate per developer, while shared specs and tasks stay in the repo where they can be reviewed and improved like any other project artifact.

</details>

<details>
<summary><strong>Can I temporarily compare a project with and without Trellis?</strong></summary>

Yes. `trellis ablate` temporarily removes all supported project-owned Trellis
surfaces after creating a verified recovery transaction outside the project.
Start a fresh agent session for the comparison, then run `trellis restore` to
recover the exact prior state. Use `--dry-run` to preview either operation.
The private recovery transaction includes exact `.trellis` task, spec, and
workspace bytes, which may contain user-authored sensitive text, and is kept
until restore verifies successfully.

This is different from `trellis uninstall` (permanent removal) and
`TRELLIS_HOOKS=0` (hooks only). Ablation does not launch agents, manage
worktrees, hide Git changes, or remove the global CLI, channel logs, or host
transcripts. If a managed path changes while ablated, restore refuses all
writes until the conflict is resolved.

</details>

## Star History

[![Star History Chart](https://star-history.dera.page/svg?repos=mindfold-ai/Trellis&type=Date)](https://star-history.dera.page/#mindfold-ai/Trellis&Date)

## Community & Resources

- [Docs (Markdown)](./docs/)
- [GitHub Issues](https://github.com/Zhiwen-Liu/TrellisKerminal/issues)
- [Discord](https://discord.com/invite/tWcCZ3aRHc) (upstream community)

<p align="center">
<a href="https://github.com/Zhiwen-Liu/TrellisKerminal">TrellisKerminal</a> •
<a href="https://github.com/mindfold-ai/Trellis">Upstream Repository</a> •
<a href="./LICENSE">AGPL-3.0 License</a> •
Built by <a href="https://github.com/mindfold-ai">Mindfold</a>, fork maintained by <a href="https://github.com/Zhiwen-Liu">Zhiwen-Liu</a>
</p>
