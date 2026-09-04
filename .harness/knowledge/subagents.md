# 内置子代理（Built-in Sub-agents）

Pi Web 集成的子代理实现是内联、隐藏的扩展，默认关闭，由全局 `~/.pi/agent/agents/settings.json` 的 `builtInEnabled` 开关控制。

## 激活与扩展优先级（ADR 0003）

内联扩展工厂常驻于每个普通（非 Chat-only）资源加载器中，使 AgentSession 重载即可启停其工具，而无需重建 wrapper；禁用时不注册任何工具。运行时还设置了守卫，在开关关闭但父会话尚未重载期间拒绝过期的 `Agent` 调用。

启用内置实现时，它优先于启用的传统 `pi-subagents` 扩展：仅当某个 legacy 扩展被其 package 路径标识为 `pi-subagents` 且注册了保留工具名（`Agent`、`get_subagent_result`、`steer_subagent`）之一时才被抑制。无关扩展绝不因为使用这些名字而被移除，SDK 仍正常报告冲突。禁用内置实现时不抑制 legacy package，用户可继续通过插件设置管理它。

## 子代理配置与输入

- 子代理持续在 JSONL 元数据的 `resourceSnapshot` 中保存其活跃工具与所属 profile 的技能/扩展加载开关，重开会话时保持一致。
- 加载的扩展不得向子代理暴露保留工具 `Agent`、`get_subagent_result`、`steer_subagent`，防止嵌套 Agent 派发。
- 子代理工具是只读的，profile 被限制在项目范围内。
- 宿主可在派发前解析 `input_files`，将其 UTF-8 文本并入委托的用户任务——这是输入准备而非子代理工具，不改变活跃工具列表或 Chat-only 系统提示。

## 侧栏层级

只有子代理才会嵌套进父会话之下（`session.relation.kind === "subagent"`，`lib/session-tree.ts::buildSessionTree()`）；普通 Fork 始终作为树根。

## 相关文件

- `lib/subagents.ts`、`lib/subagent-*.ts`：子代理运行时、settings、profile、prompt、input、extension。
- `app/api/subagents/**`：子代理信息与 settings 的 HTTP 路由。
- `components/AgentsConfig.tsx`、`AgentSessionPanel.tsx`：内置子代理开关与 profile 编辑。
- ADR：`docs/adr/0002-chat-only-tool-selection.md`、`docs/adr/0003-built-in-subagent-toggle.md`。