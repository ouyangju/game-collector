import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser, isAdmin } from "@/lib/auth";
import type { Announcement, AnnouncementsResponse } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/announcements —— 公开读取：active（首页展示）与 archived（往期公告）
export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("announcements")
    .select("*")
    .order("position", { ascending: true })
    .order("id", { ascending: false });
  if (error) {
    return NextResponse.json({ active: [], archived: [] } satisfies AnnouncementsResponse);
  }
  const rows = (data || []) as Announcement[];
  return NextResponse.json({
    active: rows.filter((r) => r.status === "active"),
    archived: rows.filter((r) => r.status === "archived"),
  } satisfies AnnouncementsResponse);
}

// POST /api/announcements —— 管理员新建公告
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) return NextResponse.json({ error: "仅管理员可以管理公告" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const title = String(body.title || "").trim().slice(0, 60);
  const content = String(body.content || "").trim().slice(0, 500);
  if (!title || !content) {
    return NextResponse.json({ error: "请填写公告标题和内容" }, { status: 400 });
  }
  const sb = supabaseServer();
  const { data: maxRow } = await sb.from("announcements").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const position = ((maxRow as { position: number } | null)?.position ?? -1) + 1;
  const { data, error } = await sb
    .from("announcements")
    .insert({ title, content, status: "active", position })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// PATCH /api/announcements —— 管理员编辑内容 / 归档 / 恢复 / 排序
export async function PATCH(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) return NextResponse.json({ error: "仅管理员可以管理公告" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = String(body.title || "").trim().slice(0, 60) || "公告";
  if (body.content !== undefined) patch.content = String(body.content || "").trim().slice(0, 500);
  if (body.status !== undefined) {
    const status = body.status === "archived" ? "archived" : "active";
    patch.status = status;
    patch.archived_at = status === "archived" ? new Date().toISOString() : null;
  }
  if (body.position !== undefined) patch.position = Number(body.position) || 0;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "没有需要保存的内容" }, { status: 400 });

  const sb = supabaseServer();
  const { data, error } = await sb.from("announcements").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// DELETE /api/announcements?id= —— 管理员删除公告
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) return NextResponse.json({ error: "仅管理员可以管理公告" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from("announcements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
