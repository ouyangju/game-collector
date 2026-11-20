import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";
import type { Comment } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/comments?entry_id= —— 读取某条帖子的评论
export async function GET(req: NextRequest) {
  const entryId = Number(req.nextUrl.searchParams.get("entry_id"));
  if (!entryId) return NextResponse.json({ error: "参数无效" }, { status: 400 });
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("comments")
    .select("*")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data || []) as Comment[] });
}

// POST /api/comments —— 发表评论
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
  const content = String(body.content || "").trim().slice(0, 3000);
  if (!entryId || !content) {
    return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data: entry } = await sb
    .from("game_list")
    .select("id")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "帖子不存在" }, { status: 404 });

  const { data, error } = await sb
    .from("comments")
    .insert({
      entry_id: entryId,
      user_id: user.id,
      author_name: user.nickname,
      content,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data as Comment });
}

// DELETE /api/comments?id= —— 删除自己的评论
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { data: row } = await sb
    .from("comments")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row || (row as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "只能删除自己的评论" }, { status: 403 });
  }
  const { error } = await sb.from("comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
