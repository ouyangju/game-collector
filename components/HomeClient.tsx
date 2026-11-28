"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchDialog from "./SearchDialog";
import EventsPanel from "./EventsPanel";
import ProfileEditor from "./ProfileEditor";
import ProfileDialog from "./ProfileDialog";
import MyHome from "./MyHome";
import UserAvatar from "./UserAvatar";
import HeroSection from "./HeroSection";
import WeeklyPanel from "./WeeklyPanel";
import WeeklyAnswerDialog from "./WeeklyAnswerDialog";
import { proxiedCover } from "@/lib/img-proxy";
import RichText, { richTextPreview, richTextToPlain } from "@/lib/richtext";
import RichTextEditor from "./RichTextEditor";
import DraftBox from "./DraftBox";
import PhotosPanel from "./PhotosPanel";
import { draftId, deleteDraft, loadDrafts, saveDraft, type Draft, type DraftKind } from "@/lib/drafts";
import SiteEditor from "./SiteEditor";
import CustomGameDialog from "./CustomGameDialog";
import { getOwnerKey } from "./identity";
import type {
  Announcement,
  Comment,
  Entry,
  GameHit,
  HeroImage,
  SessionUser,
  WeeklyQuestion,
} from "@/lib/types";

type Tab = "mine" | "square" | "events" | "weekly" | "photos";
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

/** 长感想默认折叠：纯文本超过 100 字时只显示前 100 字，点开看全文（富文本渲染） */
function FoldableThoughts({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const plain = richTextToPlain(text);
  const long = plain.length > 100;
  const preview = long ? richTextPreview(text, 100) + "…" : null;

  return (
    <div className={`thought-box ${className}`}>
      {long && !expanded ? (
        <span>{preview}</span>
      ) : (
        <RichText text={text} />
      )}
      {long ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="ml-1 text-xs text-primary-dark underline hover:no-underline">
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}
    </div>
  );
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
  posterAvatar,
  posterName,
  onOpenProfile,
  onSaveDraft,
  prefill,
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
  posterAvatar?: string | null;
  posterName?: string;
  onOpenProfile: (userId: string) => void;
  onSaveDraft: (entry: Entry, text: string) => void;
  prefill?: { entryId: number; content: string; nonce: number } | null;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const isMine = me ? (entry.user_id ? entry.user_id === me.id : entry.owner_key === ownerKey) : false;
  const who = entry.user_id && posterName ? posterName : (entry.owner_name || "匿名群友");

  // 评论草稿从草稿箱回填
  useEffect(() => {
    if (prefill && prefill.entryId === entry.id) setDraft(prefill.content);
  }, [prefill, entry.id]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const ok = await onAddComment(entry, text);
    if (ok) setDraft("");
    setSending(false);
  };

  return (
    <article className="rounded-2xl border border-butter-2 bg-white/85 p-3.5 shadow-card fadein sm:p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <UserAvatar name={who} avatar={posterAvatar} size={36} onClick={entry.user_id ? () => onOpenProfile(entry.user_id!) : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {entry.user_id ? (
              <button type="button" onClick={() => onOpenProfile(entry.user_id!)} className="truncate hover:text-primary-dark hover:underline" title="查看 TA 的主页">{who}</button>
            ) : (
              <span className="truncate">{who}</span>
            )}
            {isMine ? <span className="shrink-0 rounded-full bg-butter/40 px-2 py-0.5 text-[11px] text-primary-dark">我</span> : null}
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
          <div className="mt-0.5 truncate text-xs text-muted">{[entry.play_year, entry.platform, entry.source === "custom" ? "自定义" : entry.bangumi_rating ? `Bangumi ${entry.bangumi_rating}` : ""].filter(Boolean).join(" · ")}</div>
          <div className="mt-1"><Stars value={entry.my_score} /></div>
        </div>
      </div>

      {entry.thoughts ? (
        <FoldableThoughts
          text={entry.thoughts}
          className="mt-3 rounded-lg bg-cream-2 p-2.5 text-sm leading-relaxed text-ink"
        />
      ) : null}

      {/* 默认展示第一条评论（未展开评论区时） */}
      {!commentsOpen && entry.first_comment ? (
        <div className="mt-2 rounded-lg border border-butter-2 bg-butter/15 p-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-primary-dark">{entry.first_comment.author_name}</span>
            <span className="text-muted">评论：</span>
          </div>
          <div className="thought-box mt-1 text-[13px] leading-relaxed text-ink">
            <RichText text={entry.first_comment.content} />
          </div>
          {(entry.comment_count || 0) > 1 ? (
            <button type="button" onClick={() => onToggleComments(entry)} className="mt-1 text-[11px] text-muted hover:text-primary-dark hover:underline">
              查看全部 {entry.comment_count} 条评论 →
            </button>
          ) : null}
        </div>
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
                      <button type="button" onClick={() => onDeleteComment(c)} className="ml-auto shrink-0 text-[11px] text-muted underline hover:text-red-600">删除</button>
                    ) : null}
                  </div>
                  <div className="thought-box mt-1 text-ink"><RichText text={c.content} /></div>
                </div>
              );
            })
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <RichTextEditor
              value={draft}
              onChange={setDraft}
              maxLength={3000}
              rows={3}
              placeholder="写下你的评论…（Ctrl/⌘ + Enter 发送）"
              className="min-w-0 flex-1"
              onSubmitShortcut={() => void send()}
            />
            <div className="flex shrink-0 items-end gap-2 self-end">
              <button type="button" onClick={() => onSaveDraft(entry, draft)} disabled={!draft.trim()} className="btn-ghost px-3 py-2 text-xs disabled:opacity-40">💾 存草稿</button>
              <button type="button" onClick={() => void send()} disabled={sending || !draft.trim()} className="btn shrink-0 px-4 sm:px-4">{sending ? "…" : "发送"}</button>
            </div>
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
  // 游客模式：可浏览全部内容，但不能发帖/评论/点赞/投票（这些操作会弹出登录框）
  const [guest, setGuest] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, { nickname: string; avatar: string | null }>>({});
  const [profileOpen, setProfileOpen] = useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("mine");
  const [searchOpen, setSearchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [configError, setConfigError] = useState("");

  // 站点头图（多张轮播）/ 公告（多条 + 往期）
  const [heroes, setHeroes] = useState<HeroImage[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [archived, setArchived] = useState<Announcement[]>([]);
  const [editSiteOpen, setEditSiteOpen] = useState(false);

  const admin = me?.role === "admin";

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

  // 草稿箱（存本机，按用户/访客隔离）
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftBoxOpen, setDraftBoxOpen] = useState(false);
  const [commentPrefill, setCommentPrefill] = useState<{ entryId: number; content: string; nonce: number } | null>(null);
  const draftScope = me?.id ? `user:${me.id}` : `guest:${ownerKey || "anon"}`;

  const [squareQuery, setSquareQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("time");
  const [squarePage, setSquarePage] = useState(1);

  const [openComments, setOpenComments] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);

  // 周推游戏
  const [weekly, setWeekly] = useState<WeeklyQuestion[]>([]);
  const [weeklyAnswerOpen, setWeeklyAnswerOpen] = useState<WeeklyQuestion | null>(null);

  const loadWeekly = useCallback(async () => {
    try {
      const res = await fetch("/api/weekly", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setWeekly(json.items || []);
    } catch {
      // 周推读取失败不影响主功能
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const [heroRes, noticeRes] = await Promise.all([
        fetch("/api/settings/hero", { cache: "no-store" }),
        fetch("/api/announcements", { cache: "no-store" }),
      ]);
      if (heroRes.ok) {
        const heroJson = await heroRes.json();
        setHeroes(heroJson.items || []);
      }
      if (noticeRes.ok) {
        const noticeJson = await noticeRes.json();
        setAnnouncements(noticeJson.active || []);
        setArchived(noticeJson.archived || []);
      }
    } catch {
      // 头图/公告读取失败不影响主功能
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entries", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      setEntries(json.items || []);
      if (json.user) setMe(json.user);
      if (json.users) setUserMap(json.users);
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
        if (json.user) {
          setMe(json.user);
          localStorage.removeItem("gamewall_guest");
        } else if (localStorage.getItem("gamewall_guest") === "1") {
          setGuest(true);
        } else {
          setLoginOpen(true);
        }
      } catch {
        setLoginOpen(true);
      } finally {
        setAuthLoading(false);
      }
    })();
    void load();
    void loadSettings();
    void loadWeekly();
  }, [load, loadSettings, loadWeekly]);

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
      setGuest(false);
      localStorage.removeItem("gamewall_guest");
      setLoginOpen(false);
      setLoginPass("");
      await load();
      await loadWeekly();
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoginBusy(false);
    }
  };

  const doLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setMe(null);
    setGuest(false);
    localStorage.removeItem("gamewall_guest");
    setOpenComments(null);
    setEditSiteOpen(false);
    setProfileOpen(null);
    setProfileEditorOpen(false);
    setLoginUser("");
    setLoginPass("");
    setLoginOpen(true);
    void loadWeekly();
  };

  const enterAsGuest = () => {
    localStorage.setItem("gamewall_guest", "1");
    setGuest(true);
    setLoginOpen(false);
    setLoginError("");
    setLoginPass("");
  };

  const onProfileSaved = async (updated: { nickname: string; avatar: string | null; bio: string }, wasSelf: boolean) => {
    if (wasSelf) {
      setMe((prev) => prev ? { ...prev, ...updated } : prev);
      await load();
    }
    await loadSettings();
  };

  const openSiteEditor = () => setEditSiteOpen(true);

  // 自定义游戏写入清单（subject_id 为空、source=custom）
  const addCustomGame = async (data: { title: string; platform: string; cover: string | null }) => {
    if (!me) { setLoginOpen(true); return; }
    const payload = {
      owner_key: ownerKey,
      source: "custom",
      subject_id: null,
      title: data.title,
      cover: data.cover,
      cover_source: null,
      platform: data.platform || null,
      air_date: null,
      bangumi_rating: null,
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
      source: "bangumi",
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
      removeDraft(draftId("thoughts", editEntry.id));
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
    removeDraft(draftId("comment", e.id));
    setCommentPrefill((prev) => prev?.entryId === e.id ? null : prev);
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

  // ---------- 草稿箱 ----------
  useEffect(() => {
    if (draftScope) setDrafts(loadDrafts(draftScope));
  }, [draftScope]);

  const storeDraft = (kind: DraftKind, e: Entry, content: string, score: number | null) => {
    const d: Draft = {
      id: draftId(kind, e.id),
      kind,
      entryId: e.id,
      entryTitle: e.title,
      entryCover: e.cover,
      content,
      score,
      savedAt: Date.now(),
    };
    setDrafts(saveDraft(draftScope, d));
  };

  const removeDraft = (id: string) => setDrafts(deleteDraft(draftScope, id));

  const loadDraftIntoEditor = (d: Draft) => {
    const e = entries.find((x) => x.id === d.entryId);
    setDraftBoxOpen(false);
    if (!e) {
      alert("这款游戏已不在清单中，无法恢复草稿");
      return;
    }
    if (d.kind === "thoughts") {
      setTab("mine");
      setEditEntry(e);
      setEditThoughts(d.content);
      setEditScore(d.score);
    } else {
      // 评论草稿：跳到广场对应月份、展开评论并回填输入框
      setTab("square");
      setSquareQuery("");
      setMonthFilter(monthKey(e.created_at));
      setSquarePage(1);
      setOpenComments(e.id);
      if (!commentsMap[e.id]) void loadComments(e.id);
      setCommentPrefill({ entryId: e.id, content: d.content, nonce: Date.now() });
    }
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
      return [e.title, e.owner_name, richTextToPlain(e.thoughts)].some((v) => String(v || "").toLowerCase().includes(q));
    });
    list.sort((a, b) => sortBy === "likes"
      ? (b.like_count || 0) - (a.like_count || 0) || b.created_at.localeCompare(a.created_at)
      : b.created_at.localeCompare(a.created_at));
    return list;
  }, [entries, squareQuery, effectiveMonth, sortBy]);

  const SQUARE_PAGE_SIZE = 8;
  const squareTotalPages = Math.max(1, Math.ceil(squarePosts.length / SQUARE_PAGE_SIZE));
  const safeSquarePage = Math.min(squarePage, squareTotalPages);
  const squarePagePosts = squarePosts.slice((safeSquarePage - 1) * SQUARE_PAGE_SIZE, safeSquarePage * SQUARE_PAGE_SIZE);

  const stats = useMemo(() => ({
    games: entries.length,
    friends: new Set(entries.map((e) => e.user_id || e.owner_key)).size,
    thoughts: entries.filter((e) => e.thoughts?.trim()).length,
  }), [entries]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-butter-2 bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg text-white shadow-card sm:h-10 sm:w-10 sm:text-xl">🎮</div>
            <div>
              <div className="text-base font-medium leading-tight sm:text-lg">游戏墙</div>
              <div className="hidden text-[11px] tracking-wide text-muted sm:block">今年玩过的游戏</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-butter-2 bg-white/80 px-3 py-1.5 text-xs shadow-card sm:gap-3 sm:px-4 sm:text-sm">
            {me ? (
              <UserAvatar name={me.nickname} avatar={me.avatar} size={30} onClick={() => setProfileEditorOpen(true)} title="编辑我的主页" />
            ) : (
              <span className={`h-2 w-2 shrink-0 rounded-full ${guest ? "bg-emerald-500" : "bg-primary"}`} />
            )}
            <span className="max-w-[92px] truncate sm:max-w-none">
              {me ? <>你好，<b>{me.nickname}</b></> : guest ? "游客浏览中" : "未登录"}
            </span>
            {admin ? <span className="hidden rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary-dark sm:inline">管理员</span> : null}
            <button
              type="button"
              onClick={() => setDraftBoxOpen(true)}
              className="relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-primary-dark hover:bg-butter/30"
              title="打开草稿箱"
            >
              📝<span className="hidden sm:inline">草稿箱</span>
              {drafts.length > 0 ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-white">{drafts.length}</span>
              ) : null}
            </button>
            {me ? (
              <button type="button" onClick={() => void doLogout()} className="text-xs text-muted underline hover:text-primary-dark">退出</button>
            ) : (
              <button type="button" onClick={() => setLoginOpen(true)} className="text-xs text-primary-dark underline">登录</button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 pb-16 sm:px-5 sm:pb-20">
        <div className="pt-5 sm:pt-7">
          <HeroSection
            images={heroes}
            announcements={announcements}
            archived={archived}
            isAdmin={admin}
            onEdit={openSiteEditor}
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-sm text-muted sm:gap-6">
          <span><b className="text-lg text-primary-dark">{stats.games}</b> 款游戏</span>
          <span><b className="text-lg text-primary-dark">{stats.friends}</b> 位群友</span>
          <span><b className="text-lg text-primary-dark">{stats.thoughts}</b> 条感想</span>
        </div>

        {configError ? (
          <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            读取失败：{configError}。请确认已按 README 配置 Supabase 并执行了数据库迁移。
          </div>
        ) : null}

        {guest && !me ? (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-butter-2 bg-white/80 px-4 py-3 text-sm text-muted">
            <span>👀 你正在以游客身份浏览，可以查看清单、广场和投票结果；发帖、评论、点赞和投票需要先登录。</span>
            <button type="button" onClick={() => setLoginOpen(true)} className="ml-auto shrink-0 text-primary-dark underline">登录 / 注册</button>
          </div>
        ) : null}

        <div className="mb-6 flex w-full rounded-full border border-butter-2 bg-cream-2 p-1 sm:inline-flex sm:w-auto">
          <button type="button" onClick={() => setTab("mine")} className={`flex-1 rounded-full px-1 py-2 text-[11px] font-medium transition sm:flex-none sm:px-4 sm:text-sm ${tab === "mine" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}>🏠 个人主页</button>
          <button type="button" onClick={() => setTab("square")} className={`flex-1 rounded-full px-1 py-2 text-[11px] font-medium transition sm:flex-none sm:px-4 sm:text-sm ${tab === "square" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}>🌈 群友广场</button>
          <button type="button" onClick={() => setTab("events")} className={`flex-1 rounded-full px-1 py-2 text-[11px] font-medium transition sm:flex-none sm:px-4 sm:text-sm ${tab === "events" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}>🗳️ 活动</button>
          <button type="button" onClick={() => setTab("weekly")} className={`flex-1 rounded-full px-1 py-2 text-[11px] font-medium transition sm:flex-none sm:px-4 sm:text-sm ${tab === "weekly" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}>🗓️ 周推游戏</button>
          <button type="button" onClick={() => setTab("photos")} className={`flex-1 rounded-full px-1 py-2 text-[11px] font-medium transition sm:flex-none sm:px-4 sm:text-sm ${tab === "photos" ? "bg-primary text-white shadow-card" : "text-muted hover:text-ink"}`}>🖼️ 美图分享</button>
        </div>

        {tab === "mine" ? (
          <div className="fadein space-y-6">
            {me ? (
              <MyHome
                me={me}
                games={mine.length}
                thoughts={mine.filter((e) => e.thoughts?.trim()).length}
                onEdit={() => setProfileEditorOpen(true)}
                weekly={weekly.find((q) => q.status === "active") || null}
                onWeeklyAnswer={() => {
                  const q = weekly.find((x) => x.status === "active");
                  if (q) setWeeklyAnswerOpen(q);
                }}
              />
            ) : (
              <section className="card p-5 text-center">
                <div className="mb-2 text-3xl">🏠</div>
                <p className="text-sm text-muted">登录后即可拥有自己的主页，自定义头像、姓名和个性签名。</p>
                <button type="button" onClick={() => setLoginOpen(true)} className="btn mt-3">登录 / 注册</button>
              </section>
            )}

            <section className="card p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">🔍 添加游戏</h2>
                  <p className="text-xs text-muted">从 Bangumi 搜索，或自己上传封面与名字</p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <button type="button" className="btn-ghost flex-1 sm:flex-none" onClick={() => {
                    if (!me) { setLoginOpen(true); return; }
                    setCustomOpen(true);
                  }}>✏️ 自定义添加</button>
                  <button type="button" className="btn flex-1 sm:flex-none" onClick={() => {
                    if (!me) { setLoginOpen(true); return; }
                    setSearchOpen(true);
                  }}>＋ 搜索游戏</button>
                </div>
              </div>
              <p className="text-sm text-muted">「搜索游戏」从 Bangumi 抓取封面；找不到条目时用「自定义添加」上传自己的图片和游戏名。</p>
            </section>

            <section className="card p-4 sm:p-6">
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
                      <Cover src={e.cover} alt={e.title} className="h-[108px] w-[74px] shrink-0 rounded-lg sm:w-[78px]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium" title={e.title}>{e.title}</div>
                        <div className="mt-0.5 truncate text-xs text-muted">{[e.play_year, e.platform, e.source === "custom" ? "自定义" : e.bangumi_rating ? `Bangumi ${e.bangumi_rating}` : ""].filter(Boolean).join(" · ")}</div>
                        <div className="mt-1"><Stars value={e.my_score} /></div>
                        <div className={`thought-box mt-2 max-h-24 overflow-auto rounded-lg border border-dashed border-butter-2 bg-white/80 p-2 text-xs ${e.thoughts ? "text-ink" : "italic text-muted"}`}>
                          {e.thoughts ? <RichText text={e.thoughts} /> : "还没写感想，点下面按钮记一笔吧～"}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
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
        ) : tab === "events" ? (
          <EventsPanel me={me} admin={admin} onLogin={() => setLoginOpen(true)} />
        ) : tab === "weekly" ? (
          <WeeklyPanel
            items={weekly}
            me={me}
            admin={admin}
            onChanged={loadWeekly}
            onLogin={() => setLoginOpen(true)}
            onAnswer={setWeeklyAnswerOpen}
          />
        ) : tab === "photos" ? (
          <PhotosPanel
            me={me}
            admin={admin}
            onLogin={() => setLoginOpen(true)}
            onOpenProfile={(uid) => setProfileOpen(uid)}
          />
        ) : (
          <section className="card fadein p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">🌈 群友广场</h2>
              <span className="hidden text-xs text-muted sm:inline">按月查看大家的分享</span>
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input value={squareQuery} onChange={(e) => { setSquareQuery(e.target.value); setSquarePage(1); }} placeholder="搜索游戏名、群友或感想…" className="input w-full sm:min-w-[200px] sm:flex-1" />
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortBy); setSquarePage(1); }} className="input w-full sm:w-auto" title="排序方式">
                <option value="time">按发布时间</option>
                <option value="likes">按点赞数量</option>
              </select>
            </div>

            <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto border-b border-butter-2 px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {months.length === 0 ? (
                <span className="text-xs text-muted">暂无帖子</span>
              ) : months.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMonthFilter(m); setSquarePage(1); }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${effectiveMonth === m ? "bg-primary text-white shadow-card" : "bg-cream-2 text-muted hover:text-primary-dark"}`}
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
                {squarePagePosts.map((e) => (
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
                    posterAvatar={e.user_id ? userMap[e.user_id]?.avatar : null}
                    posterName={e.user_id ? userMap[e.user_id]?.nickname : undefined}
                    onOpenProfile={(uid) => setProfileOpen(uid)}
                    onSaveDraft={(entry, text) => {
                      storeDraft("comment", entry, text, null);
                      alert("评论草稿已存入草稿箱");
                    }}
                    prefill={commentPrefill?.entryId === e.id ? commentPrefill : null}
                  />
                ))}
              </div>
            )}

            {!loading && !authLoading && squarePosts.length > SQUARE_PAGE_SIZE ? (
              <div className="mt-5 flex items-center justify-center gap-2">
                <button type="button" onClick={() => { setSquarePage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={safeSquarePage <= 1} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">上一页</button>
                <span className="text-sm text-muted">{safeSquarePage} / {squareTotalPages}</span>
                <button type="button" onClick={() => { setSquarePage((p) => Math.min(squareTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={safeSquarePage >= squareTotalPages} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">下一页</button>
              </div>
            ) : null}
          </section>
        )}

        <footer className="pt-10 text-center text-xs text-muted sm:pt-12">数据保存在你自己的 Supabase · 游戏资料由 Bangumi 提供</footer>
      </main>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={addGame} />

      <CustomGameDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={addCustomGame}
      />

      <SiteEditor
        open={editSiteOpen && admin}
        onClose={() => setEditSiteOpen(false)}
        heroes={heroes}
        announcements={announcements}
        archived={archived}
        onChanged={loadSettings}
      />

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
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={enterAsGuest} className="btn-ghost w-full sm:w-auto">👀 游客浏览</button>
              <button type="button" onClick={() => void doLogin()} disabled={loginBusy} className="btn w-full sm:w-auto">{loginBusy ? "登录中…" : "进入游戏墙"}</button>
            </div>
            <p className="mt-3 text-center text-[11px] text-muted">游客可浏览全部内容，但发帖、评论、点赞和投票需先登录。</p>
          </div>
        </div>
      ) : null}

      {editEntry ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditEntry(null); }}>
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium sm:text-xl">写下游玩感想</h3>
                <p className="mt-1 text-xs text-muted">{editEntry.title}</p>
              </div>
              <button type="button" onClick={() => setEditEntry(null)} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
            </div>
            <label className="mt-5 block text-sm font-medium">我的评分</label>
            <div className="mt-1"><Stars value={editScore} onChange={setEditScore} /></div>
            <label className="mt-4 block text-sm font-medium">感想 / 心得</label>
            <RichTextEditor
              value={editThoughts}
              onChange={setEditThoughts}
              maxLength={2000}
              rows={9}
              textareaClassName="min-h-[180px] sm:min-h-[260px] text-sm sm:text-base"
              placeholder="这款游戏哪里打动了你？通关了吗？选中文字可加粗、加剧透黑框等格式"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { storeDraft("thoughts", editEntry, editThoughts, editScore); alert("感想草稿已存入草稿箱"); }}
                disabled={!editThoughts.trim() && editScore === null}
                className="btn-ghost disabled:opacity-40"
              >💾 存草稿</button>
              <button type="button" onClick={() => setEditEntry(null)} className="btn-ghost">取消</button>
              <button type="button" onClick={() => void saveEdit()} disabled={saving} className="btn">{saving ? "保存中…" : "保存感想"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {profileOpen && me ? (
        <ProfileDialog
          userId={profileOpen}
          me={me}
          admin={admin}
          onClose={() => setProfileOpen(null)}
          onProfileUpdated={() => void load()}
        />
      ) : null}

      {profileEditorOpen && me ? (
        <ProfileEditor
          me={me}
          onClose={() => setProfileEditorOpen(false)}
          onSaved={(updated, wasSelf) => onProfileSaved(updated, wasSelf)}
        />
      ) : null}

      {weeklyAnswerOpen && me ? (
        <WeeklyAnswerDialog
          key={weeklyAnswerOpen.id}
          open
          question={weeklyAnswerOpen}
          initialGames={(weeklyAnswerOpen.answers.find((a) => a.user_id === me.id)?.games || []).map((g) => ({
            subject_id: g.subject_id,
            source: g.source,
            title: g.title,
            cover: g.cover,
            cover_source: g.cover_source,
            platform: g.platform,
          }))}
          onClose={() => setWeeklyAnswerOpen(null)}
          onSubmitted={loadWeekly}
        />
      ) : null}

      <DraftBox
        open={draftBoxOpen}
        drafts={drafts}
        onClose={() => setDraftBoxOpen(false)}
        onLoad={loadDraftIntoEditor}
        onDelete={removeDraft}
      />
    </>
  );
}
