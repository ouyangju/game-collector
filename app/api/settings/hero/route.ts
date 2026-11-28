import { NextRequest, NextResponse } from "next/server";
import { COVER_BUCKET, supabaseServer } from "@/lib/supabase";
import { currentUser, isAdmin } from "@/lib/auth";
import type { HeroResponse } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

function sniffExt(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => buf[i] === v)) return "png";
  if (buf.length >= 12 && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...buf.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

// GET /api/settings/hero —— 公开读取所有头图（按顺序）
export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb.from("hero_images").select("*").order("position", { ascending: true }).order("id", { ascending: true });
  if (error) return NextResponse.json({ items: [] } satisfies HeroResponse);
  return NextResponse.json({ items: data || [] } satisfies HeroResponse);
}

// POST /api/settings/hero —— 管理员上传一张新头图
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) return NextResponse.json({ error: "仅管理员可以上传头图" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffExt(bytes);
  if (!ext) return NextResponse.json({ error: "仅支持 JPG / PNG / WebP 图片" }, { status: 400 });

  const sb = supabaseServer();
  const path = `site/hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await sb.storage.from(COVER_BUCKET).upload(path, bytes, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const url = sb.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
  const { data: maxRow } = await sb.from("hero_images").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const position = ((maxRow as { position: number } | null)?.position ?? -1) + 1;
  const { data, error: insErr } = await sb.from("hero_images").insert({ url, position }).select().single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// PATCH /api/settings/hero —— 管理员调整顺序：body.order = [id, id, ...]
export async function PATCH(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) return NextResponse.json({ error: "仅管理员可以调整头图" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const order = Array.isArray(body.order) ? body.order.map(Number).filter((n) => Number.isFinite(n)) : [];
  if (!order.length) return NextResponse.json({ error: "顺序列表为空" }, { status: 400 });
  const sb = supabaseServer();
  for (let i = 0; i < order.length; i++) {
    const { error } = await sb.from("hero_images").update({ position: i }).eq("id", order[i]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/settings/hero?id= —— 管理员删除一张头图
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) return NextResponse.json({ error: "仅管理员可以删除头图" }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from("hero_images").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
