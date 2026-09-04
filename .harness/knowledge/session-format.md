# Pi 会话文件与浏览

## 存储格式

会话位于 `~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl`。首行是 session 头，后续条目包括 `model_change`、`message`、`compaction` 和 `session_info`。

```jsonl
{"type":"session","version":3,"id":"<uuid>","timestamp":"...","cwd":"/path","parentSession":"/abs/path/to/parent.jsonl"}
{"type":"message","id":"<8hex>","parentId":"<8hex>","message":{"role":"user","content":"..."}}
{"type":"compaction","id":"<8hex>","parentId":"<8hex>","summary":"...","firstKeptEntryId":"<8hex>","tokensBefore":0}
```

`parentSession` 只用于展示 Fork 关系，不参与聊天内容；需要级联重设子会话时可完整重写文件。

## 上下文映射

`SessionContext.entryIds[]` 与 `messages[]` 平行，映射每条显示消息对应的 JSONL entry id，用于 fork 和 `navigate_tree`。读取逻辑集中在 `lib/session-reader.ts`，通过 SDK 的 `SessionManager` helper 访问。