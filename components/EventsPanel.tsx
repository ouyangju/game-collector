"use client";

import { useCallback, useEffect, useState } from "react";
import SearchDialog from "./SearchDialog";
import { avatarColor } from "./identity";
import type {
  GameHit,
  Poll,
  PollOption,
  PollOptionInput,
  SessionUser,
} from "@/lib/types";

type Props = {
  me: SessionUser | null;
  admin: boolean;
  onLogin: () => void;
};

const DURATION_PRESETS = [
  { label: "1 小时", value: 1 },
  { label: "6 小时", value: 6 },
  { label: "1 天", value: 24 },
  { label: "3 天", value: 72 },
  { label: "7 天", value: 168 },
  { label: "30 天", value: 720 },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeLeft(endsAt: string, now: number): string {
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return "已结束";
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remain = mins % 60;
  if (days > 0) return `剩余 ${days} 天 ${hours} 小时`;
  if (hours > 0) return `剩余 ${hours} 小时 ${remain} 分`;
  return `剩余 ${remain} 分钟`;
}

// 与清单一致的封面代理：Bangumi 图床走自家服务端
function pollCover(src: string | null): string | null {
  if (!src) return null;
  if (src.includes("lain.bgm.tv")) {
    return `/api/games/thumbnail?url=${encodeURIComponent(src)}`;
  }
  return src;
}

function OptionCover({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const display = pollCover(src);
  return (
    <div className="grid h-14 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#FFF3DA]">
      {!failed && display ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={display}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-xl text-primary/25">🎮</span>
      )}
    </div>
  );
}

function PollCard({
  poll,
  me,
  admin,
  now,
  voting,
  deleting,
  onVote,
  onDelete,
  onLogin,
}: {
  poll: Poll;
  me: SessionUser | null;
  admin: boolean;
  now: number;
  voting: boolean;
  deleting: boolean;
  onVote: (p: Poll, o: PollOption) => void;
  onDelete: (p: Poll) => void;
  onLogin: () => void;
}) {
  const [showVoters, setShowVoters] = useState(false);
  const active = poll.status === "active";
  const voted = poll.my_vote_option_id !== null;
  // 投票后 / 已截止 / 管理员 才展示票数与比例
  const showResults = !active || voted || admin;

  return (
    <article className="rounded-2xl border border-butter-2 bg-white/85 p-4 shadow-card fadein sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-medium leading-snug">{poll.title}</h3>
          <div className="mt-1 text-[11px] text-muted">
            {poll.creator_name} 发起 · {formatDate(poll.created_at)}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            active ? "bg-primary/15 text-primary-dark" : "bg-cream-2 text-muted"
          }`}
        >
          {active ? timeLeft(poll.ends_at, now) : "已结束"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {poll.options.map((o) => {
          const isMine = poll.my_vote_option_id === o.id;
          const pct = poll.total_votes > 0
            ? Math.round((o.vote_count / poll.total_votes) * 1000) / 10
            : 0;
          return (
            <div
              key={o.id}
              className={`rounded-xl border p-2.5 transition ${
                isMine ? "border-primary bg-butter/30" : "border-butter-2 bg-cream-2"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <OptionCover src={o.cover} alt={o.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium" title={o.title}>{o.title}</span>
                    {isMine ? (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white">我</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    Bangumi #{o.subject_id}{o.platform ? ` · ${o.platform}` : ""}
                  </div>
                </div>

                {active && !voted ? (
                  me ? (
                    <button
                      type="button"
                      disabled={voting}
                      onClick={() => onVote(poll, o)}
                      className="btn shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      投票
                    </button>
                  ) : null
                ) : null}

                {showResults ? (
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium text-primary-dark">{o.vote_count} 票</div>
                    <div className="text-[11px] text-muted">{pct}%</div>
                  </div>
                ) : null}
              </div>

              {showResults ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-butter/40">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}

              {admin && showVoters ? (
                <div className="mt-2 border-t border-butter-2 pt-2 text-[11px] leading-relaxed text-muted">
                  {o.voters && o.voters.length > 0 ? (
                    o.voters.map((v) => (
                      <span key={v.user_id} className="mr-2 inline-flex items-center gap-1">
                        <span
                          className="grid h-4 w-4 place-items-center rounded-full text-[9px] text-white"
                          style={{ background: avatarColor(v.nickname) }}
                        >
                          {v.nickname.slice(0, 1)}
                        </span>
                        {v.nickname}
                      </span>
                    ))
                  ) : (
                    <span>暂无投票</span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-butter-2 pt-3 text-xs text-muted">
        <span>👥 {poll.total_votes} 人已投</span>
        {active ? (
          voted ? (
            <span className="text-primary-dark">你已投票 ✅</span>
          ) : (
            <span>{me ? "点击选项右侧按钮投票" : "登录后可参与投票"}</span>
          )
        ) : (
          <span>投票已截止，结果已公布</span>
        )}
        {!me && active ? (
          <button type="button" onClick={onLogin} className="text-primary-dark underline">登录参与</button>
        ) : null}
        {admin ? (
          <>
            <button
              type="button"
              onClick={() => setShowVoters((v) => !v)}
              className="ml-auto text-primary-dark hover:underline"
            >
              {showVoters ? "收起明细" : "查看投票明细"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => onDelete(poll)}
              className="text-red-600 hover:underline disabled:opacity-50"
            >
              删除
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

export default function EventsPanel({ me, admin, onLogin }: Props) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subTab, setSubTab] = useState<"active" | "ended">("active");
  const [now, setNow] = useState(() => Date.now());

  const [votingId, setVotingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftHours, setDraftHours] = useState("72");
  const [draftOptions, setDraftOptions] = useState<PollOptionInput[]>([]);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNow(Date.now());
    try {
      const res = await fetch("/api/polls", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取投票失败");
      setPolls(json.items || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取投票失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, me?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const doVote = async (poll: Poll, option: PollOption) => {
    if (!me) { onLogin(); return; }
    if (poll.status !== "active" || poll.my_vote_option_id !== null) return;
    setVotingId(poll.id);
    try {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poll_id: poll.id, option_id: option.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "投票失败");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "投票失败");
    } finally {
      setVotingId(null);
    }
  };

  const doDelete = async (poll: Poll) => {
    if (!confirm(`确定删除投票「${poll.title}」吗？\n所有投票记录会一并删除，且无法恢复。`)) return;
    setDeletingId(poll.id);
    try {
      const res = await fetch(`/api/polls?id=${poll.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "删除失败");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => {
    setDraftTitle("");
    setDraftHours("72");
    setDraftOptions([]);
    setCreateMsg("");
    setCreateOpen(true);
  };

  const addOption = async (hit: GameHit) => {
    let cover: string | null = hit.cover || null;
    if (hit.cover) {
      try {
        const imgRes = await fetch(`/api/games/image?id=${hit.id}&url=${encodeURIComponent(hit.cover)}`);
        const imgJson = await imgRes.json();
        if (imgRes.ok && imgJson.url) cover = imgJson.url;
      } catch {
        // 转存失败则保留原始地址，展示时仍走代理
      }
    }
    setDraftOptions((prev) => prev.some((o) => o.subject_id === hit.id)
      ? prev
      : [
          ...prev,
          {
            subject_id: hit.id,
            title: hit.nameCn || hit.name,
            cover,
            cover_source: hit.cover || null,
            platform: hit.platform || null,
          },
        ]);
    setCreateMsg("");
  };

  const doCreate = async () => {
    if (!draftTitle.trim()) { setCreateMsg("请填写投票标题"); return; }
    if (draftOptions.length < 2) { setCreateMsg("请至少添加两个游戏选项"); return; }
    const hours = Number(draftHours);
    if (!Number.isFinite(hours) || hours <= 0) { setCreateMsg("请填写有效的持续时间（小时）"); return; }
    setCreating(true);
    setCreateMsg("");
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          duration_hours: hours,
          options: draftOptions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "创建投票失败");
      setCreateOpen(false);
      setSearchOpen(false);
      setSubTab("active");
      await load();
    } catch (e) {
      setCreateMsg(e instanceof Error ? e.message : "创建投票失败");
    } finally {
      setCreating(false);
    }
  };

  const activePolls = polls.filter((p) => p.status === "active");
  const endedPolls = polls.filter((p) => p.status === "ended");
  const visible = subTab === "active" ? activePolls : endedPolls;

  return (
    <section className="card fadein p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">🗳️ 活动 · 游戏投票</h2>
          <p className="mt-0.5 text-xs text-muted">一人一票，截止后自动公布得票结果</p>
        </div>
        {admin ? (
          <button type="button" onClick={openCreate} className="btn w-full sm:w-auto">＋ 新建投票</button>
        ) : null}
      </div>

      <div className="mb-5 inline-flex rounded-full border border-butter-2 bg-cream-2 p-1">
        <button
          type="button"
          onClick={() => setSubTab("active")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${subTab === "active" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}
        >
          进行中 <span className="text-xs opacity-80">({activePolls.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("ended")}
          className={`rounded-full px-4 py-1.5 text-sm transition ${subTab === "ended" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}
        >
          往期投票 <span className="text-xs opacity-80">({endedPolls.length})</span>
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}。请确认已执行 supabase/migration-v4.sql。
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-14 text-muted"><span className="spinner" /></div>
      ) : visible.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted">
          <div className="mb-2 text-4xl">{subTab === "active" ? "🗳️" : "🗂️"}</div>
          <p>{subTab === "active" ? "暂时没有进行中的投票，等等管理员发起吧～" : "还没有往期投票。"}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              me={me}
              admin={admin}
              now={now}
              voting={votingId === poll.id}
              deleting={deletingId === poll.id}
              onVote={(p, o) => void doVote(p, o)}
              onDelete={(p) => void doDelete(p)}
              onLogin={onLogin}
            />
          ))}
        </div>
      )}

      {createOpen && admin ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
          <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">＋ 新建投票</h3>
              <button type="button" onClick={() => setCreateOpen(false)} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
            </div>
            <p className="mt-1 text-xs text-muted">仅管理员可见。投票创建后立即对所有人生效，到时间自动截止。</p>

            <label className="mt-5 block text-sm font-medium">投票标题</label>
            <input
              value={draftTitle}
              maxLength={120}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="例如：今年你最喜欢哪款游戏？"
              className="input mt-2"
            />

            <label className="mt-4 block text-sm font-medium">持续时间（小时）</label>
            <input
              type="number"
              min={0.05}
              max={8760}
              step="any"
              value={draftHours}
              onChange={(e) => setDraftHours(e.target.value)}
              className="input mt-2"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDraftHours(String(p.value))}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${draftHours === String(p.value) ? "bg-primary text-white" : "bg-cream-2 text-muted hover:text-primary-dark"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <label className="block text-sm font-medium">投票选项（游戏）</label>
              <span className="text-xs text-muted">已添加 {draftOptions.length} 个</span>
            </div>
            <div className="mt-2 space-y-2">
              {draftOptions.length === 0 ? (
                <div className="grid h-20 place-items-center rounded-xl border border-dashed border-butter-2 bg-cream-2 text-xs text-muted">
                  还没有选项，点下方按钮从 Bangumi 搜索添加
                </div>
              ) : (
                draftOptions.map((o, i) => (
                  <div key={o.subject_id} className="flex items-center gap-2.5 rounded-xl border border-butter-2 bg-cream-2 p-2">
                    <OptionCover src={o.cover} alt={o.title} />
                    <span className="w-5 shrink-0 text-xs text-muted">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" title={o.title}>{o.title}</span>
                    <button
                      type="button"
                      onClick={() => setDraftOptions((prev) => prev.filter((x) => x.subject_id !== o.subject_id))}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:bg-butter/30 hover:text-red-600"
                    >
                      移除
                    </button>
                  </div>
                ))
              )}
            </div>
            <button type="button" onClick={() => setSearchOpen(true)} className="btn-ghost mt-2 w-full">
              🔍 从 Bangumi 添加游戏选项
            </button>
            <p className="mt-1 text-[11px] text-muted">可多次搜索、连续添加，选项数量不设上限；至少两个选项才能创建。</p>

            {createMsg ? <p className="mt-3 text-xs text-red-600">{createMsg}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn-ghost">取消</button>
              <button type="button" onClick={() => void doCreate()} disabled={creating} className="btn">
                {creating ? "创建中…" : "创建投票"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <SearchDialog
        open={searchOpen && createOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(hit) => void addOption(hit)}
        multiple
        selectedIds={draftOptions.map((o) => o.subject_id)}
        title="选择投票选项"
        hint="搜索游戏并添加为投票选项，可连续选择多个"
      />
    </section>
  );
}
