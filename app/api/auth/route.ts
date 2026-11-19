import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import {
  USERNAME_RE,
  cookieOptions,
  currentUser,
  hashPassword,
  SESSION_COOKIE,
  signSession,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

type Row = {
  id: string;
  username: string;
  username_norm: string;
  password_hash: string;
  nickname: string;
  owner_key: string | null;
  role?: "user" | "admin";
};

function publicUser(r: Row) {
  return {
    id: r.id,
    username: r.username,
    nickname: r.nickname,
    role: r.role === "admin" ? "admin" : "user",
  };
}

// GET /api/auth —— 读取当前登录状态（前端刷新页面时恢复会话）
export async function GET(req: NextRequest) {
  const user = await currentUser(req);
  return NextResponse.json({ user });
}

// POST /api/auth —— 登录；账户名不存在则自动注册，存在则校验密码
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const username = String(body.username || "").trim().slice(0, 20);
  const password = String(body.password || "");
  const ownerKey = String(body.owner_key || "");

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "账户名需为 2–20 个中文、字母、数字、下划线或减号" },
      { status: 400 }
    );
  }
  if (password.length < 6 || password.length > 100) {
    return NextResponse.json({ error: "密码长度需为 6–100 位" }, { status: 400 });
  }

  const sb = supabaseServer();
  const norm = username.toLowerCase();
  const { data: found, error: findErr } = await sb
    .from("users")
    .select("*")
    .eq("username_norm", norm)
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  let user: Row;
  let isNew = false;

  if (found) {
    const existing = found as Row;
    if (!verifyPassword(password, existing.password_hash)) {
      return NextResponse.json({ error: "密码错误，无法登录" }, { status: 401 });
    }
    user = existing;
  } else {
    isNew = true;
    const { data: created, error: createErr } = await sb
      .from("users")
      .insert({
        username,
        username_norm: norm,
        password_hash: hashPassword(password),
        nickname: username,
        owner_key: /^[A-Za-z0-9_-]{8,64}$/.test(ownerKey) ? ownerKey : null,
      })
      .select()
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message || "创建账户失败" },
        { status: 500 }
      );
    }
    user = created as Row;
  }

  // 旧数据自动过户：把本机匿名 key 下、尚未归属的条目挂到该账户
  if (/^[A-Za-z0-9_-]{8,64}$/.test(ownerKey)) {
    await sb
      .from("game_list")
      .update({ user_id: user.id, owner_name: username })
      .eq("owner_key", ownerKey)
      .is("user_id", null);
  }

  // 已有账户首次在新浏览器登录，也把它的 owner_key 记录到账户上（若尚未记录）
  if (!user.owner_key && /^[A-Za-z0-9_-]{8,64}$/.test(ownerKey)) {
    await sb.from("users").update({ owner_key: ownerKey }).eq("id", user.id);
  }

  // 管理员引导：若配置了 ADMIN_USERNAME 且本次登录账户名匹配，自动提升为管理员。
  // 这样即使账户已存在也能生效；未跑迁移（无 role 列）时静默跳过，不影响登录。
  const adminName = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (adminName && norm === adminName && user.role !== "admin") {
    try {
      const { data: promoted } = await sb
        .from("users")
        .update({ role: "admin" })
        .eq("id", user.id)
        .select()
        .maybeSingle();
      if (promoted) user = promoted as Row;
    } catch {
      // 忽略：数据库尚未执行 v3 迁移时无 role 列
    }
  }

  const res = NextResponse.json({ user: publicUser(user), isNew });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), cookieOptions());
  return res;
}

// DELETE /api/auth —— 退出登录
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return res;
}
