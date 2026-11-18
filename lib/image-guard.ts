// 图片地址白名单 + 内容校验，防止 SSRF 和伪装文件。
// 对齐 buttervote 的做法：只接受 Bangumi 官方图床 lain.bgm.tv 的封面路径。

export function isValidBangumiCover(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password || u.port || u.hash) return false;
    // Bangumi 封面查询参数只允许 ?r=数字（用于破缓存）
    if (u.search && !/^\?r=\d{1,16}$/.test(u.search)) return false;
    if (u.hostname !== "lain.bgm.tv") return false;
    // 封面路径形如 /pic/cover/l/xx/xx/xxxx.jpg，可选 /r/窄宽度 前缀
    if (!/^\/(?:r\/\d{1,4})?\/pic\/cover\/[\w/-]+\.(?:jpe?g|png|webp)$/i.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

function magicOk(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  }
  if (type === "image/webp") {
    return (
      bytes.length >= 12 &&
      [82, 73, 70, 70].every((v, i) => bytes[i] === v) &&
      [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v)
    );
  }
  return false;
}

export type FetchedImage = { bytes: Uint8Array; contentType: string };

/** 从 Bangumi 下载图片并校验格式/大小（最大 10MB），带 12 秒超时。 */
export async function fetchBangumiImage(rawUrl: string): Promise<FetchedImage> {
  if (!isValidBangumiCover(rawUrl)) throw new Error("图片地址无效。");
  const MAX = 10 * 1024 * 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(rawUrl, {
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: { Accept: "image/jpeg,image/png,image/webp", "User-Agent": UA() },
    });
    if (!res.ok) throw new Error("图片暂时无法下载，请稍后重试。");
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("仅支持 JPG、PNG、WebP 图片。");
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX) throw new Error("图片超过 10MB 限制。");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("图片内容为空。");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX) {
        await reader.cancel();
        throw new Error("图片超过 10MB 限制。");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    if (!magicOk(bytes, type)) throw new Error("图片内容与格式不匹配。");
    return { bytes, contentType: type };
  } finally {
    clearTimeout(timer);
  }
}

function UA() {
  return process.env.BANGUMI_UA || "GameCollector/1.0 (https://example.com; contact@example.com)";
}
