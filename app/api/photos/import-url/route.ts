import { NextRequest, NextResponse } from "next/server";
import { COVER_BUCKET, supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";
import { isPublicImageUrl, fetchRemoteImage } from "@/lib/remote-image";

export const runtime = "nodejs";

/**
 * POST /api/photos/import-url —— 通过图片 URL 导入（需登录）
 * 服务端抓取图片 -> 校验 -> 转存到本站 Supabase photos/ 路径 -> 返回公开 URL。
 * 只接受公网 http(s) 图片地址，带 SSRF 防护与重定向后二次校验。
 */
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const rawUrl = String(body.url || "").trim();
  if (!rawUrl) return NextResponse.json({ error: "请输入图片地址" }, { status: 400 });

  // SSRF 防护：只放行公网 http(s) 图片地址
  const checked = isPublicImageUrl(rawUrl);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  try {
    const { bytes, contentType, finalUrl } = await fetchRemoteImage(checked.url!);
    // 重定向后的地址要再次校验，防止跳转到内网
    if (finalUrl !== checked.url) {
      const recheck = isPublicImageUrl(finalUrl);
      if (!recheck.ok) return NextResponse.json({ error: "图片地址跳转到了不允许的地址" }, { status: 400 });
    }
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `photos/${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const sb = supabaseServer();
    const { error } = await sb.storage.from(COVER_BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: "604800",
      upsert: false,
    });
    if (error) return NextResponse.json({ error: "图片保存失败：" + error.message }, { status: 500 });

    const url = sb.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "图片导入失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
