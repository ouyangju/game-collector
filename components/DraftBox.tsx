"use client";

import { proxiedCover } from "@/lib/img-proxy";
import RichText, { richTextToPlain } from "@/lib/richtext";
import type { Draft } from "@/lib/drafts";

/**
 * 草稿箱弹窗：列出本机保存的草稿，可继续编辑或删除。
 * 感想草稿会在「个人主页」打开对应游戏的编辑框；评论草稿会在「群友广场」展开对应帖子的评论并回填。
 */
type Props = {
  open: boolean;
  drafts: Draft[];
  onClose: () => void;
  onLoad: (draft: Draft) => void;
  onDelete: (id: string) => void;
};

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function DraftBox({ open, drafts, onClose, onLoad, onDelete }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">📝 草稿箱</h3>
            <p className="mt-1 text-xs text-muted">草稿保存在本机浏览器，仅你自己可见，共 {drafts.length} 条</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>

        {drafts.length === 0 ? (
          <div className="mt-6 grid place-items-center gap-2 rounded-xl border border-dashed border-butter-2 bg-cream-2 py-12 text-center">
            <div className="text-3xl">📭</div>
            <div className="text-sm text-muted">草稿箱是空的</div>
            <div className="text-xs text-muted">写感想或评论时点「存草稿」，内容会保存在这里</div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {drafts.map((d) => {
              const cover = proxiedCover(d.entryCover);
              const plain = richTextToPlain(d.content);
              return (
                <div key={d.id} className="rounded-xl border border-butter-2 bg-white/85 p-3 shadow-card">
                  <div className="flex gap-3">
                    <div className="grid h-[62px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-lg bg-[#FFF3DA]">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                      ) : <span className="text-xl text-primary/25">🎮</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${d.kind === "thoughts" ? "bg-primary/15 text-primary-dark" : "bg-emerald-100 text-emerald-700"}`}>
                          {d.kind === "thoughts" ? "感想" : "评论"}
                        </span>
                        <span className="truncate text-sm font-medium" title={d.entryTitle}>{d.entryTitle}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">保存于 {timeLabel(d.savedAt)}{d.kind === "thoughts" && d.score ? ` · ${d.score} 星` : ""}</div>
                      <div className="thought-box mt-1.5 line-clamp-2 rounded-lg bg-cream-2 p-2 text-xs leading-relaxed text-ink">
                        {plain ? <RichText text={d.content} /> : <span className="italic text-muted">（纯评分，无文字）</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => onDelete(d.id)} className="text-xs text-muted underline hover:text-red-600">删除</button>
                    <button type="button" onClick={() => onLoad(d)} className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark">继续编辑 →</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
