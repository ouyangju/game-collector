import { NextRequest, NextResponse } from "next/server";
import { fetchBangumiImage } from "@/lib/image-guard";
import { COVER_BUCKET, supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * GET /api/games/image?url=<lain.bgm.tv 封面地址>&id=<subject id>
 * 服务端拉取 Bangumi 图片 -> 校验 -> 转存到 Supabase Storage -> 返回公开 URL。
 * 这样最终展示的是自己存储上的图，避免防盗链与图片失效（对齐 buttervote 的思路）。
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") || "";
  const id = req.nextUrl.searchParams.get("id") || "unknown";
  try {
    const { bytes, contentType } = await fetchBangumiImage(rawUrl);
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${String(id).replace(/[^a-zA-Z0-9_-]/g, "")}.${ext}`;

    const sb = supabaseServer();
    const { error } = await sb.storage
      .from(COVER_BUCKET)
      .upload(path, bytes, { contentType, cacheControl: "604800", upsert: true });
    if (error) throw new Error("封面保存失败：" + error.message);

    const { data: publicData } = sb.storage.from(COVER_BUCKET).getPublicUrl(path);
    if (!publicData?.publicUrl) throw new Error("无法获取封面地址。");
    return NextResponse.json({ url: publicData.publicUrl }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "图片处理失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
