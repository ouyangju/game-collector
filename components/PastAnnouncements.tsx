"use client";

import type { Announcement } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  items: Announcement[];
};

// 往期公告弹窗：展示已归档的公告（只读）
export default function PastAnnouncements({ open, onClose, items }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium">🗂️ 往期公告</h3>
            <p className="mt-0.5 text-xs text-muted">共 {items.length} 条已归档公告</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>
        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">还没有往期公告。</p>
          ) : (
            items.map((a) => (
              <article key={a.id} className="rounded-xl border border-butter-2 bg-white/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-ink">{a.title}</h4>
                  <span className="shrink-0 text-[11px] text-muted">
                    {new Date(a.archived_at || a.created_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "numeric", day: "numeric" })}
                  </span>
                </div>
                <p className="thought-box mt-2 text-sm leading-relaxed text-muted">{a.content}</p>
              </article>
            ))
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">关闭</button>
        </div>
      </div>
    </div>
  );
}
