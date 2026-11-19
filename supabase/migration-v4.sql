-- ============================================================
-- 升级脚本 v4：活动 / 投票模块
-- Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 可重复执行（IF NOT EXISTS），不影响现有数据
-- 全新安装请用 supabase/schema.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 投票主表：一个投票 = 一个标题 + 持续时间 + 若干游戏选项
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

-- 2) 投票选项：每个选项是一款来自 Bangumi 的游戏，数量不设上限
create table if not exists public.poll_options (
  id          bigint generated always as identity primary key,
  poll_id     bigint not null references public.polls(id) on delete cascade,
  subject_id  integer not null,
  title       text not null,
  cover       text,
  cover_source text,
  platform    text,
  position    integer not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

-- 3) 投票记录：一人一票（同一投票内），唯一约束保证不能重复投
--    注意：不向 anon/authenticated 开放读取，投票人身份只对管理员可见（由服务端 API 控制）
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

-- 4) RLS：投票与选项公开可读；所有写入走服务端 API（service_role）
alter table public.polls enable row level security;
grant select on table public.polls to anon, authenticated;
revoke insert, update, delete on table public.polls from anon, authenticated;
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select to anon, authenticated using (true);

alter table public.poll_options enable row level security;
grant select on table public.poll_options to anon, authenticated;
revoke insert, update, delete on table public.poll_options from anon, authenticated;
drop policy if exists poll_options_read on public.poll_options;
create policy poll_options_read on public.poll_options for select to anon, authenticated using (true);

alter table public.poll_votes enable row level security;
revoke all on table public.poll_votes from anon, authenticated;
-- 不创建公开 select 策略：投票明细仅由服务端接口在管理员身份下返回

-- 5) 结果确认（可选，只读）
-- select p.id, p.title, p.ends_at, count(v.id) as votes
--   from public.polls p left join public.poll_votes v on v.poll_id = p.id
--   group by p.id order by p.created_at desc;
