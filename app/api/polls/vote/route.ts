import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/polls/vote —— 登录用户为进行中的投票投一票（一人一票，不可重复）
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录后再投票" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const pollId = Number(body.poll_id);
  const optionId = Number(body.option_id);
  if (!pollId || !optionId) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data: poll } = await sb
    .from("polls")
    .select("id, ends_at")
    .eq("id", pollId)
    .maybeSingle();
  if (!poll) return NextResponse.json({ error: "投票不存在" }, { status: 404 });
  if (new Date((poll as { ends_at: string }).ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "该投票已结束" }, { status: 409 });
  }

  const { data: option } = await sb
    .from("poll_options")
    .select("id")
    .eq("id", optionId)
    .eq("poll_id", pollId)
    .maybeSingle();
  if (!option) return NextResponse.json({ error: "选项不属于该投票" }, { status: 400 });

  const { data: existing } = await sb
    .from("poll_votes")
    .select("id")
    .eq("poll_id", pollId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "你已经投过票了" }, { status: 409 });
  }

  const { error } = await sb.from("poll_votes").insert({
    poll_id: pollId,
    option_id: optionId,
    user_id: user.id,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "你已经投过票了" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: allVotes } = await sb
    .from("poll_votes")
    .select("option_id")
    .eq("poll_id", pollId);
  const counts: Record<number, number> = {};
  (allVotes || []).forEach((v: { option_id: number }) => {
    counts[v.option_id] = (counts[v.option_id] || 0) + 1;
  });

  return NextResponse.json({ ok: true, my_vote_option_id: optionId, counts, total: allVotes?.length || 0 });
}
