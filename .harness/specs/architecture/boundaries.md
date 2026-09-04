# Pi Web 分层架构

## 设计意图

Pi Web 是基于 Next.js 的 Pi Agent 会话界面。分层使浏览器交互、服务端 API、会话运行时和通用领域逻辑各自独立，避免客户端代码依赖 Node/SDK 能力，也避免通用逻辑反向依赖 UI 或路由层。

## 依赖方向

```text
components → hooks → lib
app/api → lib
```

- `lib/`：共享领域逻辑、SDK 适配和服务端基础能力；不得依赖 `hooks/`、`components/` 或 `app/api/`。
- `hooks/`：浏览器状态与交互编排；不得依赖 `components/` 或 `app/api/`。
- `components/`：视图渲染和用户交互；不得直接依赖 `app/api/`，通过 hooks 或 `lib/agent-client.ts` 访问接口。
- `app/api/`：HTTP 边界，负责请求/响应适配，业务逻辑下沉至 `lib/`。

具体依赖限制由 `.harness/scripts/layer-check.mjs` 强制执行。
