# 前端 UI 约定

## 组件职责

- `components/AppShell.tsx`：整体布局、URL 状态与标签管理。
- `components/SessionSidebar.tsx`：会话树与文件浏览器。
- `components/ChatWindow.tsx`：聊天组合与完成音效包装。
- `components/ChatInput.tsx`：输入、模型、思考等级、工具和 compact 控制。
- `components/MessageView.tsx`、`MarkdownBody.tsx`：消息与 Markdown 渲染。
- `components/BranchNavigator.tsx`、`ChatMinimap.tsx`：会话内分支和滚动缩略图。
- `components/ModelsConfig.tsx`、`PluginsConfig.tsx`、`SkillsConfig.tsx`：配置弹窗。
- `components/FileExplorer.tsx`、`FileViewer.tsx`、`TabBar.tsx`：文件与标签页。

## Hooks

`useAgentSession` 管理消息、流式 SSE、fork、导航和 reconciliation；`useAudio` 管理完成音效；其余 hooks 处理拖放、移动端断点和主题。

## 完成音效

`useAudio.ts` 使用 `localStorage` 键 `pi-sound-enabled` 保存开关，并复用一个 `AudioContext`。浏览器自动播放策略要求从用户手势解锁：ChatInput 在交互控件中调用 unlock，ChatWindow 在 `onAgentEnd` 播放提示音。

## CSS 变量

`app/globals.css` 定义：`--bg`、`--bg-panel`、`--bg-hover`、`--bg-selected`、`--border`、`--text`、`--text-muted`、`--text-dim`、`--accent`、`--user-bg`、`--tool-bg`、`--font-mono`。