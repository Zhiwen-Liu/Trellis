# Contributing to TrellisKerminal

Thanks for your interest in contributing to TrellisKerminal! This document provides guidelines for contributing to the project.

TrellisKerminal is the Kerminal-only distribution of [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis): a single `trellis-kerminal` npm package with Kerminal as the only supported platform. Everything lives in this one repo — there is no separate docs repo and no marketplace submodule.

## Ways to Contribute

### Reporting Bugs

Before creating a bug report, please check [existing issues](https://github.com/Zhiwen-Liu/TrellisKerminal/issues) to avoid duplicates.

When reporting a bug, include:
- TrellisKerminal version (`trellis --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or screenshots

### Suggesting Features

Feature requests are welcome! Please open an issue with:
- Clear description of the feature
- Use case / problem it solves
- Any implementation ideas (optional)

Note: the supported platform surface is intentionally limited to Kerminal. Features that only make sense for other AI hosts usually belong [upstream](https://github.com/mindfold-ai/Trellis) instead.

### Improving Documentation

Documentation improvements are always appreciated:
- Fix typos or unclear explanations
- Add examples
- Improve README or guide docs

Docs are plain Markdown in this repo: `README.md` / `README_CN.md` (keep both language versions in sync) and `docs/`.

### Contributing Code

Code contributions are welcome for:
- Bug fixes
- New features (please discuss in an issue first)
- Performance improvements
- Test coverage

## Development Setup

### Prerequisites

- Node.js 20+ (the version CI runs on)
- pnpm 10
- Python 3.9+ (for the `.trellis/` scripts and the Python templates under `packages/cli/src/templates/`)

### Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/TrellisKerminal.git
   cd TrellisKerminal
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Build the project**
   ```bash
   pnpm build
   ```

### Running Checks

```bash
pnpm lint                     # ESLint for TypeScript (packages/cli)
pnpm typecheck                # TypeScript type checking
pnpm test                     # vitest unit + integration tests
pnpm -C packages/cli lint:py  # basedpyright for Python scripts/templates
```

> **Note:** Pre-commit hooks will automatically run `eslint --fix` and `prettier --write` on staged `.ts` files.

## Project Structure

```
TrellisKerminal/
├── packages/cli/            # The only publishable package (npm: trellis-kerminal)
│   ├── src/
│   │   ├── cli/             # CLI entry point
│   │   ├── commands/        # CLI commands (init, update, ...)
│   │   ├── configurators/   # Platform template application (kerminal.ts)
│   │   ├── core/            # Core domain modules (channel, task, ...)
│   │   ├── templates/       # Templates installed into user projects ←
│   │   │   ├── common/      # Workflow skills, bundled skills, entry commands
│   │   │   ├── kerminal/    # Kerminal platform files (→ .kerminal/)
│   │   │   ├── trellis/     # Shared .trellis runtime (scripts, workflow)
│   │   │   └── markdown/    # Spec markdown templates
│   │   └── utils/
│   ├── test/                # vitest suites (incl. template tests)
│   └── scripts/             # Release + maintenance scripts
├── .kerminal/               # This repo's own Kerminal integration (generated)
├── .agents/skills/          # This repo's own workflow skills (generated)
├── .trellis/                # This repo's own Trellis workflow data
└── docs/                    # Plain-Markdown documentation
```

> **Important:** when modifying generated integration files (`.kerminal/`,
> `.agents/skills/trellis-*`, `.trellis/workflow.md`, `.trellis/scripts/`),
> make the change in `packages/cli/src/templates/` and refresh this repo's
> own copy with `trellis update` — this project dogfoods its own templates.

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(cli): add --dry-run flag to init command
fix(kerminal): resolve context injection for spawned sub-agents
docs(readme): update quick start instructions
```

## Pull Request Process

1. **Create a branch** from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** and commit following the commit guidelines

3. **Ensure quality checks pass**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```

4. **Push to your fork**
   ```bash
   git push origin feat/your-feature-name
   ```

5. **Open a Pull Request** against the `main` branch of [Zhiwen-Liu/TrellisKerminal](https://github.com/Zhiwen-Liu/TrellisKerminal)
   - Provide a clear description of changes
   - Reference any related issues
   - Include screenshots for UI changes

6. **Address review feedback** if requested

## Thank You

Every contribution helps make TrellisKerminal better. We appreciate your time and effort!
