import { NextRequest, NextResponse } from "next/server";
import { isSupabaseImage } from "@/lib/img-proxy";

export const runtime = "nodejs";

/**
 * GET /api/img?url=<Supabase 公开存储图片地址>
 *
 * 服务端代理 Supabase 图片：浏览器直连海外 Supabase 常被运营商 RST
 * （net::ERR_CONNECTION_RESET），改由服务端拉取后同源返回，并带长缓存。
 * 仅允许 *.supabase.co 的公开存储路径，防止被用作开放代理 / SSRF。
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") || "";
  if (!raw || !isSupabaseImage(raw)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const upstream = await fetch(raw, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const contentType = (upstream.headers.get("content-type") || "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      return new NextResponse(null, { status: 415 });
    }

    const bytes = await upstream.arrayBuffer();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
