import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// 浏览器端客户端：只做数据的增删改查，受 RLS 约束
export const supabaseBrowser = () => createClient(url, anon);

// 服务端客户端：用 service_role 绕过 RLS，仅用于把图片转存到 Storage
export const supabaseServer = () => createClient(url, service || anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const COVER_BUCKET = "game-covers";

export function isConfigured() {
  return Boolean(url && anon);
}
