"use client";

import { useEffect, useState } from "react";
import UserAvatar from "./UserAvatar";
import WeeklyAnswerDialog from "./WeeklyAnswerDialog";
import type { SessionUser, WeeklyAnswer, WeeklyGameInput, WeeklyQuestion } from "@/lib/types";
import { proxiedCover } from "@/lib/img-proxy";

type Props = {
  items: WeeklyQuestion[];
  me: SessionUser | null;
  admin: boolean;
  onChanged: () => void | Promise<void>;
  onLogin: () => void;
  onAnswer: (q: WeeklyQuestion) => void;
};

function coverSrc(src: string | null): string | null {
  return proxiedCover(src);
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// 游戏卡片：大封面为主体，底部一条标题栏（超长省略），与参考图一致
function GameChip({ title, cover, source }: { title: string; cover: string | null; source: "bangumi" | "custom" }) {
  const src = coverSrc(cover);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="group min-w-0 overflow-hidden rounded-xl border border-butter-2 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square w-full overflow-hidden bg-[#FFF3DA]">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <span className="text-3xl text-primary/25">🎮</span>
          </div>
        )}
        {source === "custom" ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-white/85 px-1.5 py-0.5 text-[10px] text-ink backdrop-blur">自定义</span>
        ) : null}
      </div>
      <div className="border-t border-butter-2 bg-white/90 px-2 py-1.5">
        <div className="truncate text-xs font-medium" title={title}>{title}</div>
      </div>
    </div>
  );
}

function AnswerCard({ answer, me, editable, onEdit, onWithdraw }: {
  answer: WeeklyAnswer;
  me: SessionUser | null;
  editable: boolean;
  onEdit: () => void;
  onWithdraw: () => void;
}) {
  const isMine = me ? me.id === answer.user_id : false;
  return (
    <div className="rounded-xl border border-butter-2 bg-white/80 p-3">
      <div className="flex items-center gap-2">
        <UserAvatar name={answer.author_name} avatar={answer.author_avatar} size={30} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{answer.author_name}</span>
        {isMine ? <span className="rounded-full bg-butter/40 px-2 py-0.5 text-[11px] text-primary-dark">我</span> : null}
        <span className="shrink-0 text-[11px] text-muted">{formatDeadline(answer.updated_at)}</span>
      </div>
      {isMine && editable ? (
        <div className="mt-2 flex gap-3 text-[11px]">
          <button type="button" onClick={onEdit} className="text-primary-dark hover:underline">修改回答</button>
          <button type="button" onClick={onWithdraw} className="text-muted hover:text-red-600 hover:underline">撤回</button>
        </div>
      ) : null}
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {answer.games.map((g) => (
          <GameChip key={g.id} title={g.title} cover={g.cover} source={g.source} />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ q, me, admin, onChanged, onLogin, onAnswer }: {
  q: WeeklyQuestion;
  me: SessionUser | null;
  admin: boolean;
  onChanged: () => void | Promise<void>;
  onLogin: () => void;
  onAnswer: (q: WeeklyQuestion) => void;
}) {
  const active = q.status === "active";
  const mine = q.answers.find((a) => me && a.user_id === me.id);

  const remove = async () => {
    if (!confirm(`确定删除问题「${q.question}」吗？所有回答会一并删除。`)) return;
    const res = await fetch(`/api/weekly?id=${q.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "删除失败"); return; }
    await onChanged();
  };

  const withdraw = async () => {
    if (!confirm("确定撤回你的回答吗？")) return;
    const res = await fetch(`/api/weekly/answer?question_id=${q.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "撤回失败"); return; }
    await onChanged();
  };

  return (
    <article className="rounded-2xl border border-butter-2 bg-white/85 p-4 shadow-card fadein sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${active ? "bg-primary/15 text-primary-dark" : "bg-cream-2 text-muted"}`}>
              {active ? "进行中" : "已截止"}
            </span>
            <span className="text-[11px] text-muted">{q.creator_name} 发起 · {formatDeadline(q.created_at)}</span>
          </div>
          <h3 className="mt-2 break-words text-base font-medium leading-snug">{q.question}</h3>
          <p className="mt-1 text-xs text-muted">每人最多 {q.max_games} 款 · 截止 {formatDeadline(q.ends_at)}</p>
        </div>
        {admin ? (
          <button type="button" onClick={() => void remove()} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:text-red-600">删除</button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {active ? (
          me ? (
            <button type="button" onClick={() => onAnswer(q)} className="btn px-4 py-2 text-xs">
              {mine ? "修改我的回答" : "参与回答"}
            </button>
          ) : (
            <button type="button" onClick={onLogin} className="btn px-4 py-2 text-xs">登录后回答</button>
          )
        ) : null}
        <span className="self-center text-xs text-muted">{q.answers.length} 人已回答</span>
      </div>

      <div className="mt-4 space-y-2 border-t border-butter-2 pt-4">
        {q.answers.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">还没有人回答，来当第一个吧～</p>
        ) : q.answers.map((a) => (
          <AnswerCard
            key={a.id}
            answer={a}
            me={me}
            editable={active}
            onEdit={() => onAnswer(q)}
            onWithdraw={() => void withdraw()}
          />
        ))}
      </div>
    </article>
  );
}

// 管理员发起问题的弹窗
function CreateQuestion({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [maxGames, setMaxGames] = useState("3");
  // datetime-local 的默认值：当前时间 + 7 天（东八区）
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000 + 8 * 3600000);
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (!open) return null;

  const create = async () => {
    const text = question.trim();
    if (!text) { setMsg("请填写问题内容"); return; }
    const n = Number(maxGames);
    if (!Number.isInteger(n) || n < 1 || n > 50) { setMsg("每人可选游戏数需为 1–50"); return; }
    if (!deadline) { setMsg("请选择截止时间"); return; }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          max_games: n,
          // datetime-local 是本地时间字符串，new Date 解析为本地时区后转 ISO
          ends_at: new Date(deadline).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "发起失败");
      setQuestion("");
      setMaxGames("3");
      await onCreated();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "发起失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">＋ 发起周推问题</h3>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">开始时间默认为发布时间；截止时间请选具体日期。</p>

        <label className="mt-5 block text-sm font-medium">问题内容</label>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder="例如：你最喜欢的游戏原声带来自于哪些游戏？" className="input mt-2" />

        <label className="mt-4 block text-sm font-medium">每人最多可选游戏数（n）</label>
        <input type="number" min={1} max={50} step={1} value={maxGames} onChange={(e) => setMaxGames(e.target.value)} className="input mt-2" />

        <label className="mt-4 block text-sm font-medium">截止时间（具体日期时间）</label>
        <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input mt-2" />

        {msg ? <p className="mt-3 text-xs text-red-600">{msg}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">取消</button>
          <button type="button" onClick={() => void create()} disabled={busy} className="btn">{busy ? "发起中…" : "发起问题"}</button>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyPanel({ items, me, admin, onChanged, onLogin, onAnswer }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [answerTarget, setAnswerTarget] = useState<WeeklyQuestion | null>(null);

  const active = items.filter((q) => q.status === "active");
  const ended = items.filter((q) => q.status === "ended");

  // 回答弹窗的目标：从父层传入的问题需要带上最新预填数据
  const answerInitialGames: WeeklyGameInput[] = answerTarget && me
    ? (answerTarget.answers.find((a) => a.user_id === me.id)?.games || []).map((g) => ({
        subject_id: g.subject_id,
        source: g.source,
        title: g.title,
        cover: g.cover,
        cover_source: g.cover_source,
        platform: g.platform,
      }))
    : [];

  return (
    <section className="card fadein p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">🗓️ 周推游戏</h2>
          <p className="mt-0.5 text-xs text-muted">每周一个问题，选出你心目中的游戏</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button type="button" onClick={() => setPastOpen(true)} className="btn-ghost flex-1 sm:flex-none">🗂️ 往期问题（{ended.length}）</button>
          {admin ? (
            <button type="button" onClick={() => setCreateOpen(true)} className="btn flex-1 sm:flex-none">＋ 发起问题</button>
          ) : null}
        </div>
      </div>

      {active.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted">
          <div className="mb-2 text-4xl">🗓️</div>
          <p>暂时没有进行中的周推问题，等等管理员发起吧～</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              me={me}
              admin={admin}
              onChanged={onChanged}
              onLogin={onLogin}
              onAnswer={setAnswerTarget}
            />
          ))}
        </div>
      )}

      {/* 往期问题弹窗 */}
      {pastOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setPastOpen(false); }}>
          <div className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium">🗂️ 往期周推问题</h3>
                <p className="mt-0.5 text-xs text-muted">共 {ended.length} 个已截止问题及大家的回答</p>
              </div>
              <button type="button" onClick={() => setPastOpen(false)} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
            </div>
            <div className="mt-5 space-y-5">
              {ended.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">还没有往期问题。</p>
              ) : ended.map((q) => (
                <div key={q.id}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium leading-snug">{q.question}</h4>
                      <p className="text-[11px] text-muted">截止 {formatDeadline(q.ends_at)} · {q.answers.length} 人回答</p>
                    </div>
                    {admin ? (
                      <button type="button" onClick={() => void (async () => {
                        if (!confirm("确定删除这个问题吗？")) return;
                        const res = await fetch(`/api/weekly?id=${q.id}`, { method: "DELETE" });
                        if (res.ok) { await onChanged(); } else alert("删除失败");
                      })()} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:text-red-600">删除</button>
                    ) : null}
                  </div>
                  {q.answers.length === 0 ? (
                    <p className="text-xs text-muted">无人回答</p>
                  ) : (
                    <div className="space-y-2">
                      {q.answers.map((a) => (
                        <AnswerCard key={a.id} answer={a} me={me} editable={false} onEdit={() => {}} onWithdraw={() => {}} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setPastOpen(false)} className="btn-ghost">关闭</button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateQuestion open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onChanged} />

      {answerTarget && me ? (
        <WeeklyAnswerDialog
          key={answerTarget.id}
          open
          question={answerTarget}
          initialGames={answerInitialGames}
          onClose={() => setAnswerTarget(null)}
          onSubmitted={onChanged}
        />
      ) : null}
    </section>
  );
}
