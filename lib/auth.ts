import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { supabaseServer } from "./supabase";

export const SESSION_COOKIE = "gw_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天免登录
// 用已有的 service_role key 作为签名密钥，避免新增需要用户配置的环境变量
const SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only-session-secret-change-me";

export type SessionUser = {
  id: string;
  username: string;
  nickname: string;
  role: "user" | "admin";
  avatar?: string | null;
  bio?: string;
};

export function isAdmin(user: SessionUser | null): user is SessionUser & { role: "admin" } {
  return user?.role === "admin";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hex] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  try {
    const a = scryptSync(password, salt, 64);
    const b = Buffer.from(hex, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function unb64url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function signSession(uid: string): string {
  const payload = b64url(
    JSON.stringify({ uid, exp: Date.now() + MAX_AGE * 1000 })
  );
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(unb64url(payload));
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return String(data.uid);
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

// 从请求 Cookie 解析当前登录用户（查库确认仍存在）
export async function currentUser(req: NextRequest): Promise<SessionUser | null> {
  const uid = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const sb = supabaseServer();
  // 先按含个人主页字段查询；尚未执行 v5 迁移（无 avatar/bio 列）时回退，避免整站登录失效
  const { data: full } = await sb
    .from("users")
    .select("id, username, nickname, role, avatar, bio")
    .eq("id", uid)
    .maybeSingle();
  if (full) return full as SessionUser;

  const { data: basic } = await sb
    .from("users")
    .select("id, username, nickname, role")
    .eq("id", uid)
    .maybeSingle();
  return (basic as SessionUser | null) || null;
}

export const USERNAME_RE = /^[\w\u4e00-\u9fa5-]{2,20}$/;
