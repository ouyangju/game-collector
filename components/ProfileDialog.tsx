"use client";

import { useCallback, useEffect, useState } from "react";
import UserAvatar from "./UserAvatar";
import ProfileEditor from "./ProfileEditor";
import type { ProfileResponse, SessionUser } from "@/lib/types";
import { proxiedCover } from "@/lib/img-proxy";

type Props = {
  userId: string;
  me: SessionUser;
  admin: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
};

// 访客查看他人主页：只能看，不能编辑；管理员额外看到"编辑主页"按钮。
export default function ProfileDialog({ userId, me, admin, onClose, onProfileUpdated }: Props) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/profile?user_id=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取主页失败");
      setData(json as ProfileResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取主页失败");
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const profile = data?.profile;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-butter-2 bg-cream shadow-2xl">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-[#FFE9C4] to-[#FFF3DA] px-4 pb-4 pt-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="absolute right-3 top-3 rounded-lg px-2 py-1 text-muted hover:bg-white/70 hover:text-ink"
          >
            ✕
          </button>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !profile ? (
            <div className="flex justify-center py-8 text-muted"><span className="spinner" /></div>
          ) : (
            <div className="flex items-start gap-3 sm:gap-4">
              <UserAvatar name={profile.nickname} avatar={profile.avatar} size={64} className="sm:!h-20 sm:!w-20" />
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-medium">{profile.nickname}</h2>
                  {profile.role === "admin" ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary-dark">管理员</span>
                  ) : null}
                </div>
                {profile.bio ? (
                  <p className="thought-box mt-1.5 text-sm leading-relaxed text-ink/80">{profile.bio}</p>
                ) : (
                  <p className="mt-1.5 text-xs italic text-muted">这个人还没有写签名～</p>
                )}
              </div>
            </div>
          )}
        </div>

        {data ? (
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>🎮 <b className="text-primary-dark">{data.stats.games}</b> 款游戏</span>
              <span>✍️ <b className="text-primary-dark">{data.stats.thoughts}</b> 条感想</span>
              <span>♥ <b className="text-primary-dark">{data.stats.likes}</b> 次获赞</span>
            </div>

            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-medium">他玩过的游戏</h3>
              {admin ? (
                <button type="button" onClick={() => setEditOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
                  ✎ 编辑此主页
                </button>
              ) : null}
            </div>

            {data.entries.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">还没有公开的游戏记录。</p>
            ) : (
              <div className="space-y-3">
                {data.entries.map((e) => {
                  const cover = proxiedCover(e.cover);
                  return (
                    <div key={e.id} className="flex gap-3 rounded-xl border border-butter-2 bg-white/80 p-3">
                      <div className="grid h-[88px] w-[62px] shrink-0 place-items-center overflow-hidden rounded-lg bg-[#FFF3DA]">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt={e.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl text-primary/25">🎮</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium" title={e.title}>{e.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted">
                          {[e.play_year, e.platform, e.bangumi_rating ? `Bangumi ${e.bangumi_rating}` : ""].filter(Boolean).join(" · ")}
                        </div>
                        {e.thoughts ? (
                          <div className="thought-box mt-1.5 max-h-20 overflow-auto rounded-lg bg-cream-2 p-2 text-xs leading-relaxed text-ink">
                            {e.thoughts}
                          </div>
                        ) : null}
                        {e.my_score ? (
                          <div className="mt-1 text-xs text-primary-dark">评分：{"★".repeat(e.my_score)}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {editOpen && profile ? (
        <ProfileEditor
          me={me}
          target={{ id: profile.id, nickname: profile.nickname, avatar: profile.avatar, bio: profile.bio }}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            await load();
            onProfileUpdated();
          }}
        />
      ) : null}
    </div>
  );
}
