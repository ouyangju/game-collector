"use client";

import { useEffect, useState } from "react";
import type { Announcement, HeroImage } from "@/lib/types";
import PastAnnouncements from "./PastAnnouncements";

type Props = {
  images: HeroImage[];
  announcements: Announcement[];
  archived: Announcement[];
  isAdmin: boolean;
  onEdit: () => void;
};

function displaySrc(url: string): string {
  if (url.includes("lain.bgm.tv")) return `/api/games/thumbnail?url=${encodeURIComponent(url)}`;
  return url;
}

// 首页头图（多张自动轮播）+ 公告栏（多条、不滚动）并行布局
export default function HeroSection({ images, announcements, archived, isAdmin, onEdit }: Props) {
  const [index, setIndex] = useState(0);
  const [pastOpen, setPastOpen] = useState(false);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const count = images.length;
  useEffect(() => setIndex(0), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(timer);
  }, [count]);

  return (
    <section className="mb-6">
      {/* 宽屏：头图占 2 列、公告栏占 1 列（长 2:1），两者高度由网格拉伸保持一致 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 头图：16:9，自动轮播 */}
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-butter-2 bg-gradient-to-br from-[#FFE9C4] via-[#FFF3DA] to-[#FFE1B0] shadow-card lg:col-span-2">
          {count > 0 ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={images[index].id}
                src={displaySrc(images[index].url)}
                alt={`站点头图 ${index + 1}`}
                referrerPolicy="no-referrer"
                onError={() => setFailed((f) => ({ ...f, [images[index].id]: true }))}
                className={`h-full w-full object-cover fadein ${failed[images[index].id] ? "opacity-0" : ""}`}
              />
              {failed[images[index].id] ? (
                <div className="absolute inset-0 grid place-items-center text-5xl text-primary/25">🎮</div>
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-ink/10" />
              <div className="absolute left-4 top-4 rounded-full bg-white/25 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                🎲 {new Date().getFullYear()} 年度游戏分享
              </div>
              {count > 1 ? (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink/30 px-2.5 py-1.5 backdrop-blur">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      type="button"
                      aria-label={`查看第 ${i + 1} 张头图`}
                      onClick={() => setIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/40 blur-2xl" />
              <div className="absolute left-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-medium text-primary-dark">
                🎲 {new Date().getFullYear()} 年度游戏分享
              </div>
              <div className="absolute bottom-5 left-5">
                <h1 className="text-3xl font-medium text-ink sm:text-4xl">🎮 游戏墙</h1>
              </div>
            </>
          )}
        </div>

        {/* 公告栏：与头图等高，多条不滚动，超出部分内部滚动 */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-butter-2 bg-white/85 shadow-card">
          <div className="flex items-center justify-between border-b border-butter-2 bg-cream-2/80 px-4 py-2.5">
            <span className="text-sm font-medium text-primary-dark">📢 公告栏</span>
            <span className="text-[11px] text-muted">{announcements.length} 条进行中</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
            {announcements.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">暂时没有公告～</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="rounded-xl border border-butter-2 bg-cream-2/70 p-3">
                  <div className="text-sm font-medium text-ink">{a.title}</div>
                  <p className="thought-box mt-1 text-[13px] leading-relaxed text-muted">{a.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-butter-2 bg-cream-2/60 px-4 py-2.5">
            <button type="button" onClick={() => setPastOpen(true)} className="text-xs font-medium text-primary-dark hover:underline">
              🗂️ 查看往期公告（{archived.length}）
            </button>
            {isAdmin ? (
              <button type="button" onClick={onEdit} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-butter/30 hover:text-ink">
                ✎ 编辑
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <PastAnnouncements open={pastOpen} onClose={() => setPastOpen(false)} items={archived} />
    </section>
  );
}
