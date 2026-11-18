// 免登录身份：浏览器本地生成匿名 key + 昵称（对齐最初方案）
const KEY_OWNER = "gamewall_owner_key";
const KEY_NICK = "gamewall_owner_name";

export function getOwnerKey(): string {
  if (typeof window === "undefined") return "";
  let k = localStorage.getItem(KEY_OWNER);
  if (!k) {
    k = crypto.randomUUID
      ? crypto.randomUUID()
      : "u_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    localStorage.setItem(KEY_OWNER, k);
  }
  return k;
}

export function getNick(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_NICK) || "";
}

export function setNick(name: string) {
  localStorage.setItem(KEY_NICK, name);
}

export function avatarColor(str: string): string {
  const palette = ["#D98841", "#C96F2A", "#B25E1E", "#E0A45C", "#A8541C", "#CE7E3C"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
