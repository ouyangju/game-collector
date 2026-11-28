"use client";

import { proxiedCover } from "./img-proxy";

/**
 * 前端 Canvas 生成周推分享图：
 * 三列布局、最多三行（9 张），超出不显示；含问题文字、回答者头像昵称与日期。
 * 所有图片经同源代理加载，避免 canvas 跨域污染导致 toDataURL 失败。
 */

export type ShareGame = { title: string; cover: string | null };
export type ShareData = {
  question: string;
  authorName: string;
  authorAvatar: string | null;
  dateLabel: string;
  games: ShareGame[];
};

const W = 900;
const PAD = 44;
const COLS = 3;
const MAX_ROWS = 3;
const GAP = 14;
const TITLE_H = 38;
const SCALE = 2; // 高分屏导出，避免发群后模糊
const FONT = `-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif`;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** object-fit: cover 的绘制 */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** 按字符宽度折行（兼容中文与英文），最多 maxLines 行，超出以省略号结尾 */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const chars = Array.from(text || "");
  const lines: string[] = [];
  let line = "";
  let consumed = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\n") {
      lines.push(line);
      line = "";
      consumed = i + 1;
      if (lines.length >= maxLines) break;
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      consumed = i;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    consumed = chars.length;
  }
  if (lines.length === maxLines && consumed < chars.length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

/** 生成分享图，返回 PNG data URL */
export async function renderShareImage(data: ShareData): Promise<string> {
  const games = (data.games || []).slice(0, COLS * MAX_ROWS);
  const rows = Math.max(1, Math.ceil(games.length / COLS));
  const cellW = Math.floor((W - PAD * 2 - GAP * (COLS - 1)) / COLS);
  const imgH = cellW;
  const cellH = imgH + TITLE_H;
  const gridH = rows * cellH + (rows - 1) * GAP;

  // 先用临时 ctx 测量问题文字高度
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("当前浏览器不支持 Canvas");
  measure.font = `500 30px ${FONT}`;
  const qLines = wrapLines(measure, data.question, W - PAD * 2, 2);
  const qLineH = 42;

  const headerTop = PAD;
  const headerH = 56;
  const qTop = headerTop + headerH + 22;
  const qH = Math.max(qLines.length, 1) * qLineH;
  const gridTop = qTop + qH + 22;
  const footerTop = gridTop + gridH + 20;
  const H = footerTop + 28 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持 Canvas");
  ctx.scale(SCALE, SCALE);

  // 背景
  ctx.fillStyle = "#FFF8E8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FDE3A7";
  ctx.fillRect(0, 0, W, 8);

  // 预加载头像与封面（并行，失败自动回退占位）
  const loads: Promise<unknown>[] = [];
  let avatarImg: HTMLImageElement | null = null;
  const avatarUrl = data.authorAvatar ? proxiedCover(data.authorAvatar) : null;
  if (avatarUrl) loads.push(loadImage(avatarUrl).then((img) => { avatarImg = img; }));
  const coverImgs: (HTMLImageElement | null)[] = [];
  games.forEach((g, i) => {
    const url = g.cover ? proxiedCover(g.cover) : null;
    if (url) loads.push(loadImage(url).then((img) => { coverImgs[i] = img; }));
  });
  await Promise.all(loads);

  // 头像
  const ax = PAD + 24;
  const ay = headerTop + 24;
  const ar = 24;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    drawCover(ctx, avatarImg, ax - ar, ay - ar, ar * 2, ar * 2);
  } else {
    ctx.fillStyle = "#D98841";
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `500 22px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((data.authorName || "游").slice(0, 1), ax, ay);
  }
  ctx.restore();
  ctx.strokeStyle = "#EED8AA";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.stroke();

  // 昵称 + 日期
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#3B2A1E";
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(data.authorName || "匿名群友", PAD + 62, headerTop + 22);
  ctx.fillStyle = "#907764";
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText(data.dateLabel, PAD + 62, headerTop + 46);

  // 右上角标签
  ctx.font = `500 16px ${FONT}`;
  const tagText = "周推游戏";
  const tagW = ctx.measureText(tagText).width + 24;
  ctx.fillStyle = "#D98841";
  roundRectPath(ctx, W - PAD - tagW, headerTop + 10, tagW, 30, 15);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.fillText(tagText, W - PAD - tagW / 2, headerTop + 30);

  // 问题文字
  ctx.textAlign = "left";
  ctx.fillStyle = "#3B2A1E";
  ctx.font = `500 30px ${FONT}`;
  qLines.forEach((line, i) => ctx.fillText(line, PAD, qTop + 30 + i * qLineH));

  // 游戏网格
  games.forEach((g, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PAD + col * (cellW + GAP);
    const y = gridTop + row * (cellH + GAP);

    ctx.fillStyle = "#FFFFFF";
    roundRectPath(ctx, x, y, cellW, cellH, 12);
    ctx.fill();

    ctx.save();
    roundRectPath(ctx, x, y, cellW, imgH, 12);
    ctx.clip();
    const img = coverImgs[i];
    if (img) {
      drawCover(ctx, img, x, y, cellW, imgH);
    } else {
      ctx.fillStyle = "#FFF3DA";
      ctx.fillRect(x, y, cellW, imgH);
      ctx.fillStyle = "#D98841";
      ctx.font = `500 40px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🎮", x + cellW / 2, y + imgH / 2);
    }
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3B2A1E";
    ctx.font = `500 16px ${FONT}`;
    const title = g.title || "";
    let shown = title;
    while (shown.length > 1 && ctx.measureText(shown).width > cellW - 20) shown = shown.slice(0, -1);
    if (shown !== title) shown = shown.slice(0, -1) + "…";
    ctx.fillText(shown, x + 10, y + imgH + TITLE_H / 2);
  });

  // 页脚
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = "#907764";
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText("来自游戏墙 · 周推游戏", W / 2, footerTop + 18);

  return canvas.toDataURL("image/png");
}
