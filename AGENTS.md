# Pi Web - Development Notes

## 项目概述

Pi Web 是基于 Next.js 的 Pi Agent 会话界面，支持会话浏览、进程内 AgentSession、SSE 流式交互、模型与扩展配置、worktree 和受限文件浏览。

## 快速开始与验证

```bash
npm run dev   # port 30141

# 快速迭代
npm run lint && npm run typecheck

# 提交前必跑：lint + typecheck + layer + dup
npm run check
```

- `npm run check:layer`：分层依赖门禁，规则与设计意图见 `.harness/specs/architecture/boundaries.md`。
- `npm run check:dup`：jscpd 重复代码门禁；阈值为 8%，配置位于 `.jscpd.json`。
- `npm test` 现有约 35 个与最新源码结构漂移有关的既有失败；修复前不要以 `npm run check:full` 作为提交门禁。
- **开发期间禁止运行 `next build`**：它会污染 `.next/` 并破坏 `npm run dev`。
- eslint 的 `no-magic-numbers` 为报告级 warn

## 知识导航

| 需要处理… | 查阅 |
|---|---|
| 分层设计、依赖方向和 API 边界 | `.harness/specs/architecture/boundaries.md` |
| AgentSession 生命周期、SSE、Fork、工具预设 | `.harness/knowledge/agent-session.md` |
| JSONL 会话格式、分支上下文或导出 | `.harness/knowledge/session-format.md` |
| 模型选择、`enabledModels`、OAuth 或 API Key | `.harness/knowledge/model-configuration.md` |
| worktree、Windows 路径或文件访问安全 | `.harness/knowledge/worktrees-and-files.md` |
| Pi package 插件或技能 | `.harness/knowledge/extensions.md` |
| React 组件、hooks、音效或 CSS 变量 | `.harness/knowledge/frontend-ui.md` |

## 代码导航

```text
app/api/       HTTP 路由：会话、agent、auth、模型、文件、worktree、扩展
lib/           SDK 适配、会话读取、RPC 管理、路径安全与共享逻辑
components/    聊天、侧栏、配置、文件查看等 React 视图
hooks/         会话流式状态、音效、拖放、主题和响应式交互
```

关键入口：

- `lib/rpc-manager.ts`：AgentSessionWrapper、注册表与 `startRpcSession()`。
- `lib/session-reader.ts`：只读会话文件加载和上下文构建。
- `hooks/useAgentSession.ts`：消息、SSE、fork、分支导航和状态 reconciliation。
- `app/api/agent/[id]/route.ts` 与 `app/api/agent/[id]/events/route.ts`：Agent 命令与 SSE 边界。

## 硬性规则

- 保持 `components → hooks → lib` 与 `app/api → lib` 的依赖方向；由 layer check 机械验证。
- `/api/files` 只能在已授权根目录内访问；不得绕过 `lib/path-security.ts`。
- 对 Git 返回的 Windows 路径使用 `toNativePath()` 和 `samePath()`，不得直接用 `===` 比较。
- 文件浏览是只读的；浏览历史不得创建 AgentSession。


## Ponytail 开发原则

Be a lazy senior developer: efficient, not careless. The best code is code never written.

Understand the task and trace the affected flow first. Then stop at the first rung that applies:

1. Don't build it (YAGNI).
2. Reuse existing project code or patterns.
3. Use the standard library.
4. Use platform features.
5. Use installed dependencies.
6. Make it one line if possible.
7. Otherwise, write the smallest working change.

Fix root causes, not symptoms: check every caller and repair shared behavior once.

- No unrequested abstractions, dependencies, or boilerplate.
- Prefer deletion, boring code, and fewer files.
- Choose the smallest *correct* diff, not merely the shortest one.
- Challenge complex requests: does an existing solution cover the need?
- When equally small, prefer the edge-case-correct standard approach.
- Mark intentional shortcuts with `ponytail:` plus their ceiling and upgrade path.

Never be lazy about understanding, trust-boundary validation, data-loss prevention, security, accessibility, hardware calibration, or explicit requirements. Non-trivial logic needs one small runnable check; trivial one-liners do not.
