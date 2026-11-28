// 远程图片 URL 的安全校验与抓取：防 SSRF + 格式/大小校验。
// 用于「通过图片 URL 导入」功能，只放行公网 http(s) 图片地址。

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CONNECT_TIMEOUT = 12000;

export type UrlCheck = { ok: boolean; url?: string; error?: string };

/** 判断一个主机名/IP 是否属于内网或保留地址（防 SSRF） */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv4（含十进制/十六进制整数写法）
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && (b === 168 || b === 0)) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true; // 组播及保留
    return false;
  }
  if (/^\d+$/.test(h)) return true; // 整数形式 IP，一律拒绝
  if (h.includes(":")) return true; // IPv6 字面量，一律拒绝（含 ::1、fc00:: 等）
  return false;
}

/**
 * 校验 URL 是否为允许的公网图片地址。
 * 不解析 DNS 主机名（无法可靠防 DNS rebinding），但拦截所有常见的内网字面量地址，
 * 且禁止非标准端口、用户名密码、非 http(s) 协议，配合重定向后二次校验，风险可控。
 */
export function isPublicImageUrl(raw: string): UrlCheck {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "图片地址格式不正确" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "仅支持 http / https 图片地址" };
  }
  if (u.username || u.password) {
    return { ok: false, error: "图片地址不能包含账号密码" };
  }
  // 限制端口：只允许 80/443 或默认端口
  if (u.port && u.port !== "80" && u.port !== "443") {
    return { ok: false, error: "不支持该端口的图片地址" };
  }
  if (isBlockedHost(u.hostname)) {
    return { ok: false, error: "不允许使用内网或本地地址" };
  }
  return { ok: true, url: u.toString() };
}

function magicOk(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  }
  if (type === "image/webp") {
    return bytes.length >= 12 &&
      [82, 73, 70, 70].every((v, i) => bytes[i] === v) &&
      [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v);
  }
  return false;
}

export type RemoteImage = { bytes: Uint8Array; contentType: string; finalUrl: string };

/** 抓取远程图片：最多跟随 3 次重定向，逐次校验地址，限制大小与格式。 */
export async function fetchRemoteImage(rawUrl: string, redirects = 3): Promise<RemoteImage> {
  const check = isPublicImageUrl(rawUrl);
  if (!check.ok) throw new Error(check.error);
  const url = check.url!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        Accept: ALLOWED_TYPES.join(","),
        "User-Agent": "Mozilla/5.0 (compatible; GameWallImageImport/1.0)",
      },
    });

    // 手动跟随重定向，并对目标地址再次做安全校验
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || redirects <= 0) throw new Error("图片地址跳转次数过多或无效");
      const next = new URL(location, url).toString();
      return fetchRemoteImage(next, redirects - 1);
    }
    if (!res.ok) throw new Error("图片下载失败，请检查地址是否可访问");

    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(type)) throw new Error("该地址不是 JPG / PNG / WebP 图片");
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw new Error("图片不能超过 5MB");

    const reader = res.body?.getReader();
    if (!reader) throw new Error("图片内容为空");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("图片不能超过 5MB");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    if (!magicOk(bytes, type)) throw new Error("图片内容与格式不匹配");
    return { bytes, contentType: type, finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}
