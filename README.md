# Pi Web

[日本語](./README.ja.md) | [Русский](./README.ru.md)

[pi 编程智能体](https://github.com/earendil-works/pi)的本地浏览器界面。Pi Web 与 pi 共用本机配置和会话文件，可在浏览器中查找和继续对话、运行智能体、配置模型与资源，并查看项目文件。

![Pi Web 展示包含结构化 Markdown、工具调用和项目导航的 pi 会话](https://raw.githubusercontent.com/agegr/pi-web/main/docs/screenshot2.png)

## 功能

- **会话工作区**：按项目查找、继续、重命名、导出和删除对话，并查看运行状态、上下文占用、花费和压缩信息。
- **两种分支方式**：**新会话**会从较早的消息创建独立会话文件；**从此处编辑**会在当前会话内创建分支。
- **项目文件工具**：浏览和上传文件、查看 Git Diff，并预览源码、Markdown、图片、音频、PDF 和 DOCX；文件变化后会自动刷新。
- **Git worktree**：从侧边栏切换 checkout，同时把同一仓库不同 worktree 的会话归在一起。
- **网页配置**：无需离开 Pi Web，即可管理 Provider 登录和 API Key、模型、模型测试、插件包及技能。
- **英文、简体中文和繁体中文界面**：Pi Web 首次打开时跟随浏览器语言，也可从顶部栏切换语言。

## 本项目相对源项目（upstream）的增强

本仓库 fork 自 [agegr/pi-web](https://github.com/agegr/pi-web)，在源项目基础上额外提供以下能力（同一功能以源项目实现为准，fork 独有能力保留）：

- **Git 工作流深度集成**：侧边栏内联的 Git 状态、暂存与提交操作，并支持由模型**自动生成提交信息**（`git commit` 界面一键填充 conventional-commit 风格消息）。相关文件：`app/api/git/*`、`lib/commit-message.ts`。
- **目录管理**：在文件浏览器中**新建、重命名、删除目录**，并支持**在系统文件管理器中打开**选中目录。相关文件：`app/api/cwd/operations/*`、`components/DirectoryPicker.tsx`、`app/api/files/*`。
- **远程服务器控制（systemd 部署）**：把 Pi Web 作为「网页 AI 控制服务器」部署到 Linux 服务器，通过浏览器远程管理；提供现成的 `deploy/` 启动脚本、`.env` 模板与 Basic Auth 认证。详见下文「远程控制服务器」。
- **受限远程主机支持**：对不受信任/远程工作目录的识别与隔离（`lib/is-remote-host.ts`）。

其余说明与源项目保持一致，请同时阅读下方通用章节。

## 快速开始（本仓库，本地开发）

本仓库主要通过 **fork 后自行部署**使用，不对外发布 npm 包。需要 Node.js 22.19.0 或更高版本，先用 `node --version` 检查：

```bash
git clone https://github.com/yn-lo/pi-web.git
cd pi-web
npm install
npm run dev
```

服务就绪后，命令行会尝试自动打开浏览器。如果没有打开，请访问 [http://127.0.0.1:30141](http://127.0.0.1:30141)。Pi Web 默认仅监听 `127.0.0.1`。

如果尚未配置模型 Provider，请打开**模型（Models）**面板登录或添加 API Key。

仅安装前端与开发依赖够用时，也可直接用 `npm run build && npm run start` 以生产模式运行（见下文「开发」）。

> 说明：本仓库不再提供 `npx @agegr/pi-web` 式的全局一键启动；需要源项目包方式安装时，请使用上游发布版。

## 配置

端口和主机名可同时由命令行参数与环境变量指定，命令行参数优先于对应的环境变量。`--no-open` 与 `PI_WEB_NO_OPEN=1` 中任意一个都会关闭自动打开浏览器。

| 参数或环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `--port <端口>`、`-p <端口>` 或 `PORT` | 服务端口 | `30141` |
| `--hostname <主机>`、`-H <主机>` 或 `PI_WEB_HOSTNAME` | 监听主机名 | `127.0.0.1` |
| `--no-open` 或 `PI_WEB_NO_OPEN=1` | 不自动打开浏览器 | 自动打开 |
| `PI_WEB_SKIP_VERSION_CHECK=1` | 关闭 Pi Web 更新检查 | 不关闭 |
| `PI_WEB_ALLOWED_HOSTS` | 额外允许的代理或自定义主机名，多个值用逗号分隔，必须精确匹配 | 未设置 |
| `PI_WEB_PASSWORD` | 启用 HTTP Basic Auth，用户名固定为 `pi`（上游包；本仓库另支持 `PI_WEB_USERNAME`） | 不启用认证 |
| `PI_WEB_IDLE_TIMEOUT_MS` | 会话空闲超时（毫秒），最大 `2147483647`；`0` 关闭空闲关闭；非法或越界值使用默认值 | `600000`（10 分钟） |

例如（本仓库通过 npm 脚本启动，端口/主机名由脚本固定）：

```bash
npm run dev            # 开发模式，监听 127.0.0.1:30141
npm run dev:lan        # 开发模式，监听 0.0.0.0:30141（LAN/远程访问）
npm run start:lan      # 生产模式，监听 0.0.0.0:30141
```

### 远程访问

监听非回环地址会暴露一个可执行高权限操作的智能体。在可信局域网中使用时，请设置足够长的随机密码（上游包对应 `pi-web --hostname 0.0.0.0`，本仓库使用 `npm run dev:lan` 或 `npm run start:lan`，密码通过环境变量传入见下）：

```bash
PI_WEB_PASSWORD='足够长的随机密码' npm run start:lan
```

Basic Auth 不会加密传输中的密码。不要通过明文 HTTP 将 Pi Web 暴露到互联网；远程访问应使用可信反向代理提供 HTTPS，或通过可信 VPN。如果反向代理传递外部主机名，请把该名称精确加入 `PI_WEB_ALLOWED_HOSTS`。这个白名单不会改变 Pi Web 的监听地址。

## 远程控制服务器（systemd 部署）

Pi Web 可作为「网页 AI 控制服务器」运行：在服务器上部署后，通过手机或桌面浏览器远程管理这台机器。仓库 `deploy/` 下提供了现成的启动脚本与配置模板。

**拓扑：**
```
手机/浏览器 ──HTTPS──> Nginx/Caddy 反代 ──http──> Pi Web (127.0.0.1:30141)
                                                PI_WEB_PASSWORD=<强密码>
                                                PI_WEB_ALLOWED_HOSTS=<你的域名>
```

**步骤：**

1. **克隆代码并更新到最新**（在你选择的位置，例如 `/opt/pi-web`）：
   ```bash
   sudo mkdir -p /opt/pi-web && sudo chown -R $USER:$USER /opt/pi-web
   git clone https://github.com/yn-lo/pi-web.git /opt/pi-web
   cd /opt/pi-web
   git pull --ff-only origin main   # 之后每次更新都执行这条再重新启动
   ```

2. **准备手动配置**（复制模板并填入你的值）：
   ```bash
   cp deploy/.env.example .env
   vim .env   # 设置 PI_WEB_PASSWORD（必填）、PI_WEB_ALLOWED_HOSTS、PORT 等
   ```
   关键项：
   - `PI_WEB_PASSWORD`：访问密码，默认登录用户名 `pi`（可设 `PI_WEB_USERNAME` 自定义）。
   - `PI_WEB_ALLOWED_HOSTS`：你的域名（如 `pi.example.com`）。反代若保留外部 Host，必须在此列白名单，否则请求会被 403。
   - `PORT`：服务端口，需与反向代理转发端口一致（如 Nginx `proxy_pass http://127.0.0.1:5230`）。

3. **运行启动脚本**：
   ```bash
   sudo bash deploy/start.sh <你的域名>
   ```
   脚本会自动：校验 Node ≥ 22、安装依赖（`npm ci`）、构建（`npm run build`）、生成 `/etc/pi-web/pi-web.env`（权限 600）、写入并启用 `pi-web` systemd 服务。若已在 `.env` 中设置密码则使用你的密码，否则仅首次自动生成并显示一次。

   > 不在仓库根设置 `.env` 时，也可临时用环境变量传入：`sudo PI_WEB_PASSWORD='你的密码' bash deploy/start.sh <域名>`

4. **配置 HTTPS 反向代理**（Nginx 示例，SSE 需关闭缓冲）：
   ```nginx
   server {
       listen 443 ssl;
       server_name pi.example.com;
       # ssl_certificate / path...

       location / {
           proxy_pass http://127.0.0.1:5230;   # 与上面 PORT 一致
           proxy_http_version 1.1;
           proxy_set_header Host $http_host;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection $connection_upgrade;
           proxy_buffering off;                 # SSE 关键
           proxy_read_timeout 3600s;
       }
   }
   ```

5. **安全提醒（务必）**
   - 这是能执行 `bash`、读写文件的工具，访问权 ≈ 服务器控制权。
   - 密码务必强随机（`openssl rand -base64 24`）；只走 HTTPS。
   - 通过 `systemctl status pi-web` 查看状态，`journalctl -u pi-web -f` 查看日志，`systemctl restart pi-web` 重启。
   - 部署文件的说明与调参：见 `deploy/.env.example`。

## HTTP 代理

服务端的模型和 API 请求会读取标准的 `HTTP_PROXY`、`HTTPS_PROXY` 和 `NO_PROXY` 环境变量。

macOS 或 Linux：

```bash
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1 \
npm run dev
```

Windows PowerShell：

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:NO_PROXY = "localhost,127.0.0.1"
npm run dev
```

## 注意事项

- **智能体数据**：Pi Web 默认读取 `~/.pi/agent` 下的 pi 数据，包括 `sessions/<编码后的工作目录>/<时间戳>_<uuid>.jsonl` 中的会话文件。可通过 `PI_CODING_AGENT_DIR` 指定其他 pi agent 目录。
- **文件系统访问**：Pi Web 必须能读取智能体数据目录及会话记录中的工作目录。与现有 pi 会话共用数据时，请让 Pi Web 运行在与 pi 相同的文件系统环境中。
- **共享配置**：模型面板使用 pi 的模型、设置和凭据存储，因此两种界面都能看到相关更改。
- **文件访问边界**：文件浏览器仅能访问在 Pi Web 中选择过的工作目录，以及它已识别的项目或会话根目录；它不是通用的文件系统浏览器。
- **Git worktree**：切换器何时显示、如何创建 worktree，以及删除会产生什么影响，见 [Pi Web 里的 Worktree](./docs/worktrees.zh-CN.md)。

### 下游会话右键菜单

Electron 封装及其他下游集成可以在不打补丁 `SessionSidebar` 的情况下，为会话行提供右键菜单。监听可取消的 `pi-web:session-row-contextmenu` 浏览器事件，并在集成将处理它时同步调用 `preventDefault()`：

```js
window.addEventListener("pi-web:session-row-contextmenu", (event) => {
  event.preventDefault();
  const { id, path, cwd, name, clientX, clientY, refresh } = event.detail;

  void openSessionMenu({ id, path, cwd, name, clientX, clientY }).then((changed) => {
    if (changed) refresh();
  });
});
```

`detail` 对象包含 `id`、`path`、`cwd`、可选的 `name`、指针坐标，以及一个用于会话列表变更后的 `refresh()` 回调。若没有监听者取消该扩展事件，Pi Web 保留浏览器原生右键菜单。此钩子位于浏览器侧，独立于 Pi agent 扩展。

### Extension Session Liveness（扩展会话保活）

Server-side Pi extensions with detached work can prevent automatic idle
session eviction through the versioned global registry:

```js
const liveness = globalThis[Symbol.for("@agegr/pi-web/session-liveness/v1")];
const release = liveness?.version === 1
  ? liveness.register({
      name: "my-extension",
      sessionId,
      sessionFile: sessionFile || undefined,
      isActive: () => detachedJobs.size > 0,
    })
  : () => {};
```

Register once per active extension session and call the returned idempotent
`release` function on session shutdown, replacement, or reload. `isActive`
must be synchronous, cheap, and scoped to the supplied exact session id or
file. Provider errors fail safe by preserving that session. This lease only
affects automatic idle eviction; explicit shutdown and Stop fallback cleanup
still take precedence.

## 开发

```bash
npm install
npm run dev
```

开发服务器运行在 [http://127.0.0.1:30141](http://127.0.0.1:30141)。常用检查命令：

```bash
npm test
node_modules/.bin/tsc --noEmit
npm run lint
```

日常开发时不要运行 `next build` 或 `npm run build`。它们会写入 `.next/`，可能干扰开发服务器；仅在发布流程中执行构建。

贡献者文档：[国际化](./docs/i18n.md)和[发布流程](./docs/release.md)。

## 仓库结构

```text
app/             Next.js 界面和 API 路由
components/      React 界面组件
hooks/           客户端状态和交互 hooks
lib/             会话、智能体、模型、文件、Git 和安全逻辑
public/          静态资源和 PWA 文件
bin/             npm CLI 入口及启动参数解析
deploy/          远程服务器部署脚本与配置模板
docs/            面向用户和贡献者的专题文档
```

架构说明和详细文件地图见 [AGENTS.md](./AGENTS.md)。

## 许可证

[MIT](./LICENSE)