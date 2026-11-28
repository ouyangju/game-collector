"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo, PhotosResponse, SessionUser } from "@/lib/types";
import { proxiedCover } from "@/lib/img-proxy";
import RichText from "@/lib/richtext";
import RichTextEditor from "./RichTextEditor";
import UserAvatar from "./UserAvatar";

type Props = {
  me: SessionUser | null;
  admin: boolean;
  onLogin: () => void;
  onOpenProfile: (userId: string) => void;
};

const MAX_IMAGES = 20;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** 单张图片：加载失败回退占位 */
function PhotoImg({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const display = proxiedCover(src) || src;
  return (
    <div className={`relative overflow-hidden bg-[#FFF3DA] ${className || ""}`}>
      {failed ? (
        <span className="grid h-full w-full place-items-center text-2xl text-primary/25">🖼️</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={display}
          alt="分享的图片"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/** 一条分享卡片 */
function PhotoCard({
  photo, me, admin, onLike, onDelete, onOpenProfile,
}: {
  photo: Photo;
  me: SessionUser | null;
  admin: boolean;
  onLike: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const count = photo.images.length;
  const gridClass = count === 1
    ? "grid-cols-1"
    : count === 2
      ? "grid-cols-2"
      : "grid-cols-2 sm:grid-cols-3";

  return (
    <article className="card fadein p-4 sm:p-5">
      {/* 上传者 + 时间 + 删除 */}
      <div className="mb-3 flex items-center gap-2.5">
        <UserAvatar name={photo.owner_name} avatar={photo.avatar} size={34} onClick={() => onOpenProfile(photo.user_id)} />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpenProfile(photo.user_id)} className="block truncate text-sm font-medium hover:text-primary-dark hover:underline">
            {photo.owner_name}
          </button>
          <div className="text-[11px] text-muted">{timeLabel(photo.created_at)} · {count} 张图片</div>
        </div>
        {admin ? (
          <button type="button" onClick={() => onDelete(photo)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:bg-red-50 hover:text-red-600">删除</button>
        ) : null}
      </div>

      {/* 图片网格 */}
      <div className={`grid gap-1.5 ${gridClass}`}>
        {photo.images.map((url, i) => (
          <PhotoImg key={`${url}-${i}`} src={url} className="aspect-square w-full rounded-lg" />
        ))}
      </div>

      {/* 文字说明 */}
      {photo.caption ? (
        <div className="thought-box mt-3 rounded-lg bg-cream-2 p-2.5 text-sm leading-relaxed text-ink">
          <RichText text={photo.caption} />
        </div>
      ) : null}

      {/* 点赞 */}
      <div className="mt-3 flex items-center gap-2 border-t border-butter-2 pt-3">
        <button
          type="button"
          onClick={() => onLike(photo)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${photo.liked_by_me ? "border-primary bg-butter/30 text-primary-dark" : "border-butter-2 bg-cream-2 text-muted hover:text-primary-dark"}`}
        >
          <span className="text-base leading-none">{photo.liked_by_me ? "❤️" : "🤍"}</span>
          {photo.like_count}
        </button>
      </div>
    </article>
  );
}

/** 上传弹窗：多选图片 + 文字说明 */
function UploadDialog({
  onClose, onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const pickFiles = (picked: FileList | null) => {
    if (!picked) return;
    const all = [...files];
    for (const f of Array.from(picked)) {
      if (all.length >= MAX_IMAGES) break;
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setMsg("仅支持 JPG / PNG / WebP 图片");
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setMsg("单张图片不能超过 10MB");
        continue;
      }
      all.push(f);
    }
    setFiles(all);
    setPreviews(all.map((f) => URL.createObjectURL(f)));
    setMsg("");
  };

  const removeAt = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const submit = async () => {
    if (!files.length) { setMsg("请先选择图片"); return; }
    setBusy(true);
    setMsg("");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/photos/upload", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "图片上传失败");
        urls.push(j.url);
      }
      const r = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: urls, caption }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "发布失败");
      onUploaded();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "发布失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">🖼️ 分享美图</h3>
            <p className="mt-1 text-xs text-muted">一次可选多张图片，并为它们写点文字</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
        />

        {previews.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 grid h-40 w-full place-items-center rounded-xl border-2 border-dashed border-butter-2 bg-cream-2 text-muted transition hover:border-primary hover:text-primary-dark"
          >
            <div className="text-center">
              <div className="text-3xl">📷</div>
              <div className="mt-1 text-sm">点击选择图片（最多 {MAX_IMAGES} 张）</div>
              <div className="text-[11px]">JPG / PNG / WebP，单张 ≤ 10MB</div>
            </div>
          </button>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-butter-2 bg-[#FFF3DA]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`预览 ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label="移除图片"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/60 text-xs text-white hover:bg-ink/85"
                  >✕</button>
                </div>
              ))}
              {previews.length < MAX_IMAGES ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-butter-2 bg-cream-2 text-2xl text-muted hover:border-primary hover:text-primary-dark"
                >＋</button>
              ) : null}
            </div>
            <div className="mt-1 text-right text-[11px] text-muted">已选 {previews.length}/{MAX_IMAGES} 张</div>
          </>
        )}

        <label className="mt-4 block text-sm font-medium">为图片写点文字（可选）</label>
        <RichTextEditor
          value={caption}
          onChange={setCaption}
          maxLength={2000}
          rows={3}
          placeholder="记录此刻的心情、地点或故事…支持剧透黑框等格式"
        />

        {msg ? <p className="mt-2 text-xs text-red-600">{msg}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">取消</button>
          <button type="button" onClick={() => void submit()} disabled={busy || files.length === 0} className="btn disabled:opacity-40">
            {busy ? "发布中…" : "发布分享"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhotosPanel({ me, admin, onLogin, onOpenProfile }: Props) {
  const [data, setData] = useState<PhotosResponse | null>(null);
  const [page, setPage] = useState(1);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (date) params.set("date", date);
      const res = await fetch(`/api/photos?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      setData(json as PhotosResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, [page, date]);

  useEffect(() => { void load(); }, [load]);

  const onLike = async (p: Photo) => {
    if (!me) { onLogin(); return; }
    const res = await fetch("/api/photos/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: p.id }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "操作失败"); return; }
    setData((prev) => prev ? {
      ...prev,
      items: prev.items.map((x) => x.id === p.id ? { ...x, liked_by_me: json.liked, like_count: json.count } : x),
    } : prev);
  };

  const onDelete = async (p: Photo) => {
    if (!confirm("确定删除这条美图分享吗？此操作不可恢复。")) return;
    const res = await fetch(`/api/photos?id=${p.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { alert(json.error || "删除失败"); return; }
    await load();
  };

  const goPage = (n: number) => {
    setPage(Math.max(1, Math.min(n, data?.totalPages || 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fadein space-y-5">
      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">🖼️ 美图分享</h2>
            <p className="mt-1 text-xs text-muted">分享你拍到的画面，让大家一起看看</p>
          </div>
          <button
            type="button"
            onClick={() => { if (!me) { onLogin(); return; } setUploadOpen(true); }}
            className="btn w-full sm:w-auto"
          >＋ 分享美图</button>
        </div>
      </section>

      {/* 筛选栏 */}
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-butter-2 bg-white/80 px-4 py-3">
        <label htmlFor="photo-date" className="text-sm text-muted">按日期筛选：</label>
        <select
          id="photo-date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          className="input w-auto min-w-[130px] py-1.5 text-sm"
        >
          <option value="">全部日期</option>
          {(data?.dates || []).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {data ? <span className="ml-auto text-xs text-muted">共 {data.total} 条分享</span> : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">读取失败：{error}</div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center py-16 text-muted"><span className="spinner" /></div>
      ) : data && data.items.length === 0 ? (
        <div className="card grid place-items-center gap-2 py-16 text-center text-muted">
          <div className="text-4xl">📷</div>
          <p className="text-sm">这里还没有分享，来发第一组美图吧！</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.items.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              me={me}
              admin={admin}
              onLike={(x) => void onLike(x)}
              onDelete={(x) => void onDelete(x)}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <button type="button" onClick={() => goPage(page - 1)} disabled={page <= 1} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">上一页</button>
          <span className="text-sm text-muted">{page} / {data.totalPages}</span>
          <button type="button" onClick={() => goPage(page + 1)} disabled={page >= data.totalPages} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">下一页</button>
        </div>
      ) : null}

      {uploadOpen ? (
        <UploadDialog onClose={() => setUploadOpen(false)} onUploaded={() => { setPage(1); setDate(""); void load(); }} />
      ) : null}
    </div>
  );
}
