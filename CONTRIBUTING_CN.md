# 贡献指南

感谢你对 TrellisKerminal 的关注！本文档提供参与项目贡献的指南。

TrellisKerminal 是 [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) 的 Kerminal 专用发行版：只发布单个 `trellis-kerminal` npm 包，仅支持 Kerminal 平台。所有内容都在本仓库内——没有独立的文档仓库，也没有 marketplace 子模块。

## 贡献方式

### 报告 Bug

提交 Bug 前，请先查看 [已有 Issues](https://github.com/Zhiwen-Liu/TrellisKerminal/issues) 避免重复。

报告 Bug 时请包含：
- TrellisKerminal 版本 (`trellis --version`)
- Node.js 版本 (`node --version`)
- 操作系统
- 复现步骤
- 预期行为 vs 实际行为
- 相关日志或截图

### 功能建议

欢迎提交功能请求！请开一个 Issue 并包含：
- 功能的清晰描述
- 使用场景 / 解决的问题
- 实现思路（可选）

注意：平台支持面有意限定为 Kerminal。仅对其他 AI 宿主有意义的功能通常应该提到[上游](https://github.com/mindfold-ai/Trellis)。

### 改进文档

文档改进永远受欢迎：
- 修复错别字或表述不清的地方
- 添加示例
- 改进 README 或指南文档

文档就是本仓库里的纯 Markdown：`README.md` / `README_CN.md`（两个语言版本保持同步）和 `docs/` 目录。

### 贡献代码

欢迎以下类型的代码贡献：
- Bug 修复
- 新功能（请先在 Issue 中讨论）
- 性能优化
- 测试覆盖

## 开发环境设置

### 前置要求

- Node.js 20+（CI 使用的版本）
- pnpm 10
- Python 3.9+（用于 `.trellis/` 脚本和 `packages/cli/src/templates/` 下的 Python 模板）

### 开始开发

1. **Fork 仓库** 到你的 GitHub 账号

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/TrellisKerminal.git
   cd TrellisKerminal
   ```

3. **安装依赖**
   ```bash
   pnpm install
   ```

4. **构建项目**
   ```bash
   pnpm build
   ```

### 运行检查

```bash
pnpm lint                     # TypeScript ESLint 检查 (packages/cli)
pnpm typecheck                # TypeScript 类型检查
pnpm test                     # vitest 单元 + 集成测试
pnpm -C packages/cli lint:py  # Python 脚本/模板的 basedpyright 检查
```

> **注意：** 提交时 pre-commit hook 会自动对暂存的 `.ts` 文件运行 `eslint --fix` 和 `prettier --write`。

## 项目结构

```
TrellisKerminal/
├── packages/cli/            # 唯一的可发布包 (npm: trellis-kerminal)
│   ├── src/
│   │   ├── cli/             # CLI 入口
│   │   ├── commands/        # CLI 命令 (init, update, ...)
│   │   ├── configurators/   # 平台模板应用逻辑 (kerminal.ts)
│   │   ├── core/            # 核心领域模块 (channel, task, ...)
│   │   ├── templates/       # 安装到用户项目的模板 ←
│   │   │   ├── common/      # 工作流技能、捆绑技能、入口命令
│   │   │   ├── kerminal/    # Kerminal 平台文件 (→ .kerminal/)
│   │   │   ├── trellis/     # 共享 .trellis 运行时 (scripts, workflow)
│   │   │   └── markdown/    # Spec Markdown 模板
│   │   └── utils/
│   ├── test/                # vitest 测试（含模板测试）
│   └── scripts/             # 发布与维护脚本
├── .kerminal/               # 本仓库自己的 Kerminal 集成（生成产物）
├── .agents/skills/          # 本仓库自己的工作流技能（生成产物）
├── .trellis/                # 本仓库自己的 Trellis 工作流数据
└── docs/                    # 纯 Markdown 文档
```

> **重要：** 修改生成的集成文件（`.kerminal/`、`.agents/skills/trellis-*`、
> `.trellis/workflow.md`、`.trellis/scripts/`）时，请在
> `packages/cli/src/templates/` 中修改，并通过 `trellis update` 刷新本仓库
> 自己的副本——本项目 dogfood 自己的模板。

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
type(scope): description
```

**类型：**
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档变更
- `refactor` - 代码重构
- `test` - 添加或更新测试
- `chore` - 维护任务

**示例：**
```
feat(cli): add --dry-run flag to init command
fix(kerminal): resolve context injection for spawned sub-agents
docs(readme): update quick start instructions
```

## Pull Request 流程

1. **从 `main` 创建分支**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **进行修改**，遵循提交规范

3. **确保检查通过**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```

4. **推送到你的 Fork**
   ```bash
   git push origin feat/your-feature-name
   ```

5. **向 [Zhiwen-Liu/TrellisKerminal](https://github.com/Zhiwen-Liu/TrellisKerminal) 的 `main` 分支发起 Pull Request**
   - 提供清晰的变更描述
   - 关联相关 Issue
   - UI 变更请附截图

6. **根据反馈进行修改**

## 感谢

每一份贡献都让 TrellisKerminal 变得更好。感谢你的付出！
