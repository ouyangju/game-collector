import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/photos/like —— 点赞/取消（一人一赞，重复点则取消）
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const photoId = Number(body.photo_id);
  if (!photoId) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { data: photo } = await sb.from("photos").select("id").eq("id", photoId).maybeSingle();
  if (!photo) return NextResponse.json({ error: "分享不存在" }, { status: 404 });

  const { data: existing } = await sb
    .from("photo_likes")
    .select("id")
    .eq("photo_id", photoId)
    .eq("user_id", user.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    const { error } = await sb.from("photo_likes").delete().eq("id", (existing as { id: number }).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    liked = false;
  } else {
    const { error } = await sb.from("photo_likes").insert({ photo_id: photoId, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    liked = true;
  }

  const { count } = await sb
    .from("photo_likes")
    .select("id", { count: "exact", head: true })
    .eq("photo_id", photoId);
  return NextResponse.json({ liked, count: count || 0 });
}
