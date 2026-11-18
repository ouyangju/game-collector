"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameHit, SearchResponse } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (hit: GameHit) => void | Promise<void>;
};

// 缩略图走自家服务端代理（返回图片二进制）；失败时回退到原始 Bangumi 地址
function coverCandidates(hit: GameHit): string[] {
  const local = `/api/games/thumbnail?url=${encodeURIComponent(hit.cover)}`;
  return [local, hit.cover];
}

function ResultCard({ hit, disabled, onSelect }: { hit: GameHit; disabled: boolean; onSelect: () => void }) {
  const candidates = coverCandidates(hit);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const title = hit.nameCn || hit.name;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-butter-2 bg-white/70 transition hover:bg-butter/20">
      <button
        type="button"
        aria-label={`选择 ${title}`}
        disabled={disabled}
        onClick={onSelect}
        className="flex flex-1 flex-col text-left disabled:opacity-50"
      >
        <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-[#FFF8E8]">
          {!loaded && <span className="absolute text-4xl text-primary/20">🎮</span>}
          {idx < candidates.length ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidates[idx]}
              alt={title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(false);
                setIdx((i) => i + 1);
              }}
              className={`relative h-full w-full object-cover ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <span className="absolute bottom-2 text-xs text-muted">预览暂不可用</span>
          )}
        </div>
        <div className="space-y-1 p-3">
          <p className="break-words text-sm font-medium leading-snug">{title}</p>
          {hit.nameCn && hit.name && hit.nameCn !== hit.name ? (
            <p className="line-clamp-1 break-words text-xs text-muted">{hit.name}</p>
          ) : null}
          <p className="line-clamp-2 break-words text-xs leading-5 text-muted">
            {[hit.date, hit.platform].filter(Boolean).join(" · ")}
          </p>
          {hit.rating ? (
            <span className="inline-block rounded-full bg-butter/40 px-2 py-0.5 text-[11px] font-medium text-primary-dark">
              Bangumi {hit.rating}
            </span>
          ) : null}
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-butter-2/60 px-3 py-2">
        <a
          href={hit.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted hover:text-primary-dark"
        >
          在 Bangumi 查看 ↗
        </a>
        <button type="button" disabled={disabled} onClick={onSelect} className="text-xs font-medium text-primary-dark hover:underline disabled:opacity-50">
          选择
        </button>
      </div>
    </div>
  );
}

export default function SearchDialog({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, SearchResponse>());

  const run = useCallback(async (q: string, p: number) => {
    const term = q.trim();
    if (!term) {
      setError("请输入游戏名。");
      return;
    }
    const key = `${term}::${p}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setData((prev) =>
        p === 1 || !prev ? cached : { ...cached, items: [...prev.items, ...cached.items.filter((i) => !prev.items.some((x) => x.id === i.id))] }
      );
      setPage(p);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const timer = setTimeout(() => ac.abort(), 20000);
    setBusy(true);
    setError("");
    if (p === 1) setData(null);
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(term)}&page=${p}`, { signal: ac.signal });
      const json = (await res.json()) as SearchResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "搜索失败，请稍后重试。");
      cacheRef.current.set(key, json);
      setData((prev) =>
        p === 1 || !prev ? json : { ...json, items: [...prev.items, ...json.items.filter((i) => !prev.items.some((x) => x.id === i.id))] }
      );
      setPage(p);
    } catch (e) {
      if (ac.signal.aborted) setError("搜索超时，请稍后重试。");
      else setError(e instanceof Error ? e.message : "搜索失败，请稍后重试。");
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ac) {
        setBusy(false);
        abortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
    }
  }, [open]);

  if (!open) return null;

  const handleSelect = async (hit: GameHit) => {
    setPicking(hit.id);
    try {
      await onSelect(hit);
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="搜索游戏" className="flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-butter-2 bg-cream shadow-2xl">
        <div className="border-b border-butter-2 bg-white/70 px-5 py-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-medium">搜索游戏封面</h2>
              <p className="text-xs text-muted">来自 Bangumi 游戏库，搜索后选择封面加入清单</p>
            </div>
            <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(query, 1);
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入游戏名，如：黑神话 悟空 / 艾尔登法环"
              className="input"
              disabled={picking !== null}
            />
            <button type="submit" className="btn shrink-0" disabled={busy || picking !== null}>
              {busy ? <span className="spinner !h-4 !w-4 !border-2" /> : "搜索"}
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">中文名会自动同时搜索简体与繁体；也可尝试日文名或英文名。</p>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto p-5" aria-live="polite" aria-busy={busy}>
          {error ? <p role="alert" className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {data?.errors.map((er, i) => (
            <p key={i} className="mb-2 text-sm text-amber-800">Bangumi：{er.message}</p>
          ))}
          {busy && !data?.items.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted">
              <span className="spinner mb-3" />
              <span className="text-sm">正在搜索…</span>
            </div>
          ) : null}
          {!busy && !error && !data ? (
            <p className="py-16 text-center text-sm text-muted">输入游戏名开始搜索</p>
          ) : null}
          {!busy && data && !data.items.length ? (
            <p className="py-16 text-center text-sm text-muted">没有找到带封面的游戏，换个名字试试，也可以稍后手动添加。</p>
          ) : null}
          {data && data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.items.map((hit) => (
                  <ResultCard key={hit.id} hit={hit} disabled={picking !== null} onSelect={() => void handleSelect(hit)} />
                ))}
              </div>
              {data.hasMore && page < 20 ? (
                <button
                  type="button"
                  className="btn-ghost mt-4 w-full"
                  disabled={busy}
                  onClick={() => void run(query, page + 1)}
                >
                  {busy ? "正在加载…" : "加载更多"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
