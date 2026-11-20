-- ============================================================
-- 升级脚本 v6：自定义游戏 / 多张头图 / 多条公告（含往期）
-- Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 可重复执行（IF NOT EXISTS / DROP IF EXISTS），不影响现有数据
-- 全新安装请用 supabase/schema.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 游戏清单：允许"自定义上传"的游戏（没有 Bangumi subject_id）
alter table public.game_list
  add column if not exists source text not null default 'bangumi';
alter table public.game_list
  alter column subject_id drop not null;
-- subject_id 为空时唯一约束不生效（Postgres 允许多个 NULL），自定义游戏可正常添加

-- 2) 头图表：可上传多张，按 position 顺序自动轮播
create table if not exists public.hero_images (
  id         bigint generated always as identity primary key,
  url        text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists hero_images_position_idx on public.hero_images (position, id);
alter table public.hero_images enable row level security;
grant select on table public.hero_images to anon, authenticated;
revoke insert, update, delete on table public.hero_images from anon, authenticated;
drop policy if exists hero_images_read on public.hero_images;
create policy hero_images_read on public.hero_images for select to anon, authenticated using (true);

-- 3) 公告表：status=active 显示在首页公告栏，archived 为往期公告（点按钮查看）
create table if not exists public.announcements (
  id          bigint generated always as identity primary key,
  title       text not null,
  content     text not null default '',
  status      text not null default 'active' check (status in ('active', 'archived')),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists announcements_status_idx on public.announcements (status, position, id);
alter table public.announcements enable row level security;
grant select on table public.announcements to anon, authenticated;
revoke insert, update, delete on table public.announcements from anon, authenticated;
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to anon, authenticated using (true);

-- 4) 把旧版 site_settings 里的单张头图 / 单条公告迁移为新表（仅在新表为空时）
insert into public.hero_images (url, position)
select value, 0 from public.site_settings
where key = 'hero_image' and value <> ''
  and not exists (select 1 from public.hero_images);

insert into public.announcements (title, content, position)
select '公告', value, 0 from public.site_settings
where key = 'announcement' and value <> ''
  and not exists (select 1 from public.announcements);

-- 确认结果（可选，只读）
-- select * from public.hero_images order by position, id;
-- select id, title, status, created_at from public.announcements order by status, position, id;
