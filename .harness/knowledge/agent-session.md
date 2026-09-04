# AgentSession 与流式会话

## 生命周期

- 每个 session id 对应一个 `AgentSessionWrapper`，在 `lib/rpc-manager.ts` 中以 `globalThis.__piSessions` 注册，避免 Next.js 热更新丢失实例。
- 空闲超时为 10 分钟；并发启动共享 `globalThis.__piStartLocks` 中的启动 Promise。
- `startRpcSession()` 创建进程内 AgentSession；仅浏览历史时使用 `lib/session-reader.ts`，不得创建 AgentSession。

## Fork 与分支

- Fork 创建独立 `.jsonl` 会话文件，依赖头部 `parentSession` 作为侧栏树展示元数据。
- `AgentSession.fork()` 会原地修改 wrapper 的内部 session id；`send("fork")` 获得新 id 后必须立即销毁旧 wrapper，后续原会话请求需从文件重新加载。
- 会话内分支是同一文件中的 `navigate_tree`；切换分支读取 `/api/sessions/[id]/context?leafId=`。不要与 Fork 混淆。

## SSE 与运行状态

- 挂载 ChatWindow 时请求 `/api/agent/[id]`；若仍流式输出，自动重连 SSE，同时同步 `thinkingLevel` 与 `isCompacting`。
- 同时兼容 `compaction_start` / `compaction_end` 与旧版 `auto_compaction_start` / `auto_compaction_end`。
- `prompt_done` 结束当前 UI 阶段，但 SSE 保持 30 秒宽限以复用；不可在第一个 `agent_end` 时关闭，因为重试、压缩和扩展队列可能继续同一逻辑 prompt。
- 活跃运行期间定期请求状态，并在页面可见性变化或网络恢复时 reconciliation；使用单调 run id 忽略旧 SSE 或旧请求响应，避免恢复过期流式气泡。
- 侧栏在可见标签页中每 2.5 秒轮询 `/api/agent/running`，后台标签暂停。

## 工具调用

Pi 文件格式中 tool call 为 `{ type: "toolCall", id, name, arguments }`，UI 类型使用 `{ toolCallId, toolName, input }`。文件加载和流式事件都必须经 `normalizeToolCalls()` 归一化。

## 工具预设

新会话通过 `POST /api/agent/new` 传 `toolNames[]`。既有会话挂载后用 `get_tools` 和 `getPresetFromTools()` 推断实时预设；不能使用浏览器本地偏好覆盖。

选择“无工具”（Chat only）时传空 allow-list，并在启动、重载和资源发现后清空 `agent.state.systemPrompt`。浏览器 `localStorage` 中的工具偏好只初始化新会话。

### Chat-only 的持久化与边界（ADR 0002）

自定义工具选择的持久化经版本化 `pi-web:tool-selection` 条目写入 JSONL：

```json
{ "type": "custom", "customType": "pi-web:tool-selection", "data": { "version": 1, "tools": [] } }
```

- 最新的有效条目为准；无条目 = 旧会话，保持 Pi 默认行为；空 `tools` = Chat only；非空 = 恢复所选内置工具。
- Chat only 不加载 extensions/skills/prompt 模板/主题/Pi 基础系统提示，系统提示严格取 Pi 默认加载器发现的上下文文件（全局与项目 `AGENTS.md`、`AGENTS.override.md`、`CLAUDE.md`）的有序内容，不追加任何前缀/后缀/cwd 文本。
- 持久化的选择必须在 `createAgentSessionServices()` 之前解析，确保 Chat only 从不导入或执行会话扩展；系统提示还要在 `before_agent_start` 之后重写（SDK 在模型调用前重建基础提示）。
- 非空预设间切换可原地更新 wrapper；**跨越 Chat-only 边界必须 append 新选择并重建 wrapper**（普通 wrapper 已加载扩展，Chat-only wrapper 没有这些资源可原地启用）。
- 子代理的持久化使用自身元数据里的 `resourceSnapshot`，不复制该条目。

详见 `docs/adr/0002-chat-only-tool-selection.md`。