-- ============================================================
-- 在 Supabase 控制台 → SQL Editor 里粘贴执行本文件
-- 一次执行会建表 + 建策略 + 建存储桶；重复执行是安全的（IF NOT EXISTS / DROP IF EXISTS）
-- ============================================================

-- 1) 游戏清单表
create table if not exists public.game_list (
  id            bigint generated always as identity primary key,
  owner_key     text not null,
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

-- 2) RLS：所有人可读，写入由服务端 API 用 owner_key 约束
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

-- 说明：本站所有写入都经过 Next.js 服务端 API(/api/entries)，
-- 服务端在 SQL 层用 .eq('owner_key', ...) 约束归属，因此 RLS 策略对所有角色开放读写。
-- 如果你想要更严格的安全模型，可改为「前端带 token + RLS 校验 auth.uid()」，
-- 但那需要引入登录，本站为免登录设计故不采用。

-- 3) 封面存储桶（公开读）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-covers',
  'game-covers',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 4) 存储桶策略：允许服务端(anon key 视角)上传/覆盖，允许所有人读取
drop policy if exists covers_read on storage.objects;
create policy covers_read on storage.objects for select to authenticated, anon
using (bucket_id = 'game-covers');

drop policy if exists covers_insert on storage.objects;
create policy covers_insert on storage.objects for insert to authenticated, anon
with check (bucket_id = 'game-covers');

drop policy if exists covers_update on storage.objects;
create policy covers_update on storage.objects for update to authenticated, anon
using (bucket_id = 'game-covers') with check (bucket_id = 'game-covers');
