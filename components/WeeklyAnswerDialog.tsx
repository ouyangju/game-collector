"use client";

import { useState } from "react";
import SearchDialog from "./SearchDialog";
import CustomGameDialog from "./CustomGameDialog";
import type { GameHit, WeeklyGameInput, WeeklyQuestion } from "@/lib/types";
import { proxiedCover } from "@/lib/img-proxy";

type Props = {
  open: boolean;
  question: WeeklyQuestion;
  // 已有回答的游戏的预填（修改自己的回答时由父层传入）
  initialGames?: WeeklyGameInput[];
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
};

function coverSrc(src: string | null): string | null {
  return proxiedCover(src);
}

// 回答周推问题：搜索/自定义上传选游戏（不写感想），至多 max_games 款
export default function WeeklyAnswerDialog({ open, question, initialGames = [], onClose, onSubmitted }: Props) {
  const [games, setGames] = useState<WeeklyGameInput[]>(initialGames);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  if (!open) return null;

  const addFromSearch = async (hit: GameHit) => {
    if (games.some((g) => g.subject_id === hit.id && g.source === "bangumi")) return;
    if (games.length >= question.max_games) {
      setMsg(`最多只能选 ${question.max_games} 款游戏`);
      return;
    }
    let cover: string | null = hit.cover || null;
    if (hit.cover) {
      try {
        const res = await fetch(`/api/games/image?id=${hit.id}&url=${encodeURIComponent(hit.cover)}`);
        const json = await res.json();
        if (res.ok && json.url) cover = json.url;
      } catch {
        // 保留原始地址
      }
    }
    setGames((prev) => [...prev, {
      subject_id: hit.id,
      source: "bangumi",
      title: hit.nameCn || hit.name,
      cover,
      cover_source: hit.cover || null,
      platform: hit.platform || null,
    }]);
    setMsg("");
  };

  const addCustom = async (data: { title: string; platform: string; cover: string | null }) => {
    if (games.length >= question.max_games) {
      setMsg(`最多只能选 ${question.max_games} 款游戏`);
      return;
    }
    setGames((prev) => [...prev, {
      subject_id: null,
      source: "custom",
      title: data.title,
      cover: data.cover,
      cover_source: null,
      platform: data.platform || null,
    }]);
    setMsg("");
  };

  const submit = async () => {
    if (games.length === 0) { setMsg("请至少选择一款游戏"); return; }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/weekly/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: question.id, games }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "提交失败");
      await onSubmitted();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSaving(false);
    }
  };

  const full = games.length >= question.max_games;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">🗳️ 回答周推游戏</h3>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>
        <div className="mt-3 rounded-xl border border-butter-2 bg-white/70 p-3">
          <div className="text-xs text-muted">本周问题</div>
          <p className="mt-1 text-sm font-medium leading-relaxed text-ink">{question.question}</p>
          <p className="mt-1 text-[11px] text-muted">最多可选 {question.max_games} 款游戏 · 截止 {new Date(question.ends_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-medium">我选择的游戏（{games.length}/{question.max_games}）</span>
          {games.length > 0 ? (
            <button type="button" onClick={() => setGames([])} className="text-[11px] text-muted underline hover:text-red-600">清空</button>
          ) : null}
        </div>
        <div className="mt-2 space-y-2">
          {games.length === 0 ? (
            <div className="grid h-20 place-items-center rounded-xl border border-dashed border-butter-2 bg-cream-2 text-xs text-muted">还没选游戏，从下面添加吧</div>
          ) : games.map((g, i) => {
            const cover = coverSrc(g.cover);
            return (
              <div key={`${g.source}-${g.subject_id}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-butter-2 bg-cream-2 p-2">
                <div className="grid h-12 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#FFF3DA]">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={g.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : <span className="text-lg text-primary/25">🎮</span>}
                </div>
                <span className="w-4 shrink-0 text-xs text-muted">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={g.title}>{g.title}</span>
                {g.source === "custom" ? <span className="shrink-0 rounded-full bg-butter/40 px-1.5 py-0.5 text-[10px] text-primary-dark">自定义</span> : null}
                <button type="button" onClick={() => setGames((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:text-red-600">移除</button>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" disabled={full} onClick={() => setSearchOpen(true)} className="btn-ghost flex-1 text-xs disabled:opacity-50">🔍 Bangumi 搜索添加</button>
          <button type="button" disabled={full} onClick={() => setCustomOpen(true)} className="btn-ghost flex-1 text-xs disabled:opacity-50">✏️ 自定义上传</button>
        </div>
        {full ? <p className="mt-1 text-center text-[11px] text-muted">已达上限，移除一款后可继续添加</p> : null}

        {msg ? <p className="mt-3 text-xs text-red-600">{msg}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">取消</button>
          <button type="button" onClick={() => void submit()} disabled={saving || games.length === 0} className="btn">{saving ? "提交中…" : "提交回答"}</button>
        </div>
      </div>

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(hit) => void addFromSearch(hit)}
        multiple
        selectedIds={games.filter((g) => g.source === "bangumi").map((g) => g.subject_id as number)}
        title="选择游戏加入回答"
        hint={`为「${question.question}」选择游戏，可连续选多个`}
      />
      <CustomGameDialog open={customOpen} onClose={() => setCustomOpen(false)} onAdd={addCustom} />
    </div>
  );
}
