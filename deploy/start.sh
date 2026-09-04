#!/usr/bin/env bash
#
# Pi Web 远程控制服务器 — 启动/更新脚本（幂等）
# 用法（先手动 git pull 到最新，然后在仓库根执行）:
#   sudo bash deploy/start.sh [你的域名]
#
# 特性：
#   - 无论服务是否在运行、是否首次部署，都可直接运行；
#   - 自动：校验 Node、安装依赖、构建、写 systemd 服务、启用并(重)启动；
#   - 若依赖或构建失败，会停下并保留旧服务，不会破坏正在运行的服务。
set -Eeuo pipefail

# ---------- 可调参数 ----------
RUN_USER="${PI_WEB_USER:-pi-web}"
DOMAIN="${1:-agent.example.com}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE=/etc/pi-web/pi-web.env
SERVICE=pi-web.service

echo "==> 0/6 校验 Node (要求 >= v22)"
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 未检测到 node。请先安装 Node.js >= 22（见 README）。" >&2
  exit 1
fi
NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "ERROR: 当前 Node v$NODE_MAJOR < 22，请升级。" >&2
  exit 1
fi
echo "  OK: $(node -v)"

# 若任一阶段失败，提示旧服务未受影响。
trap 'echo; echo "FAILED: 更新未完成。如服务原本在运行，旧版本仍在运行。" >&2' ERR

echo "==> 1/6 创建系统账户 '$RUN_USER'（若不存在）"
if ! id "$RUN_USER" >/dev/null 2>&1; then
  useradd -r -m -s /usr/sbin/nologin "$RUN_USER"
fi

echo "==> 2/6 安装依赖（npm，含 node-pty/web-push 原生编译）"
cd "$APP_DIR"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "==> 3/6 构建生产版本"
npm run build

echo "==> 4/6 准备环境文件（权限 600）"
mkdir -p /etc/pi-web
# 若仓库根存在 .env，则以它为唯一权威源，每次都整体同步到 /etc/pi-web/pi-web.env，
# 这样无论改了哪个变量都能生效。没有 .env 时才保留旧 env 或首次自动生成。
if [ -f "$APP_DIR/.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$APP_DIR/.env"; set +a
  echo "  已从 $APP_DIR/.env 读取配置，将整体同步到 $ENV_FILE。"
fi
PW="${PI_WEB_PASSWORD:-}"
DOMAIN="${PI_WEB_ALLOWED_HOSTS:-$DOMAIN}"
AUTH_USER="${PI_WEB_USERNAME:-pi}"
PORT="${PORT:-30141}"

if [ -f "$APP_DIR/.env" ]; then
  # .env 存在 -> 整体重写，任何变量改动都生效。
  : > "$ENV_FILE"
  printf 'PI_WEB_PASSWORD=%s\nPI_WEB_ALLOWED_HOSTS=%s\nPI_WEB_USERNAME=%s\nPORT=%s\n' \
    "$PW" "$DOMAIN" "$AUTH_USER" "$PORT" >> "$ENV_FILE"
  if [ -n "$PW" ]; then
    echo "  已用 .env 更新配置（密码按你在 .env 中的设置）。"
  else
    echo "  注意：.env 未设置 PI_WEB_PASSWORD，已生成空密码占位（将无法登录）。"
  fi
elif [ -f "$ENV_FILE" ]; then
  echo "  未提供 .env 且 $ENV_FILE 已存在，保留现有配置。"
else
  # 首次部署且无 .env -> 自动生成。
  PW="$(openssl rand -base64 24 | tr -d '\n')"
  : > "$ENV_FILE"
  printf 'PI_WEB_PASSWORD=%s\nPI_WEB_ALLOWED_HOSTS=%s\nPI_WEB_USERNAME=%s\nPORT=%s\n' \
    "$PW" "$DOMAIN" "$AUTH_USER" "$PORT" >> "$ENV_FILE"
  echo "  未设置 .env，自动生成，登录用户名: $AUTH_USER，请记下仅此一次的密码："
  echo "  >>>  $PW  <<<"
fi
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> 5/6 写入 systemd 服务并启用（含开机自启）"
cat > /etc/systemd/system/$SERVICE <<EOF
[Unit]
Description=Pi Web (remote server control)
After=network.target

[Service]
User=$RUN_USER
Group=$RUN_USER
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=NODE_ENV=production
Environment=PI_WEB_NO_OPEN=1
Environment=PORT=${PORT:-30141}
ExecStart=/usr/bin/env npm start
Restart=on-failure
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=false
ReadWritePaths=/

[Install]
WantedBy=multi-user.target
EOF

chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR"

systemctl daemon-reload
# 无论服务当前是停止/运行/未安装，都收敛到：开机自启 + 立即运行最新代码。
systemctl enable ${SERVICE} >/dev/null 2>&1 || true
systemctl restart ${SERVICE}

echo "==> 6/6 状态与信息"
systemctl --no-pager --lines=15 status $SERVICE || true

echo
echo "完成。已用最新代码构建并(重新)启动，且已设置开机自启。"
echo "  浏览器打开  https://$DOMAIN ，用户名: $AUTH_USER  +  上面记录的密码"
echo "  反向代理 Nginx 参考（SSE 需关闭缓冲）:"
echo "      proxy_pass http://127.0.0.1:${PORT:-30141};"
echo "      proxy_buffering off;"
echo
echo "  常用操作:"
echo "      systemctl status pi-web     # 查看状态/日志"
echo "      journalctl -u pi-web -f     # 实时日志"
echo "      systemctl restart pi-web    # 重启"
trap - ERR