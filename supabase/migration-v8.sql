-- ============================================================
-- 升级脚本 v8：美图分享（一次上传多张图 + 文字 + 点赞 + 管理员删除）
-- Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 可重复执行（IF NOT EXISTS），不影响现有数据
-- 全新安装请用 supabase/schema.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 美图分享表：一条记录 = 一次分享（含多张图片 + 一段文字）
create table if not exists public.photos (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.users(id) on delete cascade,
  owner_name   text not null,
  images       jsonb not null default '[]'::jsonb, -- 图片公开 URL 数组，至少 1 张
  caption      text not null default '',           -- 为这批图片写的文字（支持富文本标记）
  created_at   timestamptz not null default now()
);
create index if not exists photos_created_idx on public.photos (created_at desc);
create index if not exists photos_user_idx on public.photos (user_id);

alter table public.photos enable row level security;
grant select on table public.photos to anon, authenticated;
revoke insert, update, delete on table public.photos from anon, authenticated;
drop policy if exists photos_read on public.photos;
create policy photos_read on public.photos for select to anon, authenticated using (true);

-- 2) 美图点赞表：一人一赞，删除分享时级联删除
create table if not exists public.photo_likes (
  id         bigint generated always as identity primary key,
  photo_id   bigint not null references public.photos(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, user_id)
);
create index if not exists photo_likes_photo_idx on public.photo_likes (photo_id);

alter table public.photo_likes enable row level security;
grant select on table public.photo_likes to anon, authenticated;
revoke insert, update, delete on table public.photo_likes from anon, authenticated;
drop policy if exists photo_likes_read on public.photo_likes;
create policy photo_likes_read on public.photo_likes for select to anon, authenticated using (true);
