-- ============================================================
-- 升级脚本 v5：个人主页（头像 / 个性签名）
-- Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 可重复执行（IF NOT EXISTS），不影响现有数据
-- 全新安装请用 supabase/schema.sql
-- ============================================================

-- 账户表增加头像地址与个性签名。
-- 头像存 Supabase Storage 的公开 URL（由服务端转存），留空时用姓名首字生成色块头像。
alter table public.users
  add column if not exists avatar text,
  add column if not exists bio text not null default '';

-- 说明：QQ 号仅用于"查询昵称+头像"这一次操作，服务端不落库，避免泄露群友 QQ。
-- 查询结果中的昵称/头像会写进上面的 nickname / avatar 字段，仅此而已。

-- 确认结果（可选，只读）
-- select id, username, nickname, avatar, bio from public.users order by created_at desc;
