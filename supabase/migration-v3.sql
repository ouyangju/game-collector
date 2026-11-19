-- ============================================================
-- 升级脚本 v3：管理员角色 + 站点设置（头图 / 公告语）
-- Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 可重复执行（IF NOT EXISTS），不影响现有数据
-- 全新安装请用 supabase/schema.sql
-- ============================================================

-- 1) 账户表增加角色字段：user（普通）/ admin（管理员）
alter table public.users
  add column if not exists role text not null default 'user';
-- 只允许 user / admin 两种值
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('user', 'admin'));

-- 2) 站点设置表：key-value 结构，存头图地址与公告语
--    只开放 select 给前台；写入全部走服务端 API（service_role 绕过 RLS）
create table if not exists public.site_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);
alter table public.site_settings enable row level security;
grant select on table public.site_settings to anon, authenticated;
revoke insert, update, delete on table public.site_settings from anon, authenticated;
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);

-- 3) 初始化默认设置（已存在则不动）
insert into public.site_settings (key, value) values
  ('hero_image', ''),
  ('announcement', '欢迎来到游戏墙！搜一搜、记一记，把今年玩过的好游戏和心得分享给大家～')
on conflict (key) do nothing;

-- 4) 头图存储桶（公开读）。与封面桶共用 game-covers，头图放在 site/ 路径下
--    若 game-covers 桶不存在则创建（全新库场景）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-covers', 'game-covers', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ============================================================
-- 5) 把某个账户设为管理员（重要！把 '你的账户名' 换成你注册时用的账户名）
--    账户名不区分大小写，脚本里用小写即可。执行后重新登录生效。
--
--    update public.users set role = 'admin' where username_norm = '你的账户名';
--
--    查看当前所有账户与角色：
--    select username, nickname, role from public.users order by created_at;
-- ============================================================
