import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabase";
import type { Entry } from "@/lib/types";

export const runtime = "nodejs";

const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

// GET /api/entries —— 公开读取所有人的清单
export async function GET() {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("game_list")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data || []) as Entry[] });
}

// POST /api/entries —— 新增一条（服务端强制 owner_key 格式，防滥用）
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const ownerKey = String(body.owner_key || "");
  if (!KEY_RE.test(ownerKey)) {
    return NextResponse.json({ error: "身份标识无效" }, { status: 400 });
  }
  const row = {
    owner_key: ownerKey,
    owner_name: String(body.owner_name || "匿名群友").slice(0, 20),
    subject_id: Number(body.subject_id),
    title: String(body.title || "").slice(0, 120),
    cover: body.cover ? String(body.cover) : null,
    cover_source: body.cover_source ? String(body.cover_source) : null,
    platform: body.platform ? String(body.platform) : null,
    air_date: body.air_date ? String(body.air_date) : null,
    bangumi_rating: body.bangumi_rating ? String(body.bangumi_rating) : null,
    thoughts: String(body.thoughts || "").slice(0, 2000),
    my_score: body.my_score == null ? null : Math.max(1, Math.min(5, Number(body.my_score))),
    play_year: Number(body.play_year) || new Date().getFullYear(),
  };
  if (!row.subject_id || !row.title) {
    return NextResponse.json({ error: "游戏信息不完整" }, { status: 400 });
  }
  const sb = supabaseBrowser();
  const { data, error } = await sb.from("game_list").insert(row).select();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "这款游戏已经在你的清单里了" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data?.[0] });
}

// PATCH /api/entries —— 更新感想/评分/昵称（仅允许改自己 owner_key 的行）
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const ownerKey = String(body.owner_key || "");
  const id = Number(body.id);
  if (!KEY_RE.test(ownerKey) || !id) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const patch: Record<string, unknown> = {};
  if (body.thoughts !== undefined) patch.thoughts = String(body.thoughts).slice(0, 2000);
  if (body.my_score !== undefined) patch.my_score = body.my_score == null ? null : Math.max(1, Math.min(5, Number(body.my_score)));
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("game_list")
    .update(patch)
    .eq("id", id)
    .eq("owner_key", ownerKey)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: "只能修改自己的条目" }, { status: 403 });
  }
  return NextResponse.json({ item: data[0] });
}

// DELETE /api/entries?id=&owner_key=
export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  const ownerKey = String(req.nextUrl.searchParams.get("owner_key") || "");
  if (!KEY_RE.test(ownerKey) || !id) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from("game_list")
    .delete()
    .eq("id", id)
    .eq("owner_key", ownerKey)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ error: "只能删除自己的条目" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
