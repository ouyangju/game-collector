"use client";

import { useEffect, useState } from "react";
import { avatarColor } from "./identity";
import { proxiedCover } from "@/lib/img-proxy";

type Props = {
  name: string;
  avatar?: string | null;
  size?: number;
  className?: string;
  onClick?: () => void;
  title?: string;
};

// 通用头像：有自定义头像显示图片，否则用姓名首字 + 稳定色块；加载失败自动回退。
export default function UserAvatar({ name, avatar, size = 40, className = "", onClick, title }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatar]);
  const who = name || "匿名群友";
  const showImg = Boolean(avatar) && !failed;
  const style = { width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) };

  const inner = showImg ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedCover(avatar) || ""}
      alt={`${who} 的头像`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  ) : (
    <span style={{ background: avatarColor(who) }} className="grid h-full w-full place-items-center font-medium text-white">
      {who.slice(0, 1)}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title || `查看 ${who} 的主页`}
        aria-label={title || `查看 ${who} 的主页`}
        style={style}
        className={`shrink-0 overflow-hidden rounded-full ring-2 ring-white/70 transition hover:ring-primary ${className}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      title={title}
      style={style}
      className={`inline-block shrink-0 overflow-hidden rounded-full ring-2 ring-white/70 ${className}`}
    >
      {inner}
    </span>
  );
}
