import { NextRequest, NextResponse } from "next/server";
import { COVER_BUCKET, supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";
import type { Photo, PhotosResponse } from "@/lib/types";

export const runtime = "nodejs";

const PAGE_SIZE = 10;
const TZ = "Asia/Shanghai";

/** 取某时间在中国时区的日期 YYYY-MM-DD（与前端展示一致） */
function shanghaiDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 中国时区某天对应的 UTC 区间 [start, end) */
function utcRangeForDate(date: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// GET /api/photos?page=1&date=YYYY-MM-DD —— 公开读取，分页 + 日期筛选
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const user = await currentUser(req);
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const date = sp.get("date") || "";

  // 有分享的日期列表（中国时区，倒序），供前端筛选下拉
  const { data: allDates } = await sb.from("photos").select("created_at").order("created_at", { ascending: false });
  const dates = Array.from(new Set((allDates || []).map((r: { created_at: string }) => shanghaiDate(r.created_at))));

  let q = sb.from("photos").select("id, user_id, owner_name, images, caption, created_at", { count: "exact" });
  const range = utcRangeForDate(date);
  if (date && range) q = q.gte("created_at", range.start).lt("created_at", range.end);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as {
    id: number; user_id: string; owner_name: string; images: unknown; caption: string; created_at: string;
  }[];
  const total = count || 0;
  const ids = rows.map((r) => r.id);
  const uids = Array.from(new Set(rows.map((r) => r.user_id)));

  const [{ data: likes }, { data: users }] = await Promise.all([
    ids.length
      ? sb.from("photo_likes").select("photo_id, user_id").in("photo_id", ids)
      : Promise.resolve({ data: [] as { photo_id: number; user_id: string }[] }),
    uids.length
      ? sb.from("users").select("id, avatar").in("id", uids)
      : Promise.resolve({ data: [] as { id: string; avatar: string | null }[] }),
  ]);

  const likeCount = new Map<number, number>();
  const likedSet = new Set<number>();
  (likes || []).forEach((l: { photo_id: number; user_id: string }) => {
    likeCount.set(l.photo_id, (likeCount.get(l.photo_id) || 0) + 1);
    if (user && l.user_id === user.id) likedSet.add(l.photo_id);
  });
  const avatarMap = new Map<string, string | null>();
  (users || []).forEach((u: { id: string; avatar: string | null }) => avatarMap.set(u.id, u.avatar ?? null));

  const items: Photo[] = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    owner_name: r.owner_name,
    avatar: avatarMap.get(r.user_id) ?? null,
    images: Array.isArray(r.images) ? r.images.filter((x): x is string => typeof x === "string") : [],
    caption: r.caption || "",
    created_at: r.created_at,
    like_count: likeCount.get(r.id) || 0,
    liked_by_me: likedSet.has(r.id),
  }));

  const payload: PhotosResponse = {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    dates,
    user,
  };
  return NextResponse.json(payload);
}

// POST /api/photos —— 发布分享（需登录）。images 为已上传到本站存储桶的公开 URL
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const images = Array.isArray(body.images)
    ? body.images.filter((x): x is string => typeof x === "string").slice(0, 20)
    : [];
  if (!images.length) return NextResponse.json({ error: "请至少上传一张图片" }, { status: 400 });
  if (images.length > 20) return NextResponse.json({ error: "一次最多分享 20 张图片" }, { status: 400 });

  // 安全：只接受本站 Supabase 存储桶 photos/ 路径下的图片，防止外链/注入
  let supaHost = "";
  try { supaHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host; } catch { /* ignore */ }
  const prefix = `/storage/v1/object/public/${COVER_BUCKET}/photos/`;
  for (const u of images) {
    try {
      const parsed = new URL(u);
      if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
      if (supaHost && parsed.host !== supaHost) throw new Error("bad host");
      if (!parsed.pathname.startsWith(prefix)) throw new Error("bad path");
    } catch {
      return NextResponse.json({ error: "图片地址无效，请重新上传" }, { status: 400 });
    }
  }

  const caption = String(body.caption || "").trim().slice(0, 2000);
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("photos")
    .insert({ user_id: user.id, owner_name: user.nickname, images, caption })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: { id: (data as { id: number }).id } });
}

// DELETE /api/photos?id=... —— 仅管理员可删除
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "仅管理员可删除" }, { status: 403 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { error } = await sb.from("photos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
