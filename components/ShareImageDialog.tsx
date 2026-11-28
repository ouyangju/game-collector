"use client";

import { useEffect, useState } from "react";
import type { SessionUser, WeeklyAnswer, WeeklyQuestion } from "@/lib/types";
import { renderShareImage } from "@/lib/share-image";

type Props = {
  open: boolean;
  question: WeeklyQuestion;
  answer: WeeklyAnswer;
  me: SessionUser | null;
  onClose: () => void;
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric",
  });
}

/** 周推回答分享图：预览 + 下载 PNG */
export default function ShareImageDialog({ open, question, answer, me, onClose }: Props) {
  const [img, setImg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImg("");
    setError("");
    setBusy(true);
    renderShareImage({
      question: question.question,
      authorName: answer.author_name || me?.nickname || "匿名群友",
      authorAvatar: answer.author_avatar || me?.avatar || null,
      dateLabel: dateLabel(answer.created_at),
      games: answer.games.map((g) => ({ title: g.title, cover: g.cover })),
    })
      .then((url) => { if (!cancelled) setImg(url); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "生成失败"); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, question, answer, me]);

  if (!open) return null;

  const shown = Math.min(answer.games.length, 9);

  const download = () => {
    if (!img) return;
    const a = document.createElement("a");
    a.href = img;
    a.download = `周推游戏-${question.question.slice(0, 12).replace(/[\\/:*?"<>|]/g, "") || "分享"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-butter-2 bg-cream shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-butter-2 px-5 py-4">
          <div>
            <h3 className="text-lg font-medium">🖼️ 生成分享图</h3>
            <p className="mt-0.5 text-xs text-muted">三列排版，最多显示 9 张（当前 {shown} 张）</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {busy ? (
            <div className="grid h-64 place-items-center text-muted"><span className="spinner" /></div>
          ) : error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="分享图预览" className="mx-auto w-full max-w-md rounded-xl border border-butter-2" />
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-butter-2 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-ghost">关闭</button>
          <button type="button" onClick={download} disabled={!img} className="btn disabled:opacity-40">⬇️ 下载 PNG</button>
        </div>
      </div>
    </div>
  );
}
