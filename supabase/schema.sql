-- ============================================================
-- 全新安装：在 Supabase 控制台 → SQL Editor 里粘贴执行本文件
-- 一次建表 + 建策略 + 建存储桶；重复执行安全（IF NOT EXISTS / DROP IF EXISTS）
-- 已有数据库升级请用 supabase/migration-v2.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 账户表（只允许服务端 service_role 读写，防止密码哈希泄露）
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  username_norm text not null,
  password_hash text not null,
  nickname      text not null,
  owner_key     text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  created_at    timestamptz not null default now()
);
create unique index if not exists users_username_norm_uidx on public.users (username_norm);
create unique index if not exists users_owner_key_uidx on public.users (owner_key) where owner_key is not null;
alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;

-- 2) 游戏清单表
create table if not exists public.game_list (
  id            bigint generated always as identity primary key,
  owner_key     text not null,
  user_id       uuid references public.users(id) on delete set null,
  owner_name    text not null,
  subject_id    integer not null,
  title         text not null,
  cover         text,
  cover_source  text,
  platform      text,
  air_date      text,
  bangumi_rating text,
  thoughts      text default '',
  my_score      smallint,
  play_year     integer not null default extract(year from now())::int,
  created_at    timestamptz not null default now(),
  unique (owner_key, subject_id)
);
create index if not exists game_list_user_id_idx on public.game_list (user_id);
create unique index if not exists game_list_user_subject_uidx
  on public.game_list (user_id, subject_id) where user_id is not null;

-- 3) RLS：所有人可读，写入由服务端 API 强制鉴权
alter table public.game_list enable row level security;
grant select, insert, update, delete on table public.game_list to authenticated, anon;

drop policy if exists game_list_read on public.game_list;
create policy game_list_read on public.game_list for select to authenticated, anon using (true);
drop policy if exists game_list_insert on public.game_list;
create policy game_list_insert on public.game_list for insert to authenticated, anon with check (true);
drop policy if exists game_list_update on public.game_list;
create policy game_list_update on public.game_list for update to authenticated, anon using (true) with check (true);
drop policy if exists game_list_delete on public.game_list;
create policy game_list_delete on public.game_list for delete to authenticated, anon using (true);

-- 4) 点赞表：一人一赞
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

-- 5) 评论表
create table if not exists public.comments (
  id         bigint generated always as identity primary key,
  entry_id   bigint not null references public.game_list(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_entry_created_idx on public.comments (entry_id, created_at);
alter table public.comments enable row level security;
grant select on table public.comments to anon, authenticated;
revoke insert, update, delete on table public.comments from anon, authenticated;
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to anon, authenticated using (true);

-- 6) 站点设置（头图 / 公告语）：只允许服务端写入
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
insert into public.site_settings (key, value) values
  ('hero_image', ''),
  ('announcement', '欢迎来到游戏墙！搜一搜、记一记，把今年玩过的好游戏和心得分享给大家～')
on conflict (key) do nothing;

-- 7) 封面存储桶（公开读）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-covers', 'game-covers', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists covers_read on storage.objects;
create policy covers_read on storage.objects for select to authenticated, anon
using (bucket_id = 'game-covers');
drop policy if exists covers_insert on storage.objects;
create policy covers_insert on storage.objects for insert to authenticated, anon
with check (bucket_id = 'game-covers');
drop policy if exists covers_update on storage.objects;
create policy covers_update on storage.objects for update to authenticated, anon
using (bucket_id = 'game-covers') with check (bucket_id = 'game-covers');

-- 8) 活动 / 投票模块
--    投票主表：标题 + 持续时间（ends_at）；管理员通过服务端 API 创建/删除
create table if not exists public.polls (
  id           bigint generated always as identity primary key,
  title        text not null,
  created_by   uuid references public.users(id) on delete set null,
  creator_name text not null default '',
  created_at   timestamptz not null default now(),
  ends_at      timestamptz not null
);
create index if not exists polls_ends_at_idx on public.polls (ends_at);
create index if not exists polls_created_at_idx on public.polls (created_at);
alter table public.polls enable row level security;
grant select on table public.polls to anon, authenticated;
revoke insert, update, delete on table public.polls from anon, authenticated;
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select to anon, authenticated using (true);

-- 9) 投票选项：每个选项是一款 Bangumi 游戏，数量不设上限，删除投票时级联删除
create table if not exists public.poll_options (
  id           bigint generated always as identity primary key,
  poll_id      bigint not null references public.polls(id) on delete cascade,
  subject_id   integer not null,
  title        text not null,
  cover        text,
  cover_source text,
  platform     text,
  position     integer not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);
alter table public.poll_options enable row level security;
grant select on table public.poll_options to anon, authenticated;
revoke insert, update, delete on table public.poll_options from anon, authenticated;
drop policy if exists poll_options_read on public.poll_options;
create policy poll_options_read on public.poll_options for select to anon, authenticated using (true);

-- 10) 投票记录：一人一票（同一投票内）；投票人身份不对前台开放，仅服务端按管理员身份返回
create table if not exists public.poll_votes (
  id         bigint generated always as identity primary key,
  poll_id    bigint not null references public.polls(id) on delete cascade,
  option_id  bigint not null references public.poll_options(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);
create index if not exists poll_votes_option_idx on public.poll_votes (option_id);
alter table public.poll_votes enable row level security;
revoke all on table public.poll_votes from anon, authenticated;
