import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";
import type { Entry, EntriesResponse, SessionUser } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/entries —— 读取所有清单 + 社交统计 + 当前登录用户
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const user = await currentUser(req);

  const { data, error } = await sb
    .from("game_list")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((data || []) as Entry[]).map((e) => ({
    ...e,
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
  }));

  // 聚合点赞数 / 评论数（表小，直接全量取，避免 N+1）
  const [{ data: likes }, { data: comments }] = await Promise.all([
    sb.from("likes").select("entry_id, user_id"),
    sb.from("comments").select("entry_id"),
  ]);
  const likeCount = new Map<number, number>();
  const commentCount = new Map<number, number>();
  const likedSet = new Set<number>();
  (likes || []).forEach((l: { entry_id: number; user_id: string }) => {
    likeCount.set(l.entry_id, (likeCount.get(l.entry_id) || 0) + 1);
    if (user && l.user_id === user.id) likedSet.add(l.entry_id);
  });
  (comments || []).forEach((c: { entry_id: number }) => {
    commentCount.set(c.entry_id, (commentCount.get(c.entry_id) || 0) + 1);
  });
  items.forEach((e) => {
    e.like_count = likeCount.get(e.id) || 0;
    e.comment_count = commentCount.get(e.id) || 0;
    e.liked_by_me = likedSet.has(e.id);
  });

  const payload: EntriesResponse = { items, user };
  return NextResponse.json(payload);
}

// 判断一条记录是否属于当前用户（新数据按 user_id，未过户的旧数据按 owner_key）
function ownsEntry(
  row: { user_id: string | null; owner_key: string },
  user: SessionUser,
  ownerKey: string
): boolean {
  if (row.user_id) return row.user_id === user.id;
  return row.owner_key === ownerKey;
}

// POST /api/entries —— 新增一条（必须登录）
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const ownerKey = String(body.owner_key || "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(ownerKey)) {
    return NextResponse.json({ error: "身份标识无效" }, { status: 400 });
  }
  const subjectId = Number(body.subject_id);
  const title = String(body.title || "").slice(0, 120);
  if (!subjectId || !title) {
    return NextResponse.json({ error: "游戏信息不完整" }, { status: 400 });
  }

  const sb = supabaseServer();
  const row = {
    owner_key: ownerKey,
    user_id: user.id,
    owner_name: user.nickname,
    subject_id: subjectId,
    title,
    cover: body.cover ? String(body.cover) : null,
    cover_source: body.cover_source ? String(body.cover_source) : null,
    platform: body.platform ? String(body.platform) : null,
    air_date: body.air_date ? String(body.air_date) : null,
    bangumi_rating: body.bangumi_rating ? String(body.bangumi_rating) : null,
    thoughts: String(body.thoughts || "").slice(0, 2000),
    my_score:
      body.my_score == null
        ? null
        : Math.max(1, Math.min(5, Number(body.my_score))),
    play_year: Number(body.play_year) || new Date().getFullYear(),
  };

  const { data, error } = await sb.from("game_list").insert(row).select();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "这款游戏已经在你的清单里了" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data?.[0] });
}

// PATCH /api/entries —— 更新感想/评分（仅自己的条目）
export async function PATCH(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const ownerKey = String(body.owner_key || "");
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { data: current } = await sb
    .from("game_list")
    .select("user_id, owner_key")
    .eq("id", id)
    .maybeSingle();
  if (!current || !ownsEntry(current as never, user, ownerKey)) {
    return NextResponse.json({ error: "只能修改自己的条目" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (body.thoughts !== undefined) patch.thoughts = String(body.thoughts).slice(0, 2000);
  if (body.my_score !== undefined) {
    patch.my_score =
      body.my_score == null
        ? null
        : Math.max(1, Math.min(5, Number(body.my_score)));
  }
  const { data, error } = await sb
    .from("game_list")
    .update(patch)
    .eq("id", id)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data?.[0] });
}

// DELETE /api/entries?id=&owner_key=
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  const ownerKey = String(req.nextUrl.searchParams.get("owner_key") || "");
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { data: current } = await sb
    .from("game_list")
    .select("user_id, owner_key")
    .eq("id", id)
    .maybeSingle();
  if (!current || !ownsEntry(current as never, user, ownerKey)) {
    return NextResponse.json({ error: "只能删除自己的条目" }, { status: 403 });
  }
  const { error } = await sb.from("game_list").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
