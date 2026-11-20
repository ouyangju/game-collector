import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";

// 临时诊断接口：只回传环境变量的"配置状态 / JWT role / 长度"，绝不回传密钥明文。
// 用途：区分"变量没注入运行时"与"变量值填错"。排查完可删除本文件。
function jwtRole(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function safeHost(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return raw ? "(无效 URL)" : "(未配置)";
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // 用 service_role 客户端实际查一次 users 表，直接验证运行时是否真有权限
  let usersQuery: { ok: boolean; detail: string } = { ok: false, detail: "未执行" };
  try {
    const sb = supabaseServer();
    const { error } = await sb.from("users").select("id").limit(1);
    usersQuery = error
      ? { ok: false, detail: `${error.code || ""} ${error.message}`.trim() }
      : { ok: true, detail: "service_role 客户端可读取 users 表" };
  } catch (e) {
    usersQuery = { ok: false, detail: e instanceof Error ? e.message : "查询异常" };
  }

  // 对照：anon 客户端查 users（预期被拒）
  let anonQuery: { ok: boolean; detail: string } = { ok: false, detail: "未执行" };
  try {
    if (url && anon) {
      const anonSb = createClient(url, anon, { auth: { persistSession: false } });
      const { error } = await anonSb.from("users").select("id").limit(1);
      anonQuery = error
        ? { ok: false, detail: `${error.code || ""} ${error.message}`.trim() }
        : { ok: true, detail: "anon 竟可读 users（RLS 异常）" };
    }
  } catch (e) {
    anonQuery = { ok: false, detail: e instanceof Error ? e.message : "查询异常" };
  }

  return NextResponse.json({
    runtime: "nodejs",
    url: { configured: Boolean(url), host: safeHost(url) },
    anon: { configured: Boolean(anon), role: jwtRole(anon), length: anon.length },
    service: { configured: Boolean(service), role: jwtRole(service), length: service.length },
    usersQueryWithServiceRole: usersQuery,
    usersQueryWithAnon: anonQuery,
  });
}
