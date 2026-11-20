"use client";

import { useRef, useState } from "react";
import type { Announcement, HeroImage } from "@/lib/types";
import { proxiedCover } from "@/lib/img-proxy";

type Props = {
  open: boolean;
  onClose: () => void;
  heroes: HeroImage[];
  announcements: Announcement[];
  archived: Announcement[];
  onChanged: () => void | Promise<void>;
};

export default function SiteEditor({ open, onClose, heroes, announcements, archived, onChanged }: Props) {
  const [tab, setTab] = useState<"hero" | "notice">("hero");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editing, setEditing] = useState<Announcement | null>(null);

  const heroInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const fail = (e: unknown) => setMsg(e instanceof Error ? e.message : "操作失败");

  const uploadHero = async (file: File) => {
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/hero", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "上传失败");
      await onChanged();
      setMsg("头图已添加 ✅");
    } catch (e) { fail(e); }
    finally { setBusy(false); if (heroInputRef.current) heroInputRef.current.value = ""; }
  };

  const removeHero = async (id: number) => {
    if (!confirm("确定删除这张头图吗？")) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/settings/hero?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "删除失败");
      await onChanged();
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  const moveHero = async (index: number, dir: -1 | 1) => {
    const next = [...heroes];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/settings/hero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((h) => h.id) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "排序失败");
      await onChanged();
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  const saveNotice = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) { setMsg("请填写标题和内容"); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/announcements", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, title, content } : { title, content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "保存失败");
      setNewTitle(""); setNewContent(""); setEditing(null);
      await onChanged();
      setMsg("公告已保存 ✅");
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  const startEdit = (a: Announcement) => {
    setEditing(a);
    setNewTitle(a.title);
    setNewContent(a.content);
    setMsg("");
  };

  const cancelEdit = () => { setEditing(null); setNewTitle(""); setNewContent(""); };

  const toggleArchive = async (a: Announcement) => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, status: a.status === "active" ? "archived" : "active" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "操作失败");
      await onChanged();
      setMsg(a.status === "active" ? "已移入往期公告" : "已恢复到进行中");
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  const removeNotice = async (id: number) => {
    if (!confirm("确定永久删除这条公告吗？")) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "删除失败");
      await onChanged();
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">✎ 编辑头图与公告</h3>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>

        <div className="mt-4 flex gap-2 border-b border-butter-2">
          <button type="button" onClick={() => { setTab("hero"); setMsg(""); }} className={`px-3 py-2 text-sm ${tab === "hero" ? "border-b-2 border-primary font-medium text-primary-dark" : "text-muted"}`}>🖼️ 头图（{heroes.length}）</button>
          <button type="button" onClick={() => { setTab("notice"); setMsg(""); }} className={`px-3 py-2 text-sm ${tab === "notice" ? "border-b-2 border-primary font-medium text-primary-dark" : "text-muted"}`}>📢 公告（{announcements.length}）</button>
        </div>

        {tab === "hero" ? (
          <div className="mt-4">
            <p className="text-xs text-muted">可上传多张，首页按顺序每 5 秒自动切换。头图建议 16:9 横图。</p>
            <div className="mt-3 space-y-2">
              {heroes.length === 0 ? (
                <div className="grid h-24 place-items-center rounded-xl border border-dashed border-butter-2 bg-cream-2 text-xs text-muted">还没有头图，当前显示默认渐变背景</div>
              ) : heroes.map((h, i) => (
                <div key={h.id} className="flex items-center gap-2 rounded-xl border border-butter-2 bg-cream-2 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proxiedCover(h.url) || h.url} alt={`头图 ${i + 1}`} referrerPolicy="no-referrer" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
                  <span className="w-5 shrink-0 text-xs text-muted">{i + 1}</span>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button type="button" disabled={busy || i === 0} onClick={() => void moveHero(i, -1)} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-butter/40 disabled:opacity-30" title="上移">↑</button>
                    <button type="button" disabled={busy || i === heroes.length - 1} onClick={() => void moveHero(i, 1)} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-butter/40 disabled:opacity-30" title="下移">↓</button>
                    <button type="button" disabled={busy} onClick={() => void removeHero(h.id)} className="rounded-lg px-2 py-1 text-xs text-muted hover:text-red-600">删除</button>
                  </div>
                </div>
              ))}
            </div>
            <input ref={heroInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadHero(f); }} />
            <button type="button" onClick={() => heroInputRef.current?.click()} disabled={busy} className="btn-ghost mt-3 w-full">
              {busy ? "处理中…" : "📷 上传头图（JPG/PNG/WebP，≤10MB）"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="rounded-xl border border-butter-2 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{editing ? "编辑公告" : "新建公告"}</span>
                {editing ? <button type="button" onClick={cancelEdit} className="text-[11px] text-muted underline">取消编辑</button> : null}
              </div>
              <label className="mt-3 block text-xs font-medium">标题</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={60} placeholder="例如：本周活动通知" className="input mt-1" />
              <label className="mt-3 block text-xs font-medium">内容（建议 50–100 字）</label>
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} maxLength={500} rows={3} placeholder="写下公告内容…" className="input mt-1 min-h-[84px] resize-y" />
              <div className="mt-1 text-right text-[11px] text-muted">{newContent.length}/500</div>
              <button type="button" onClick={() => void saveNotice()} disabled={busy} className="btn mt-2 w-full">{busy ? "保存中…" : editing ? "保存修改" : "添加公告"}</button>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium">进行中（{announcements.length}）</div>
              <div className="mt-2 space-y-2">
                {announcements.length === 0 ? <p className="text-xs text-muted">暂无进行中的公告</p> : announcements.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 rounded-xl border border-butter-2 bg-cream-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <p className="line-clamp-2 text-xs text-muted">{a.content}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => startEdit(a)} className="rounded-lg px-2 py-1 text-xs text-muted hover:text-primary-dark">编辑</button>
                      <button type="button" disabled={busy} onClick={() => void toggleArchive(a)} className="rounded-lg px-2 py-1 text-xs text-muted hover:text-primary-dark">归档</button>
                      <button type="button" disabled={busy} onClick={() => void removeNotice(a.id)} className="rounded-lg px-2 py-1 text-xs text-muted hover:text-red-600">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {archived.length > 0 ? (
              <div className="mt-4">
                <div className="text-sm font-medium">往期公告（{archived.length}）</div>
                <div className="mt-2 space-y-2">
                  {archived.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-xl border border-butter-2 bg-cream-2/60 p-2.5">
                      <div className="min-w-0 flex-1 truncate text-sm text-muted">{a.title}</div>
                      <button type="button" disabled={busy} onClick={() => void toggleArchive(a)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:text-primary-dark">恢复</button>
                      <button type="button" disabled={busy} onClick={() => void removeNotice(a.id)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:text-red-600">删除</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {msg ? <p className="mt-4 text-xs text-primary-dark">{msg}</p> : null}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">完成</button>
        </div>
      </div>
    </div>
  );
}
