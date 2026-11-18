"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SearchDialog from "./SearchDialog";
import { avatarColor, getNick, getOwnerKey, setNick } from "./identity";
import type { Entry, GameHit } from "@/lib/types";

type Tab = "mine" | "square";

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

function Cover({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-[#FFF3DA] ${className || ""}`}>
      {!failed && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-3xl text-primary/25">🎮</span>
      )}
    </div>
  );
}

export default function HomeClient() {
  const [ownerKey, setOwnerKey] = useState("");
  const [nick, setNickState] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("mine");
  const [searchOpen, setSearchOpen] = useState(false);
  const [configError, setConfigError] = useState("");

  const [nickModal, setNickModal] = useState(false);
  const [nickDraft, setNickDraft] = useState("");

  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editThoughts, setEditThoughts] = useState("");
  const [editScore, setEditScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [squareQuery, setSquareQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entries", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      setEntries(json.items || []);
      setConfigError("");
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "读取清单失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const k = getOwnerKey();
    const n = getNick();
    setOwnerKey(k);
    setNickState(n);
    if (!n) {
      setNickDraft("");
      setNickModal(true);
    }
    void load();
  }, [load]);

  const saveNick = () => {
    const v = nickDraft.trim().slice(0, 20);
    if (!v) return;
    setNick(v);
    setNickState(v);
    setNickModal(false);
  };

  const addGame = async (hit: GameHit) => {
    // 图片本地化：让服务端把 Bangumi 封面抓取、校验并转存到 Supabase Storage，拿到永久公开地址。
    // 转存失败时回退存原始地址，前端仍能显示（不阻断加入清单）。
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
      owner_name: nick || "匿名群友",
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
    if (!r.ok) {
      alert(json.error || "移除失败");
      return;
    }
    await load();
  };

  const mine = useMemo(() => entries.filter((e) => e.owner_key === ownerKey), [entries, ownerKey]);
  const years = useMemo(() => Array.from(new Set(entries.map((e) => e.play_year).filter(Boolean))).sort((a, b) => b - a), [entries]);
  const filteredSquare = useMemo(() => {
    const q = squareQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (yearFilter && String(e.play_year) !== yearFilter) return false;
      if (!q) return true;
      return [e.title, e.owner_name, e.thoughts].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [entries, squareQuery, yearFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>();
    filteredSquare.forEach((e) => {
      const k = `${e.owner_key}|${e.owner_name}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return Array.from(m.values());
  }, [filteredSquare]);

  const stats = useMemo(() => ({
    games: entries.length,
    friends: new Set(entries.map((e) => e.owner_key)).size,
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
            <span>我是：<b>{nick || "未设置"}</b></span>
            <button type="button" onClick={() => { setNickDraft(nick); setNickModal(true); }} className="text-xs text-primary-dark underline">修改</button>
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
            读取失败：{configError}。请确认已按 README 配置 Supabase 并部署好服务端 API。
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
              {loading ? (
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
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => openEdit(e)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark">{e.thoughts ? "编辑" : "写感想"}</button>
                          <button type="button" onClick={() => void removeEntry(e)} className="rounded-lg border border-butter-2 px-3 py-1.5 text-xs text-muted hover:bg-butter/30">移除</button>
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
            <h2 className="mb-4 text-lg font-medium">🌈 群友广场 <span className="ml-2 text-xs font-normal text-muted">看看大家今年都在玩什么</span></h2>
            <div className="mb-5 flex flex-wrap gap-3">
              <input value={squareQuery} onChange={(e) => setSquareQuery(e.target.value)} placeholder="搜索游戏名、群友昵称或感想…" className="input min-w-[220px] flex-1" />
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input w-auto">
                <option value="">全部年份</option>
                {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
              </select>
            </div>
            {loading ? (
              <div className="flex justify-center py-14 text-muted"><span className="spinner" /></div>
            ) : groups.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted">还没有人分享游戏，快来当第一个吧！</div>
            ) : (
              <div className="space-y-7">
                {groups.map((list) => {
                  const who = list[0].owner_name || "匿名群友";
                  return (
                    <div key={list[0].owner_key}>
                      <div className="mb-3 flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full font-medium text-white" style={{ background: avatarColor(who) }}>{who.slice(0, 1)}</div>
                        <div>
                          <div className="font-medium">{who} {list[0].owner_key === ownerKey ? <span className="ml-1 rounded-full bg-butter/40 px-2 py-0.5 text-[11px] text-primary-dark">我</span> : null}</div>
                          <div className="text-xs text-muted">分享了 {list.length} 款游戏</div>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((e) => (
                          <div key={e.id} className="flex gap-3 rounded-xl border border-butter-2 bg-cream-2 p-3">
                            <Cover src={e.cover} alt={e.title} className="h-20 w-14 shrink-0 rounded-lg" />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium" title={e.title}>{e.title}</div>
                              <div className="truncate text-xs text-muted">{[e.play_year, e.platform].filter(Boolean).join(" · ")} <Stars value={e.my_score} /></div>
                              {e.thoughts ? <div className="thought-box mt-1.5 max-h-16 overflow-auto rounded-lg bg-white/80 p-1.5 text-xs text-ink">{e.thoughts}</div> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <footer className="pt-12 text-center text-xs text-muted">数据保存在你自己的 Supabase · 游戏资料由 Bangumi 提供</footer>
      </main>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={addGame} />

      {nickModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-butter-2 bg-cream p-6 shadow-2xl">
            <h3 className="text-lg font-medium">先取个昵称吧 👋</h3>
            <p className="mt-1 text-xs text-muted">昵称会显示在你的清单和群友广场，之后随时可改。</p>
            <label className="mt-4 block text-sm font-medium">你的昵称</label>
            <input autoFocus value={nickDraft} maxLength={20} onChange={(e) => setNickDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveNick(); }} placeholder="例如：小明" className="input mt-2" />
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={saveNick} className="btn">开始记录</button>
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
