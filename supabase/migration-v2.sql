-- ============================================================
-- 升级脚本：在已有数据库上执行（本次新增 账户 / 点赞 / 评论）
-- Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 可重复执行（IF NOT EXISTS）
-- 全新安装请改用 supabase/schema.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 账户表。注意：不向 anon/authenticated 开放任何权限，
--    只能通过服务端 API（service_role）读写，避免密码哈希泄露。
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  username_norm text not null,
  password_hash text not null,
  nickname      text not null,
  owner_key     text,
  created_at    timestamptz not null default now()
);
create unique index if not exists users_username_norm_uidx
  on public.users (username_norm);
create unique index if not exists users_owner_key_uidx
  on public.users (owner_key) where owner_key is not null;
alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;

-- 2) 游戏清单增加 user_id（旧数据先留空，登录时自动过户）
alter table public.game_list
  add column if not exists user_id uuid references public.users(id) on delete set null;
create index if not exists game_list_user_id_idx on public.game_list (user_id);
create unique index if not exists game_list_user_subject_uidx
  on public.game_list (user_id, subject_id) where user_id is not null;

-- 3) 点赞表：一人一赞，通过唯一约束保证
create table if not exists public.likes (
  id         bigint generated always as identity primary key,
  entry_id   bigint not null references public.game_list(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entry_id, user_id)
);
alter table public.likes enable row level security;
grant select on table public.likes to anon, authenticated;
revoke insert, update, delete on table public.likes from anon, authenticated;
drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select to anon, authenticated using (true);

-- 4) 评论表
create table if not exists public.comments (
  id         bigint generated always as identity primary key,
  entry_id   bigint not null references public.game_list(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_entry_created_idx
  on public.comments (entry_id, created_at);
alter table public.comments enable row level security;
grant select on table public.comments to anon, authenticated;
revoke insert, update, delete on table public.comments from anon, authenticated;
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon, authenticated using (true);

-- 5) 迁移完成后可用下面这条查看结果（可选，只读）
-- select u.nickname, count(g.id) as games from public.users u
--   left join public.game_list g on g.user_id = u.id group by u.id order by games desc;
