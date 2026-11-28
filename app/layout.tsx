import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZACA单机游戏组官网 · 记录游戏日常的点点滴滴",
  description: "搜索 Bangumi 游戏、记录游玩感想，和群友分享你的年度游戏清单。",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
