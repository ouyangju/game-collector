import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser, isAdmin, USERNAME_RE } from "@/lib/auth";
import type { Entry, Profile, ProfileResponse } from "@/lib/types";

export const runtime = "nodejs";

type UserRow = {
  id: string;
  username: string;
  username_norm: string;
  nickname: string;
  role?: "user" | "admin";
  avatar?: string | null;
  bio?: string;
  created_at: string;
};

function toProfile(r: UserRow): Profile {
  return {
    id: r.id,
    username: r.username,
    nickname: r.nickname,
    avatar: r.avatar ?? null,
    bio: r.bio ?? "",
    role: r.role === "admin" ? "admin" : "user",
    created_at: r.created_at,
  };
}

// GET /api/profile?user_id= —— 公开读取某人主页（资料 + 他发过的全部内容）。不带 user_id 则返回当前登录者。
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const uid = req.nextUrl.searchParams.get("user_id");

  let targetId = uid;
  if (!targetId) {
    const me = await currentUser(req);
    if (!me) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    targetId = me.id;
  }

  const { data: row, error: userErr } = await sb
    .from("users")
    .select("id, username, username_norm, nickname, role, avatar, bio, created_at")
    .eq("id", targetId)
    .maybeSingle();
  if (userErr || !row) {
    // 未跑 v5 迁移（无 avatar/bio 列）时回退
    const fb = await sb
      .from("users")
      .select("id, username, username_norm, nickname, role, created_at")
      .eq("id", targetId)
      .maybeSingle();
    if (!fb.data) return NextResponse.json({ error: "找不到该用户" }, { status: 404 });
    return NextResponse.json({
      profile: toProfile({ ...(fb.data as UserRow), avatar: null, bio: "" }),
      entries: [],
      stats: { games: 0, thoughts: 0, likes: 0 },
    } satisfies ProfileResponse);
  }

  // 该用户的全部清单（含感想/评分），按时间倒序
  const { data: entries } = await sb
    .from("game_list")
    .select("*")
    .eq("user_id", targetId)
    .order("created_at", { ascending: false });

  // 他收到的点赞总数
  const ids = ((entries || []) as Entry[]).map((e) => e.id);
  let likes = 0;
  if (ids.length) {
    const { count } = await sb
      .from("likes")
      .select("id", { count: "exact", head: true })
      .in("entry_id", ids);
    likes = count || 0;
  }

  const list = (entries || []) as Entry[];
  const payload: ProfileResponse = {
    profile: toProfile(row as UserRow),
    entries: list,
    stats: {
      games: list.length,
      thoughts: list.filter((e) => e.thoughts?.trim()).length,
      likes,
    },
  };
  return NextResponse.json(payload);
}

// PATCH /api/profile —— 修改资料。普通用户只能改自己；管理员可用 user_id 改他人。
// 姓名字段改名后同步修改登录账户名（username / username_norm），保证"显示名 = 登录名"。
export async function PATCH(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const targetId = body.user_id ? String(body.user_id) : user.id;
  if (targetId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "只能修改自己的资料" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  let newLoginName: string | null = null;

  if (body.nickname !== undefined) {
    const name = String(body.nickname || "").trim().slice(0, 20);
    if (!USERNAME_RE.test(name)) {
      return NextResponse.json(
        { error: "姓名需为 2–20 个中文、字母、数字、下划线或减号" },
        { status: 400 }
      );
    }
    const norm = name.toLowerCase();
    const sbCheck = supabaseServer();
    const { data: other } = await sbCheck
      .from("users")
      .select("id")
      .eq("username_norm", norm)
      .maybeSingle();
    if (other && (other as { id: string }).id !== targetId) {
      return NextResponse.json({ error: "这个姓名已被别人使用，请换一个" }, { status: 409 });
    }
    patch.nickname = name;
    patch.username = name;
    patch.username_norm = norm;
    newLoginName = name;
  }
  if (body.avatar !== undefined) {
    const v = String(body.avatar || "").trim();
    if (v && !/^(https?:\/\/|\/)/i.test(v)) {
      return NextResponse.json({ error: "头像地址需为 http(s) 链接或站内路径" }, { status: 400 });
    }
    patch.avatar = v.slice(0, 2000) || null;
  }
  if (body.bio !== undefined) {
    patch.bio = String(body.bio || "").slice(0, 200);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "没有需要保存的内容" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("users")
    .update(patch)
    .eq("id", targetId)
    .select("id, username, username_norm, nickname, role, avatar, bio, created_at")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "这个姓名已被别人使用，请换一个" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: toProfile((data || { ...patch, id: targetId }) as UserRow), newLoginName });
}
