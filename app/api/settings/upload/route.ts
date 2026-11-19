import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, COVER_BUCKET } from "@/lib/supabase";
import { currentUser, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 头图上限 5MB

function sniffExt(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  ) return "webp";
  return null;
}

// POST /api/settings/upload —— 管理员上传头图，转存 Supabase 并写入站点设置
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "仅管理员可以上传头图" }, { status: 403 });
  }

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
  if (!ext) {
    return NextResponse.json({ error: "仅支持 JPG / PNG / WebP 图片" }, { status: 400 });
  }

  const sb = supabaseServer();
  const path = `site/hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await sb.storage
    .from(COVER_BUCKET)
    .upload(path, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = sb.storage.from(COVER_BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: setErr } = await sb
    .from("site_settings")
    .update({ value: url, updated_at: new Date().toISOString() })
    .eq("key", "hero_image");
  if (setErr) {
    return NextResponse.json({ error: setErr.message }, { status: 500 });
  }

  return NextResponse.json({ url });
}
