/**
 * 判断浏览器当前访问的 Host 是否为「远程（公网）」地址。
 *
 * 用于远程部署场景下隐藏仅在本地桌面环境才有意义的 UI（例如
 * 「在系统文件管理器中打开目录」——它在服务器上弹出无头窗口，对
 * 通过公网访问的手机/电脑用户没有意义）。
 *
 * 判定规则：localhost、回环地址、私有/内网 IP（10/8, 172.16-31/12,
 * 192.168/16, ::1）视为「本地」；其余（公网域名或公网 IP）视为「远程」。
 * 该函数是纯函数且不依赖 node:net，可在浏览器前端直接使用。
 */

function isIPv4(host: string): boolean {
  const octets = host.split(".");
  if (octets.length !== 4) return false;
  return octets.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isIPv6(host: string): boolean {
  // 简化判断：包含冒号且不是 "::1" 之类的纯回环即可视为 IPv6。
  // 完整合法性校验在这里不是重点，重点是把私有可读形式排除在外。
  return host.includes(":") || /^[0-9a-fA-F:]+$/.test(host);
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  // 10/8
  if (a === 10) return true;
  // 172.16/12 - 172.31/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168/16
  if (a === 192 && b === 168) return true;
  // 127/8 (loopback)
  if (a === 127) return true;
  return false;
}

function normalizeHost(raw: string): string {
  let value = raw.trim().toLowerCase();
  // IPv6 带括号如 [::1]:30141 -> 取括号内
  const match = /^\[([^\]]+)\](?::(\d+))?$/.exec(value);
  if (match) return match[1];

  // 普通 "host:port"：仅在末尾冒号后是纯数字端口时剥离
  if (value.includes(":") && !value.includes("::")) {
    const parts = value.split(":");
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) value = parts.slice(0, -1).join(":");
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  return value;
}

export function isRemoteHost(hostname: string): boolean {
  const host = normalizeHost(hostname ?? "");
  if (!host) return false;

  if (host === "localhost") return false;
  if (host === "::1") return false; // IPv6 loopback

  if (isIPv4(host)) {
    return !isPrivateIPv4(host);
  }
  if (isIPv6(host)) {
    // 除 ::1 外，扩展的 IPv6 链路本地/唯一本地地址通常看作为公网或未指定，
    // 这里保守地视为远程，避免误判。
    return true;
  }
  // 非 IP 的域名：本地内部命名若非 localhost，则无法可靠判断，
  // 但默认一个看起来像「公网域名」的值（含点、非内网名）。这里简单处理：
  // 含点且不全是小写字母数字连字符 → 视为公网域名。
  return true;
}