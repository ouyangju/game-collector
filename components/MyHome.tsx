"use client";

import UserAvatar from "./UserAvatar";
import { proxiedCover } from "@/lib/img-proxy";
import type { SessionUser, WeeklyQuestion, WeeklyAnswer } from "@/lib/types";

type Props = {
  me: SessionUser;
  games: number;
  thoughts: number;
  onEdit: () => void;
  weekly?: WeeklyQuestion | null;
  myAnswer?: WeeklyAnswer | null;
  onWeeklyAnswer?: () => void;
  onShareAnswer?: () => void;
};

// "个人主页"顶部的资料卡：头像 / 姓名 / 签名 / 编辑入口 / 本周周推问题 + 我的回答
export default function MyHome({ me, games, thoughts, onEdit, weekly, myAnswer, onWeeklyAnswer, onShareAnswer }: Props) {
  return (
    <section className="card fadein p-4 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <UserAvatar name={me.nickname} avatar={me.avatar} size={72} className="!h-16 !w-16 sm:!h-[72px] sm:!w-[72px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-medium">{me.nickname}</h2>
            {me.role === "admin" ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary-dark">管理员</span>
            ) : null}
          </div>
          {me.bio ? (
            <p className="thought-box mt-1.5 text-sm leading-relaxed text-ink/80">{me.bio}</p>
          ) : (
            <p className="mt-1.5 text-xs italic text-muted">还没有个性签名，点右边按钮介绍一下自己吧～</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>🎮 <b className="text-primary-dark">{games}</b> 款游戏</span>
            <span>✍️ <b className="text-primary-dark">{thoughts}</b> 条感想</span>
          </div>
        </div>
        <button type="button" onClick={onEdit} className="btn-ghost shrink-0 px-3 py-2 text-xs sm:text-sm">
          ✎ 编辑主页
        </button>
      </div>

      {weekly ? (
        <div className="mt-4 rounded-xl border border-butter-2 bg-butter/20 p-3.5 sm:p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-primary-dark">
            <span>🗓️ 本周的周推游戏要求</span>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px]">进行中</span>
          </div>
          <p className="thought-box mt-1.5 text-sm leading-relaxed text-ink">{weekly.question}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-[11px] text-muted">
              每人最多 {weekly.max_games} 款 · 截止 {new Date(weekly.ends_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            {onWeeklyAnswer ? (
              <button type="button" onClick={onWeeklyAnswer} className="ml-auto text-xs font-medium text-primary-dark underline">
                {weekly.my_answer_id ? "修改我的回答 →" : "选择我的游戏 →"}
              </button>
            ) : null}
          </div>

          {/* 我的回答 + 显眼的分享图按钮（仅本人可见，仅自己回答） */}
          {myAnswer ? (
            <div className="mt-4 rounded-xl border border-primary/30 bg-white/90 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary-dark">我的回答</span>
                  <span className="text-[11px] text-muted">{myAnswer.games.length} 款游戏</span>
                </div>
                {onShareAnswer ? (
                  <button
                    type="button"
                    onClick={onShareAnswer}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-medium text-white shadow-card ring-2 ring-primary/20 transition hover:-translate-y-0.5 hover:shadow-lg sm:px-6 sm:py-3 sm:text-base"
                  >
                    <span className="text-lg leading-none">🖼️</span>
                    生成我的分享图
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {myAnswer.games.slice(0, 9).map((g) => {
                  const src = proxiedCover(g.cover);
                  return (
                    <div key={g.id} className="min-w-0 overflow-hidden rounded-lg border border-butter-2 bg-[#FFF3DA]">
                      <div className="aspect-square w-full overflow-hidden">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={g.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xl text-primary/25">🎮</div>
                        )}
                      </div>
                      <div className="truncate px-1 py-0.5 text-[10px]" title={g.title}>{g.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-butter-2 bg-white/60 p-3 text-center text-xs text-muted">
              你还没回答本周问题，点上方「选择我的游戏 →」参与吧
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
