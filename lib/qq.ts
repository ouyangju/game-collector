// QQ 昵称/头像查询：全部在服务端完成，前端不直连第三方。
// 头像始终用腾讯官方 qlogo 地址按 QQ 号拼出（稳定），再由调用方转存到自有 Storage；
// 昵称用公开接口查询，多个来源依次尝试，取到非空真实昵称即止。
// 出于隐私，QQ 号本身不写入数据库，只把查到的昵称/头像写进用户资料。

export function isValidQQ(qq: string): boolean {
  return /^[1-9]\d{4,10}$/.test(qq);
}

export function qqAvatarUrl(qq: string, size = 640): string {
  return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=${size}`;
}

type NickSource = {
  name: string;
  url: (qq: string) => string;
  parse: (text: string) => string;
};

function jsonField(name: string): (text: string) => string {
  return (text) => {
    try {
      const j = JSON.parse(text);
      const v =
        j?.data?.name ??
        j?.data?.nickname ??
        j?.name ??
        j?.nickname ??
        "";
      return typeof v === "string" ? v : "";
    } catch {
      return "";
    }
  };
}

const NICK_SOURCES: NickSource[] = [
  { name: "kit9", url: (q) => `https://apis.kit9.cn/api/qq_material/api.php?qq=${q}`, parse: jsonField("kit9") },
  { name: "laolibab", url: (q) => `https://www.laolibab.cn/public/api/qq_api.php?qq=${q}`, parse: jsonField("laolibab") },
  { name: "bugpk", url: (q) => `https://api.bugpk.com/api/qq_info?qq=${q}`, parse: jsonField("bugpk") },
  { name: "apizero", url: (q) => `https://v1.apizero.cn/api/qq?qq=${q}`, parse: jsonField("apizero") },
];

function cleanNickname(raw: string): string {
  // 去掉常见的占位昵称与空白；截断到合理长度
  const v = raw.trim().replace(/\s+/g, " ");
  if (!v) return "";
  if (/^(QQ用户|qq用户|这个人很懒|该用户很懒|用户\d+|默认昵称)$/i.test(v)) return "";
  return v.slice(0, 32);
}

/** 查询昵称；全部失败返回空串（前端可让用户手动填名字）。 */
export async function fetchQQNickname(qq: string): Promise<{ nickname: string; source: string }> {
  for (const src of NICK_SOURCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(src.url(qq), {
        signal: controller.signal,
        headers: { Accept: "application/json,text/plain,*/*", "User-Agent": "Mozilla/5.0 (compatible; GameWall/1.0)" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const text = await res.text();
      const nick = cleanNickname(src.parse(text));
      if (nick) return { nickname: nick, source: src.name };
    } catch {
      // 换下一个来源
    } finally {
      clearTimeout(timer);
    }
  }
  return { nickname: "", source: "" };
}

function magicOk(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === "image/webp") {
    return bytes.length >= 12 &&
      [82, 73, 70, 70].every((v, i) => bytes[i] === v) &&
      [87, 69, 66, 80].every((v, i) => bytes[i + 8] === v);
  }
  return false;
}

export type QQAvatar = { bytes: Uint8Array; ext: "jpg" | "png" | "webp" };

/** 从腾讯官方 qlogo 下载头像并校验格式（≤5MB，12 秒超时）。 */
export async function fetchQQAvatar(qq: string): Promise<QQAvatar> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(qqAvatarUrl(qq, 640), {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/jpeg,image/png,image/webp", "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error("头像暂时无法下载，请稍后重试。");
    const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 5 * 1024 * 1024) throw new Error("头像文件过大。");
    if (!magicOk(buf, `image/${ext === "jpg" ? "jpeg" : ext}`)) throw new Error("头像格式不正确。");
    return { bytes: buf, ext };
  } finally {
    clearTimeout(timer);
  }
}
