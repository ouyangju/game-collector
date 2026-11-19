"use client";

import UserAvatar from "./UserAvatar";
import type { SessionUser } from "@/lib/types";

type Props = {
  me: SessionUser;
  games: number;
  thoughts: number;
  onEdit: () => void;
};

// "个人主页"顶部的资料卡：头像 / 姓名 / 签名 / 编辑入口
export default function MyHome({ me, games, thoughts, onEdit }: Props) {
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
    </section>
  );
}
