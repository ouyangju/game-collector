import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser, isAdmin } from "@/lib/auth";
import type { Poll, PollOption, PollOptionInput, PollsResponse, PollVoter } from "@/lib/types";

export const runtime = "nodejs";

type PollRow = {
  id: number;
  title: string;
  created_by: string | null;
  creator_name: string;
  created_at: string;
  ends_at: string;
};

type OptionRow = {
  id: number;
  poll_id: number;
  subject_id: number;
  title: string;
  cover: string | null;
  cover_source: string | null;
  platform: string | null;
  position: number;
};

type VoteRow = {
  id: number;
  poll_id: number;
  option_id: number;
  user_id: string;
  created_at: string;
};

// GET /api/polls —— 公开读取所有投票（进行中 / 往期由服务端按时间判定）
// 登录用户会附带自己的投票选项；管理员额外获得每个选项的投票人明细
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const user = await currentUser(req);
  const admin = isAdmin(user);

  const { data: pollsData, error: pollsErr } = await sb
    .from("polls")
    .select("*")
    .order("created_at", { ascending: false });
  if (pollsErr) {
    // 尚未执行 v4 迁移时返回空列表，避免首页报错
    return NextResponse.json({ items: [], user } satisfies PollsResponse);
  }

  const [{ data: optionsData }, { data: votesData }] = await Promise.all([
    sb.from("poll_options").select("*").order("position", { ascending: true }),
    sb.from("poll_votes").select("id, poll_id, option_id, user_id, created_at"),
  ]);

  const polls = (pollsData || []) as PollRow[];
  const options = (optionsData || []) as OptionRow[];
  const votes = (votesData || []) as VoteRow[];

  // 管理员才查昵称表，普通用户不接触投票人身份
  const nickMap = new Map<string, string>();
  if (admin && votes.length) {
    const ids = Array.from(new Set(votes.map((v) => v.user_id)));
    const { data: usersData } = await sb.from("users").select("id, nickname").in("id", ids);
    (usersData || []).forEach((u: { id: string; nickname: string }) => {
      nickMap.set(u.id, u.nickname);
    });
  }

  const now = Date.now();
  const items: Poll[] = polls.map((p) => {
    const pollOptions: PollOption[] = options
      .filter((o) => o.poll_id === p.id)
      .map((o) => ({ ...o, vote_count: 0, ...(admin ? { voters: [] as PollVoter[] } : {}) }));
    const byId = new Map<number, PollOption>(pollOptions.map((o) => [o.id, o]));

    let myVote: number | null = null;
    votes.forEach((v) => {
      if (v.poll_id !== p.id) return;
      const opt = byId.get(v.option_id);
      if (!opt) return;
      opt.vote_count += 1;
      if (user && v.user_id === user.id) myVote = v.option_id;
      if (admin) {
        opt.voters?.push({
          user_id: v.user_id,
          nickname: nickMap.get(v.user_id) || "已注销用户",
          created_at: v.created_at,
        });
      }
    });
    if (admin) {
      pollOptions.forEach((o) =>
        o.voters?.sort((a, b) => a.created_at.localeCompare(b.created_at))
      );
    }

    return {
      id: p.id,
      title: p.title,
      created_by: p.created_by,
      creator_name: p.creator_name || "管理员",
      created_at: p.created_at,
      ends_at: p.ends_at,
      status: new Date(p.ends_at).getTime() > now ? "active" : "ended",
      options: pollOptions,
      total_votes: votes.filter((v) => v.poll_id === p.id).length,
      my_vote_option_id: myVote,
    };
  });

  return NextResponse.json({ items, user } satisfies PollsResponse);
}

// POST /api/polls —— 管理员创建投票
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "仅管理员可以创建投票" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const title = String(body.title || "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "请填写投票标题" }, { status: 400 });

  const hours = Number(body.duration_hours);
  if (!Number.isFinite(hours) || hours < 0.05 || hours > 24 * 365) {
    return NextResponse.json({ error: "持续时间需在 3 分钟到 1 年之间" }, { status: 400 });
  }

  const rawOptions = Array.isArray(body.options) ? body.options : [];
  if (rawOptions.length < 2) {
    return NextResponse.json({ error: "请至少添加两个游戏选项" }, { status: 400 });
  }
  const inputs: PollOptionInput[] = rawOptions.map((raw: Record<string, unknown>) => {
    const subjectId = Number(raw?.subject_id);
    const optTitle = String(raw?.title || "").trim().slice(0, 120);
    const cover = raw?.cover ? String(raw.cover).slice(0, 2000) : null;
    const coverSource = raw?.cover_source ? String(raw.cover_source).slice(0, 2000) : null;
    const platform = raw?.platform ? String(raw.platform).slice(0, 120) : null;
    return { subject_id: subjectId, title: optTitle, cover, cover_source: coverSource, platform };
  });
  if (inputs.some((o) => !o.subject_id || !o.title)) {
    return NextResponse.json({ error: "游戏选项信息不完整" }, { status: 400 });
  }

  const sb = supabaseServer();
  const endsAt = new Date(Date.now() + Math.round(hours * 3600 * 1000)).toISOString();
  const { data: created, error: pollErr } = await sb
    .from("polls")
    .insert({
      title,
      created_by: user.id,
      creator_name: user.nickname,
      ends_at: endsAt,
    })
    .select("id")
    .single();
  if (pollErr || !created) {
    return NextResponse.json({ error: pollErr?.message || "创建投票失败" }, { status: 500 });
  }

  const pollId = (created as { id: number }).id;
  const { error: optErr } = await sb.from("poll_options").insert(
    inputs.map((o, i) => ({
      poll_id: pollId,
      subject_id: o.subject_id,
      title: o.title,
      cover: o.cover,
      cover_source: o.cover_source,
      platform: o.platform,
      position: i,
    }))
  );
  if (optErr) {
    // 选项写入失败时回滚主表，避免出现没有选项的空投票
    await sb.from("polls").delete().eq("id", pollId);
    return NextResponse.json({ error: optErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: pollId, ends_at: endsAt });
}

// DELETE /api/polls?id= —— 管理员删除投票（选项与投票记录级联删除）
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "仅管理员可以删除投票" }, { status: 403 });
  }
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { error } = await sb.from("polls").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
