import { NextRequest, NextResponse } from "next/server";
import { searchGames } from "@/lib/bangumi";

export const runtime = "nodejs";

// GET /api/games/search?q=关键词&page=1
// 前端只调这个自家接口，由服务端去请求 Bangumi —— 规避 CORS、保护实现细节。
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const page = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get("page") || 1)));
  if (!q.trim()) {
    return NextResponse.json({ items: [], errors: [], hasMore: false });
  }
  try {
    const result = await searchGames(q, page);
    return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "搜索失败";
    return NextResponse.json(
      { items: [], errors: [{ source: "bangumi", message }], hasMore: false },
      { status: 502 }
    );
  }
}
