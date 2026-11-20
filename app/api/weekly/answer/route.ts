import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";
import type { WeeklyGameInput } from "@/lib/types";

export const runtime = "nodejs";

// POST /api/weekly/answer —— 提交/修改自己对某个周推问题的回答（至多 n 款游戏，无感想）
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const questionId = Number(body.question_id);
  if (!questionId) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { data: question } = await sb
    .from("weekly_questions")
    .select("id, max_games, ends_at")
    .eq("id", questionId)
    .maybeSingle();
  if (!question) return NextResponse.json({ error: "问题不存在" }, { status: 404 });

  const q = question as { id: number; max_games: number; ends_at: string };
  if (new Date(q.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "该问题已截止" }, { status: 409 });
  }

  const rawGames = Array.isArray(body.games) ? body.games : [];
  if (rawGames.length === 0) {
    return NextResponse.json({ error: "请至少选择一款游戏" }, { status: 400 });
  }
  if (rawGames.length > q.max_games) {
    return NextResponse.json({ error: `最多只能选择 ${q.max_games} 款游戏` }, { status: 400 });
  }

  const games: WeeklyGameInput[] = rawGames.map((raw: Record<string, unknown>) => {
    const source = raw?.source === "custom" ? "custom" : "bangumi";
    const subjectId = source === "custom" ? null : Number(raw?.subject_id);
    const title = String(raw?.title || "").trim().slice(0, 120);
    return {
      subject_id: source === "custom" ? null : (subjectId && subjectId > 0 ? subjectId : null),
      source,
      title,
      cover: raw?.cover ? String(raw.cover).slice(0, 2000) : null,
      cover_source: raw?.cover_source ? String(raw.cover_source).slice(0, 2000) : null,
      platform: raw?.platform ? String(raw.platform).slice(0, 120) : null,
    };
  });
  if (games.some((g) => !g.title || (g.source === "bangumi" && !g.subject_id))) {
    return NextResponse.json({ error: "游戏信息不完整" }, { status: 400 });
  }

  // 一人一题一条回答：存在则更新并替换游戏（允许修改自己的选择）
  const { data: existing } = await sb
    .from("weekly_answers")
    .select("id")
    .eq("question_id", questionId)
    .eq("user_id", user.id)
    .maybeSingle();

  let answerId: number;
  if (existing) {
    answerId = (existing as { id: number }).id;
    const { error: upErr } = await sb
      .from("weekly_answers")
      .update({ author_name: user.nickname, updated_at: new Date().toISOString() })
      .eq("id", answerId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { error: delErr } = await sb.from("weekly_answer_games").delete().eq("answer_id", answerId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  } else {
    const { data: created, error: insErr } = await sb
      .from("weekly_answers")
      .insert({ question_id: questionId, user_id: user.id, author_name: user.nickname })
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "你已经回答过该问题" }, { status: 409 });
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    answerId = (created as { id: number }).id;
  }

  const { error: gamesErr } = await sb.from("weekly_answer_games").insert(
    games.map((g, i) => ({
      answer_id: answerId,
      subject_id: g.subject_id,
      source: g.source,
      title: g.title,
      cover: g.cover,
      cover_source: g.cover_source,
      platform: g.platform,
      position: i,
    }))
  );
  if (gamesErr) return NextResponse.json({ error: gamesErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, answer_id: answerId });
}

// DELETE /api/weekly/answer?question_id= —— 撤回自己的回答（需登录，截止前）
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const questionId = Number(req.nextUrl.searchParams.get("question_id"));
  if (!questionId) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { data: question } = await sb.from("weekly_questions").select("ends_at").eq("id", questionId).maybeSingle();
  if (!question) return NextResponse.json({ error: "问题不存在" }, { status: 404 });
  if (new Date((question as { ends_at: string }).ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "该问题已截止，无法撤回" }, { status: 409 });
  }

  const { error } = await sb
    .from("weekly_answers")
    .delete()
    .eq("question_id", questionId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
