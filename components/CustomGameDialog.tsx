"use client";

import { useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  // 上传封面后回调；上层负责写入清单（source=custom、subject_id 为空）
  onAdd: (data: { title: string; platform: string; cover: string | null }) => Promise<void>;
};

// 自定义添加游戏：不走 Bangumi，自己上传封面并填写名字。
export default function CustomGameDialog({ open, onClose, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setTitle("");
    setPlatform("");
    setFile(null);
    setPreview(null);
    setMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async () => {
    const name = title.trim();
    if (!name) { setMsg("请填写游戏名称"); return; }
    setBusy(true);
    setMsg("");
    try {
      let cover: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/games/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "封面上传失败");
        cover = json.url;
      }
      await onAdd({ title: name, platform: platform.trim(), cover });
      reset();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "添加失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">✏️ 自定义添加游戏</h3>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">找不到 Bangumi 条目？自己上传封面、填游戏名即可加入清单。</p>

        <div className="mt-5 flex items-start gap-3">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-28 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-butter-2 bg-cream-2 text-muted hover:border-primary"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="封面预览" className="h-full w-full object-cover" />
            ) : (
              <span className="text-center text-[11px]">＋<br />上传封面</span>
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            {preview ? (
              <button type="button" onClick={() => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = ""; }} className="text-[11px] text-muted underline hover:text-red-600">移除图片</button>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted">封面可选。支持 JPG / PNG / WebP，≤10MB。不传则用默认占位图。</p>
            )}
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium">游戏名称 <span className="text-red-500">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="例如：某某独立游戏" className="input mt-2" />

        <label className="mt-4 block text-sm font-medium">平台 / 备注（可选）</label>
        <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={60} placeholder="例如：PC / Switch" className="input mt-2" />

        {msg ? <p className="mt-3 text-xs text-red-600">{msg}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">取消</button>
          <button type="button" onClick={() => void submit()} disabled={busy} className="btn">{busy ? "添加中…" : "加入清单"}</button>
        </div>
      </div>
    </div>
  );
}
