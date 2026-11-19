"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SearchDialog from "./SearchDialog";
import { avatarColor, getOwnerKey } from "./identity";
import type {
  Comment,
  Entry,
  GameHit,
  SessionUser,
} from "@/lib/types";

type Tab = "mine" | "square";
type SortBy = "time" | "likes";

function Stars({ value, onChange }: { value: number | null; onChange?: (n: number | null) => void }) {
  const n = value || 0;
  return (
    <span className="text-lg leading-none tracking-tight" role={onChange ? "group" : undefined} aria-label="评分">
      {[1, 2, 3, 4, 5].map((i) =>
        onChange ? (
          <button
            key={i}
            type="button"
            aria-label={`${i} 星`}
            onClick={() => onChange(i === n ? null : i)}
            className={i <= n ? "star-on" : "star-off"}
          >
            {i <= n ? "★" : "☆"}
          </button>
        ) : (
          <span key={i} className={i <= n ? "star-on" : "star-off"}>{i <= n ? "★" : "☆"}</span>
        )
      )}
    </span>
  );
}

function proxiedCover(src: string | null): string | null {
  if (!src) return null;
  if (src.includes("lain.bgm.tv")) {
    return `/api/games/thumbnail?url=${encodeURIComponent(src)}`;
  }
  return src;
}

function Cover({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const displaySrc = proxiedCover(src);
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-[#FFF3DA] ${className || ""}`}>
      {!failed && displaySrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displaySrc} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-3xl text-primary/25">🎮</span>
      )}
    </div>
  );
}

// 统一东八区的月份 key：YYYY-MM
function monthKey(iso: string): string {
  const d = new Date(iso);
  const cn = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return `${cn.getUTCFullYear()}-${String(cn.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y} 年 ${Number(m)} 月`;
}

// 一条帖子卡片（广场里展示，含点赞/评论）
function PostCard({
  entry,
  me,
  ownerKey,
  onLike,
  onToggleComments,
  commentsOpen,
  comments,
  commentsLoading,
  onAddComment,
  onDeleteComment,
}: {
  entry: Entry;
  me: SessionUser | null;
  ownerKey: string;
  onLike: (e: Entry) => void;
  onToggleComments: (e: Entry) => void;
  commentsOpen: boolean;
  comments: Comment[];
  commentsLoading: boolean;
  onAddComment: (e: Entry, text: string) => Promise<boolean>;
  onDeleteComment: (c: Comment) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const isMine = me ? (entry.user_id ? entry.user_id === me.id : entry.owner_key === ownerKey) : false;
  const who = entry.owner_name || "匿名群友";

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await onAddComment(entry, text);
    if (ok) setDraft("");
    setSending(false);
  };

  return (
    <article className="rounded-2xl border border-butter-2 bg-white/85 p-4 shadow-card fadein">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-full font-medium text-white" style={{ background: avatarColor(who) }}>{who.slice(0, 1)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{who}</span>
            {isMine ? <span className="rounded-full bg-butter/40 px-2 py-0.5 text-[11px] text-primary-dark">我</span> : null}
          </div>
          <div className="text-[11px] text-muted">
            {new Date(entry.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Cover src={entry.cover} alt={entry.title} className="h-[104px] w-[76px] shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium" title={entry.title}>{entry.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted">{[entry.play_year, entry.platform, entry.bangumi_rating ? `Bangumi ${entry.bangumi_rating}` : ""].filter(Boolean).join(" · ")}</div>
          <div className="mt-1"><Stars value={entry.my_score} /></div>
        </div>
      </div>

      {entry.thoughts ? (
        <div className="thought-box mt-3 rounded-lg bg-cream-2 p-2.5 text-sm leading-relaxed text-ink">{entry.thoughts}</div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-butter-2 pt-3">
        <button
          type="button"
          onClick={() => onLike(entry)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${entry.liked_by_me ? "border-primary bg-primary text-white" : "border-butter-2 bg-cream-2 text-muted hover:text-primary-dark"}`}
        >
          <span className="text-base leading-none">{entry.liked_by_me ? "♥" : "♡"}</span>
          {entry.like_count || 0}
        </button>
        <button
          type="button"
          onClick={() => onToggleComments(entry)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${commentsOpen ? "border-primary bg-butter/30 text-primary-dark" : "border-butter-2 bg-cream-2 text-muted hover:text-primary-dark"}`}
        >
          <span className="text-base leading-none">💬</span>
          {entry.comment_count || 0}
        </button>
      </div>

      {commentsOpen ? (
        <div className="mt-3 space-y-2 border-t border-butter-2 pt-3">
          {commentsLoading ? (
            <div className="flex justify-center py-3 text-muted"><span className="spinner" /></div>
          ) : comments.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted">还没有评论，来说两句吧～</p>
          ) : (
            comments.map((c) => {
              const mine = me ? c.user_id === me.id : false;
              return (
                <div key={c.id} className="rounded-xl bg-cream-2 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary-dark">{c.author_name}</span>
                    <span className="text-[11px] text-muted">{new Date(c.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    {mine ? (
                      <button type="button" onClick={() => onDeleteComment(c)} className="ml-auto text-[11px] text-muted underline hover:text-red-600">删除</button>
                    ) : null}
                  </div>
                  <div className="thought-box mt-1 text-ink">{c.content}</div>
                </div>
              );
            })
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
              maxLength={500}
              placeholder="写下你的评论…"
              className="input flex-1"
            />
            <button type="button" onClick={() => void send()} disabled={sending || !draft.trim()} className="btn px-4">{sending ? "…" : "发送"}</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function HomeClient() {
  const [ownerKey, setOwnerKey] = useState("");
  const [me, setMe] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("mine");
  const [searchOpen, setSearchOpen] = useState(false);
  const [configError, setConfigError] = useState("");

  // 登录弹窗
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editThoughts, setEditThoughts] = useState("");
  const [editScore, setEditScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [squareQuery, setSquareQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("time");

  const [openComments, setOpenComments] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entries", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      setEntries(json.items || []);
      if (json.user) setMe(json.user);
      setConfigError("");
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "读取清单失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOwnerKey(getOwnerKey());
    // 恢复会话
    (async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        const json = await res.json();
        if (json.user) setMe(json.user);
        else setLoginOpen(true);
      } catch {
        setLoginOpen(true);
      } finally {
        setAuthLoading(false);
      }
    })();
    void load();
  }, [load]);

  const doLogin = async () => {
    const username = loginUser.trim();
    if (!username || !loginPass) {
      setLoginError("请填写账户名和密码");
      return;
    }
    setLoginBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: loginPass, owner_key: ownerKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "登录失败");
      setMe(json.user);
      setLoginOpen(false);
      setLoginPass("");
      await load();
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoginBusy(false);
    }
  };

  const doLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setMe(null);
    setOpenComments(null);
    setLoginUser("");
    setLoginPass("");
    setLoginOpen(true);
  };

  const addGame = async (hit: GameHit) => {
    if (!me) { setLoginOpen(true); return; }
    let coverUrl: string | null = null;
    if (hit.cover) {
      try {
        const imgRes = await fetch(`/api/games/image?id=${hit.id}&url=${encodeURIComponent(hit.cover)}`);
        const imgJson = await imgRes.json();
        if (imgRes.ok && imgJson.url) coverUrl = imgJson.url;
      } catch {
        // 回退到原始地址
      }
    }
    const payload = {
      owner_key: ownerKey,
      subject_id: hit.id,
      title: hit.nameCn || hit.name,
      cover: coverUrl || hit.cover || null,
      cover_source: hit.cover || null,
      platform: hit.platform || null,
      air_date: hit.date || null,
      bangumi_rating: hit.rating || null,
      thoughts: "",
      my_score: null,
      play_year: new Date().getFullYear(),
    };
    const r = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || "加入清单失败");
    await load();
    setSearchOpen(false);
  };

  const openEdit = (e: Entry) => {
    setEditEntry(e);
    setEditThoughts(e.thoughts || "");
    setEditScore(e.my_score);
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    setSaving(true);
    try {
      const r = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editEntry.id,
          owner_key: ownerKey,
          thoughts: editThoughts,
          my_score: editScore,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "保存失败");
      setEditEntry(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (e: Entry) => {
    if (!confirm(`确定从清单移除「${e.title}」吗？`)) return;
    const r = await fetch(`/api/entries?id=${e.id}&owner_key=${encodeURIComponent(ownerKey)}`, { method: "DELETE" });
    const json = await r.json();
    if (!r.ok) { alert(json.error || "移除失败"); return; }
    await load();
  };

  const onLike = async (e: Entry) => {
    if (!me) { setLoginOpen(true); return; }
    const r = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_id: e.id }),
    });
    const json = await r.json();
    if (!r.ok) { alert(json.error || "操作失败"); return; }
    setEntries((prev) => prev.map((x) => x.id === e.id
      ? { ...x, liked_by_me: json.liked, like_count: json.count }
      : x));
  };

  const loadComments = useCallback(async (entryId: number) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/comments?entry_id=${entryId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取评论失败");
      setCommentsMap((prev) => ({ ...prev, [entryId]: json.items || [] }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "读取评论失败");
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const onToggleComments = (e: Entry) => {
    if (openComments === e.id) { setOpenComments(null); return; }
    setOpenComments(e.id);
    if (!commentsMap[e.id]) void loadComments(e.id);
  };

  const onAddComment = async (e: Entry, text: string): Promise<boolean> => {
    if (!me) { setLoginOpen(true); return false; }
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_id: e.id, content: text }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "评论失败"); return false; }
    setCommentsMap((prev) => ({ ...prev, [e.id]: [...(prev[e.id] || []), json.item] }));
    setEntries((prev) => prev.map((x) => x.id === e.id ? { ...x, comment_count: (x.comment_count || 0) + 1 } : x));
    return true;
  };

  const onDeleteComment = async (c: Comment) => {
    if (!confirm("确定删除这条评论吗？")) return;
    const res = await fetch(`/api/comments?id=${c.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "删除失败"); return; }
    setCommentsMap((prev) => ({ ...prev, [c.entry_id]: (prev[c.entry_id] || []).filter((x) => x.id !== c.id) }));
    setEntries((prev) => prev.map((x) => x.id === c.entry_id ? { ...x, comment_count: Math.max(0, (x.comment_count || 0) - 1) } : x));
  };

  const mine = useMemo(() => entries.filter((e) =>
    me ? (e.user_id ? e.user_id === me.id : e.owner_key === ownerKey) : e.owner_key === ownerKey
  ), [entries, me, ownerKey]);

  const months = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(monthKey(e.created_at)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [entries]);

  const currentMonth = monthKey(new Date().toISOString());
  const effectiveMonth = monthFilter || (months.includes(currentMonth) ? currentMonth : months[0] || currentMonth);

  const squarePosts = useMemo(() => {
    const q = squareQuery.trim().toLowerCase();
    const list = entries.filter((e) => {
      if (monthKey(e.created_at) !== effectiveMonth) return false;
      if (!q) return true;
      return [e.title, e.owner_name, e.thoughts].some((v) => String(v || "").toLowerCase().includes(q));
    });
    list.sort((a, b) => sortBy === "likes"
      ? (b.like_count || 0) - (a.like_count || 0) || b.created_at.localeCompare(a.created_at)
      : b.created_at.localeCompare(a.created_at));
    return list;
  }, [entries, squareQuery, effectiveMonth, sortBy]);

  const stats = useMemo(() => ({
    games: entries.length,
    friends: new Set(entries.map((e) => e.user_id || e.owner_key)).size,
    thoughts: entries.filter((e) => e.thoughts?.trim()).length,
  }), [entries]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-butter-2 bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-xl text-white shadow-card">🎮</div>
            <div>
              <div className="text-lg font-medium leading-tight">游戏墙</div>
              <div className="text-[11px] tracking-wide text-muted">今年玩过的游戏</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 rounded-full border border-butter-2 bg-white/80 px-4 py-1.5 text-sm shadow-card">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span>{me ? <>你好，<b>{me.nickname}</b></> : "未登录"}</span>
            {me ? (
              <button type="button" onClick={() => void doLogout()} className="text-xs text-muted underline hover:text-primary-dark">退出</button>
            ) : (
              <button type="button" onClick={() => setLoginOpen(true)} className="text-xs text-primary-dark underline">登录</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="px-2 py-9 text-center">
          <h1 className="text-3xl font-medium sm:text-4xl">🎲 <span className="text-primary">{new Date().getFullYear()}</span> 游戏墙</h1>
          <p className="mt-2 text-sm text-muted">搜一搜、记一记，把今年玩过的好游戏和心得分享给大家</p>
          <div className="mt-4 inline-flex gap-6 text-sm text-muted">
            <span><b className="text-lg text-primary-dark">{stats.games}</b> 款游戏</span>
            <span><b className="text-lg text-primary-dark">{stats.friends}</b> 位群友</span>
            <span><b className="text-lg text-primary-dark">{stats.thoughts}</b> 条感想</span>
          </div>
        </section>

        {configError ? (
          <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            读取失败：{configError}。请确认已按 README 配置 Supabase 并执行了数据库迁移。
          </div>
        ) : null}

        <div className="mb-6 inline-flex rounded-full border border-butter-2 bg-cream-2 p-1">
          <button type="button" onClick={() => setTab("mine")} className={`rounded-full px-5 py-2 text-sm font-medium transition ${tab === "mine" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}>📚 我的清单</button>
          <button type="button" onClick={() => setTab("square")} className={`rounded-full px-5 py-2 text-sm font-medium transition ${tab === "square" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}>🌈 群友广场</button>
        </div>

        {tab === "mine" ? (
          <div className="fadein space-y-6">
            <section className="card p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">🔍 添加游戏</h2>
                  <p className="text-xs text-muted">从 Bangumi 搜索并自动本地化封面</p>
                </div>
                <button type="button" className="btn" onClick={() => setSearchOpen(true)}>＋ 搜索游戏</button>
              </div>
              <p className="text-sm text-muted">点击右上角「搜索游戏」，输入名字后选择封面即可加入清单。封面由服务端抓取并保存到你自己的存储，不依赖 Bangumi 图床。</p>
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-medium">📚 我的游戏清单 <span className="ml-2 text-xs font-normal text-muted">共 {mine.length} 款</span></h2>
              {loading || authLoading ? (
                <div className="flex justify-center py-14 text-muted"><span className="spinner" /></div>
              ) : mine.length === 0 ? (
                <div className="py-14 text-center text-muted">
                  <div className="mb-2 text-4xl">🎮</div>
                  <p className="text-sm">清单还空着，去上面搜索把今年玩过的游戏加进来吧！</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mine.map((e) => (
                    <div key={e.id} className="flex gap-3 rounded-xl border border-butter-2 bg-cream-2 p-3">
                      <Cover src={e.cover} alt={e.title} className="h-[108px] w-[78px] shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium" title={e.title}>{e.title}</div>
                        <div className="mt-0.5 truncate text-xs text-muted">{[e.play_year, e.platform, e.bangumi_rating ? `Bangumi ${e.bangumi_rating}` : ""].filter(Boolean).join(" · ")}</div>
                        <div className="mt-1"><Stars value={e.my_score} /></div>
                        <div className={`thought-box mt-2 max-h-24 overflow-auto rounded-lg border border-dashed border-butter-2 bg-white/80 p-2 text-xs ${e.thoughts ? "text-ink" : "italic text-muted"}`}>
                          {e.thoughts || "还没写感想，点下面按钮记一笔吧～"}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button type="button" onClick={() => openEdit(e)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark">{e.thoughts ? "编辑" : "写感想"}</button>
                          <button type="button" onClick={() => void removeEntry(e)} className="rounded-lg border border-butter-2 px-3 py-1.5 text-xs text-muted hover:bg-butter/30">移除</button>
                          <span className="ml-auto text-[11px] text-muted">♥ {e.like_count || 0} · 💬 {e.comment_count || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="card fadein p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">🌈 群友广场</h2>
              <span className="text-xs text-muted">按月查看大家的分享</span>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input value={squareQuery} onChange={(e) => setSquareQuery(e.target.value)} placeholder="搜索游戏名、群友或感想…" className="input min-w-[200px] flex-1" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="input w-auto" title="排序方式">
                <option value="time">按发布时间</option>
                <option value="likes">按点赞数量</option>
              </select>
            </div>

            <div className="mb-5 flex flex-wrap gap-2 border-b border-butter-2 pb-3">
              {months.length === 0 ? (
                <span className="text-xs text-muted">暂无帖子</span>
              ) : months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonthFilter(m)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${effectiveMonth === m ? "bg-primary text-white shadow-card" : "bg-cream-2 text-muted hover:text-primary-dark"}`}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>

            {loading || authLoading ? (
              <div className="flex justify-center py-14 text-muted"><span className="spinner" /></div>
            ) : squarePosts.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted">
                <div className="mb-2 text-4xl">🗓️</div>
                <p>{monthLabel(effectiveMonth)}还没有人分享游戏，快来当第一个吧！</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {squarePosts.map((e) => (
                  <PostCard
                    key={e.id}
                    entry={e}
                    me={me}
                    ownerKey={ownerKey}
                    onLike={(x) => void onLike(x)}
                    onToggleComments={onToggleComments}
                    commentsOpen={openComments === e.id}
                    comments={commentsMap[e.id] || []}
                    commentsLoading={commentsLoading && openComments === e.id}
                    onAddComment={onAddComment}
                    onDeleteComment={(c) => void onDeleteComment(c)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="pt-12 text-center text-xs text-muted">数据保存在你自己的 Supabase · 游戏资料由 Bangumi 提供</footer>
      </main>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={addGame} />

      {loginOpen && !me ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-butter-2 bg-cream p-6 shadow-2xl">
            <h3 className="text-lg font-medium">登录游戏墙 👋</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">输入账户名和密码。首次使用的账户名会自动注册；已有账户名需输入正确密码才能登录。之后在本设备无需重复登录。</p>
            <label className="mt-4 block text-sm font-medium">账户名</label>
            <input autoFocus value={loginUser} maxLength={20} onChange={(e) => setLoginUser(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void doLogin(); }} placeholder="2–20 个中文/字母/数字" className="input mt-2" />
            <label className="mt-3 block text-sm font-medium">密码</label>
            <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void doLogin(); }} placeholder="至少 6 位" className="input mt-2" />
            {loginError ? <p className="mt-3 text-xs text-red-600">{loginError}</p> : null}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => void doLogin()} disabled={loginBusy} className="btn">{loginBusy ? "登录中…" : "进入游戏墙"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {editEntry ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditEntry(null); }}>
          <div className="w-full max-w-md rounded-2xl border border-butter-2 bg-cream p-6 shadow-2xl">
            <h3 className="text-lg font-medium">写下游玩感想</h3>
            <p className="mt-1 text-xs text-muted">{editEntry.title}</p>
            <label className="mt-4 block text-sm font-medium">我的评分</label>
            <div className="mt-1"><Stars value={editScore} onChange={setEditScore} /></div>
            <label className="mt-4 block text-sm font-medium">感想 / 心得</label>
            <textarea value={editThoughts} maxLength={2000} onChange={(e) => setEditThoughts(e.target.value)} placeholder="这款游戏哪里打动了你？通关了吗？" className="input mt-2 min-h-[120px] resize-y" />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditEntry(null)} className="btn-ghost">取消</button>
              <button type="button" onClick={() => void saveEdit()} disabled={saving} className="btn">{saving ? "保存中…" : "保存"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
