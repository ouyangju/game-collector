import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "游戏墙 · 今年玩过的游戏",
  description: "搜索 Bangumi 游戏、记录游玩感想，和群友分享你的年度游戏清单。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
