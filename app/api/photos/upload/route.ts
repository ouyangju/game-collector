import { NextRequest, NextResponse } from "next/server";
import { COVER_BUCKET, supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

function sniffExt(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

// POST /api/photos/upload —— 美图上传：校验后转存 Supabase，返回公开 URL（需登录）
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

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
    return NextResponse.json({ error: "单张图片不能超过 10MB" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffExt(bytes);
  if (!ext) return NextResponse.json({ error: "仅支持 JPG / PNG / WebP 图片" }, { status: 400 });

  const sb = supabaseServer();
  const path = `photos/${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(COVER_BUCKET).upload(path, bytes, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = sb.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ url });
}
