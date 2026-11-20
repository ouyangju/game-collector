import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { currentUser, isAdmin } from "@/lib/auth";
import type { WeeklyAnswer, WeeklyGame, WeeklyQuestion, WeeklyResponse } from "@/lib/types";

export const runtime = "nodejs";

type QuestionRow = {
  id: number;
  question: string;
  max_games: number;
  created_by: string | null;
  creator_name: string;
  created_at: string;
  ends_at: string;
};

type AnswerRow = {
  id: number;
  question_id: number;
  user_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
};

type GameRow = {
  id: number;
  answer_id: number;
  subject_id: number | null;
  source: "bangumi" | "custom";
  title: string;
  cover: string | null;
  cover_source: string | null;
  platform: string | null;
  position: number;
};

// GET /api/weekly —— 公开读取所有周推问题及各用户回答（含进行中/已截止状态）
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const user = await currentUser(req);

  const { data: qData, error: qErr } = await sb
    .from("weekly_questions")
    .select("*")
    .order("created_at", { ascending: false });
  if (qErr) {
    // 未执行 v7 迁移时返回空列表，避免首页报错
    return NextResponse.json({ items: [], user } satisfies WeeklyResponse);
  }

  const questions = (qData || []) as QuestionRow[];
  let answers: AnswerRow[] = [];
  let games: GameRow[] = [];
  if (questions.length) {
    const [{ data: aData }, { data: gData }] = await Promise.all([
      sb.from("weekly_answers").select("*"),
      sb.from("weekly_answer_games").select("*").order("position", { ascending: true }),
    ]);
    answers = (aData || []) as AnswerRow[];
    games = (gData || []) as GameRow[];
  }

  // 回答者头像：公开资料，按 user_id 索引
  const avatarMap = new Map<string, string | null>();
  if (answers.length) {
    const ids = Array.from(new Set(answers.map((a) => a.user_id)));
    const { data: usersData } = await sb.from("users").select("id, avatar").in("id", ids);
    (usersData || []).forEach((u: { id: string; avatar: string | null }) => {
      avatarMap.set(u.id, u.avatar ?? null);
    });
  }

  const gamesByAnswer = new Map<number, WeeklyGame[]>();
  games.forEach((g) => {
    const list = gamesByAnswer.get(g.answer_id) || [];
    list.push(g as WeeklyGame);
    gamesByAnswer.set(g.answer_id, list);
  });

  const now = Date.now();
  const items: WeeklyQuestion[] = questions.map((q) => {
    const qAnswers: WeeklyAnswer[] = answers
      .filter((a) => a.question_id === q.id)
      .map((a) => ({
        id: a.id,
        question_id: a.question_id,
        user_id: a.user_id,
        author_name: a.author_name,
        author_avatar: avatarMap.get(a.user_id) ?? null,
        created_at: a.created_at,
        updated_at: a.updated_at,
        games: gamesByAnswer.get(a.id) || [],
      }));
    return {
      id: q.id,
      question: q.question,
      max_games: q.max_games,
      created_by: q.created_by,
      creator_name: q.creator_name || "管理员",
      created_at: q.created_at,
      ends_at: q.ends_at,
      status: new Date(q.ends_at).getTime() > now ? "active" : "ended",
      answers: qAnswers,
      my_answer_id: user ? (qAnswers.find((a) => a.user_id === user.id)?.id ?? null) : null,
    };
  });

  return NextResponse.json({ items, user } satisfies WeeklyResponse);
}

// POST /api/weekly —— 管理员发起周推问题（截止时间为具体日期时间）
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "仅管理员可以发起周推游戏" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const question = String(body.question || "").trim().slice(0, 200);
  if (!question) {
    return NextResponse.json({ error: "请填写问题内容" }, { status: 400 });
  }
  const maxGames = Number(body.max_games);
  if (!Number.isInteger(maxGames) || maxGames < 1 || maxGames > 50) {
    return NextResponse.json({ error: "每人可选游戏数需在 1–50 之间" }, { status: 400 });
  }
  const endsAtRaw = String(body.ends_at || "");
  const endsMs = Date.parse(endsAtRaw);
  if (!Number.isFinite(endsMs)) {
    return NextResponse.json({ error: "截止时间格式无效" }, { status: 400 });
  }
  if (endsMs <= Date.now()) {
    return NextResponse.json({ error: "截止时间必须晚于当前时间" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("weekly_questions")
    .insert({
      question,
      max_games: maxGames,
      created_by: user.id,
      creator_name: user.nickname,
      ends_at: new Date(endsMs).toISOString(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// DELETE /api/weekly?id= —— 管理员删除问题（回答与游戏级联删除）
export async function DELETE(req: NextRequest) {
  const user = await currentUser(req);
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "仅管理员可以删除周推问题" }, { status: 403 });
  }
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "参数无效" }, { status: 400 });

  const sb = supabaseServer();
  const { error } = await sb.from("weekly_questions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
