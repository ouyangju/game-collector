import { NextRequest, NextResponse } from "next/server";
import { fetchBangumiImage } from "@/lib/image-guard";

export const runtime = "nodejs";

/**
 * GET /api/games/thumbnail?url=<lain.bgm.tv 封面地址>
 * 返回图片二进制（不落库），供搜索结果即时展示。走服务端代理以规避 CORS/防盗链。
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") || "";
  try {
    const { bytes, contentType } = await fetchBangumiImage(rawUrl);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
