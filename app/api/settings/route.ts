import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser, isAdmin } from "@/lib/auth";
import type { SiteSettings } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULTS: SiteSettings = {
  hero_image: "",
  announcement: "欢迎来到游戏墙！",
};

// GET /api/settings —— 公开读取头图与公告语
export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("site_settings")
    .select("key, value");
  if (error) {
    // 未迁移时返回默认值，避免首页报错
    return NextResponse.json(DEFAULTS);
  }
  const map: Record<string, string> = {};
  (data || []).forEach((r: { key: string; value: string }) => {
    map[r.key] = r.value;
  });
  const payload: SiteSettings = {
    hero_image: map.hero_image ?? DEFAULTS.hero_image,
    announcement: map.announcement ?? DEFAULTS.announcement,
  };
  return NextResponse.json(payload);
}

// PATCH /api/settings —— 仅管理员可写头图 / 公告语
export async function PATCH(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "仅管理员可以修改站点设置" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const updates: { key: string; value: string }[] = [];
  if (body.hero_image !== undefined) {
    const v = String(body.hero_image || "").trim();
    // 允许留空（恢复默认）、相对路径、或 http(s) 图片地址
    if (v && !/^(https?:\/\/|\/)/i.test(v)) {
      return NextResponse.json({ error: "头图地址需为 http(s) 链接或站内路径" }, { status: 400 });
    }
    updates.push({ key: "hero_image", value: v.slice(0, 2000) });
  }
  if (body.announcement !== undefined) {
    updates.push({ key: "announcement", value: String(body.announcement || "").slice(0, 500) });
  }
  if (updates.length === 0) {
    return NextResponse.json({ error: "没有需要保存的内容" }, { status: 400 });
  }

  const sb = supabaseServer();
  for (const u of updates) {
    const { error } = await sb
      .from("site_settings")
      .update({ value: u.value, updated_at: new Date().toISOString() })
      .eq("key", u.key);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
