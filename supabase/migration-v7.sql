-- ============================================================
-- 升级脚本 v7：周推游戏（问卷式问题 + 每人一组游戏回答）
-- Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 可重复执行（IF NOT EXISTS），不影响现有数据
-- 全新安装请用 supabase/schema.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1) 周推问题表：管理员发起，开始时间=创建时间，截止时间为具体日期时间
--    max_games = 每个用户最多可选的游戏数 n
create table if not exists public.weekly_questions (
  id          bigint generated always as identity primary key,
  question    text not null,
  max_games   integer not null default 3 check (max_games between 1 and 50),
  created_by  uuid references public.users(id) on delete set null,
  creator_name text not null default '',
  created_at  timestamptz not null default now(),
  ends_at     timestamptz not null
);
create index if not exists weekly_questions_created_idx on public.weekly_questions (created_at desc);

-- 2) 回答主表：每个用户对每个问题只有一条回答（可修改，重新提交时替换游戏）
create table if not exists public.weekly_answers (
  id          bigint generated always as identity primary key,
  question_id bigint not null references public.weekly_questions(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (question_id, user_id)
);
create index if not exists weekly_answers_question_idx on public.weekly_answers (question_id);

-- 3) 回答里的游戏：Bangumi 游戏或自定义上传均可；不含感想字段
create table if not exists public.weekly_answer_games (
  id           bigint generated always as identity primary key,
  answer_id    bigint not null references public.weekly_answers(id) on delete cascade,
  subject_id   integer,
  source       text not null default 'bangumi' check (source in ('bangumi', 'custom')),
  title        text not null,
  cover        text,
  cover_source text,
  platform     text,
  position     integer not null default 0
);
create index if not exists weekly_answer_games_answer_idx on public.weekly_answer_games (answer_id, position);

-- 4) RLS：全部公开可读；所有写入走服务端 API（service_role）
alter table public.weekly_questions enable row level security;
grant select on table public.weekly_questions to anon, authenticated;
revoke insert, update, delete on table public.weekly_questions from anon, authenticated;
drop policy if exists weekly_questions_read on public.weekly_questions;
create policy weekly_questions_read on public.weekly_questions for select to anon, authenticated using (true);

alter table public.weekly_answers enable row level security;
grant select on table public.weekly_answers to anon, authenticated;
revoke insert, update, delete on table public.weekly_answers from anon, authenticated;
drop policy if exists weekly_answers_read on public.weekly_answers;
create policy weekly_answers_read on public.weekly_answers for select to anon, authenticated using (true);

alter table public.weekly_answer_games enable row level security;
grant select on table public.weekly_answer_games to anon, authenticated;
revoke insert, update, delete on table public.weekly_answer_games from anon, authenticated;
drop policy if exists weekly_answer_games_read on public.weekly_answer_games;
create policy weekly_answer_games_read on public.weekly_answer_games for select to anon, authenticated using (true);

-- 确认结果（可选，只读）
-- select id, question, max_games, ends_at from public.weekly_questions order by created_at desc;
