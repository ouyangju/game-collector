/**
 * 统一的图片地址转换工具（客户端 / 服务端通用）。
 *
 * 背景：浏览器直连海外 Supabase 存储常被 RST（ERR_CONNECTION_RESET），
 * 且 Bangumi 图床有防盗链。所有远程图片统一改走本站同源代理，
 * 由服务端拉取；本地 blob/data URI 保持原样。
 */

const THUMBNAIL_PROXY = "/api/games/thumbnail";
const SUPABASE_IMG_PROXY = "/api/img";

/** 判断是否为本站的 Supabase 公开存储图片地址 */
export function isSupabaseImage(src: string): boolean {
  try {
    const u = new URL(src);
    return (
      /^https?:$/.test(u.protocol) &&
      u.hostname.endsWith(".supabase.co") &&
      u.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}

/** 判断是否为 Bangumi 图床地址 */
function isBangumiImage(src: string): boolean {
  return src.includes("lain.bgm.tv");
}

/**
 * 把远程图片地址转换为同源代理地址：
 * - Bangumi 图床 → /api/games/thumbnail（已有代理）
 * - Supabase 存储 → /api/img（新增代理，解决海外直连被重置）
 * - 本地地址（/、blob:、data:、http://localhost）→ 原样返回
 */
export function proxiedCover(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("/") || src.startsWith("blob:") || src.startsWith("data:")) return src;
  if (isBangumiImage(src)) return `${THUMBNAIL_PROXY}?url=${encodeURIComponent(src)}`;
  if (isSupabaseImage(src)) return `${SUPABASE_IMG_PROXY}?url=${encodeURIComponent(src)}`;
  return src;
}
