# Worktree 与文件访问

## 项目与 Worktree

`lib/worktree.ts` 将 linked worktree 顶层解析回主仓库 `projectRoot`，供侧栏将同一仓库的 worktree 会话归组。会话若指向已经删除的 worktree，应归回主项目而非显示为虚假项目。

worktree API 位于 `/api/worktrees`，创建位置为 `<repoRoot>-worktrees/<sanitized-branch>`：已有分支复用，否则用 `git worktree add -b` 创建。删除脏 worktree 应返回 `409 { dirty: true }`，由 UI 确认后以 `force` 重试。

Git 在 Windows 上可能输出 POSIX 风格绝对路径：从 Git 读取的路径必须先经 `toNativePath()`；路径比较必须用 `samePath()`，禁止 `===`。分支名不是路径，必须保留正斜杠。浏览器不执行 Node 路径规则，当前 worktree 的服务端身份由 API 返回，侧栏据此高亮和删除回退。

## 文件访问安全边界

`/api/files` 不是通用文件系统浏览器。允许根目录仅来自：会话 cwd、其 project root、`~/pi-cwd-*` 和显式 `allowFileRoot()` 加入的路径。

`/api/cwd/validate`、`/api/default-cwd`、`/api/worktrees` 创建可浏览位置时必须调用 `allowFileRoot()`。路径授权统一由 `lib/path-security.ts` 的 `isPathWithinRoots()` 实现：它会重新解析并做大小写无关比较；禁止复制或绕过该安全边界。