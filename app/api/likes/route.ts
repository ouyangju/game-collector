import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/likes?entry_id= —— 读取某条帖子的点赞用户（用于展示名单）
export async function GET(req: NextRequest) {
  const entryId = Number(req.nextUrl.searchParams.get("entry_id"));
  if (!entryId) return NextResponse.json({ error: "参数无效" }, { status: 400 });
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("likes")
    .select("user_id, created_at")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

// POST /api/likes —— 点赞（一人一赞，重复点则取消）
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const entryId = Number(body.entry_id);
  if (!entryId) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { data: entry } = await sb
    .from("game_list")
    .select("id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });

  const { data: existing } = await sb
    .from("likes")
    .select("id")
    .eq("entry_id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    const { error } = await sb.from("likes").delete().eq("id", (existing as { id: number }).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    liked = false;
  } else {
    const { error } = await sb
      .from("likes")
      .insert({ entry_id: entryId, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    liked = true;
  }

  const { count } = await sb
    .from("likes")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);
  return NextResponse.json({ liked, count: count || 0 });
}
