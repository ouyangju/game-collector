"use client";

import { Fragment, useState, type ReactNode } from "react";

/**
 * 轻量富文本：标记语法存纯文本，渲染成 React 元素（绝不用 dangerouslySetInnerHTML，避免 XSS）。
 *
 * 支持标记：
 *   ||剧透||       黑框，选中/点击查看
 *   **粗体**       加粗
 *   *斜体*         斜体
 *   __下划线__     下划线
 *   ~~删除线~~     删除线
 *   `代码`         行内代码
 *   [文字](url)    链接（仅 http/https，其他协议降级为纯文本）
 *   > 引用 / - 列表  行首块级
 */

type Kind = "spoiler" | "bold" | "italic" | "underline" | "strike" | "code" | "link";

/** 成对定界符（link 单独处理）。顺序决定同位置优先级：长的在前 */
const PAIRS: { kind: Kind; open: string; close: string }[] = [
  { kind: "spoiler", open: "||", close: "||" },
  { kind: "bold", open: "**", close: "**" },
  { kind: "underline", open: "__", close: "__" },
  { kind: "strike", open: "~~", close: "~~" },
  { kind: "code", open: "`", close: "`" },
  { kind: "italic", open: "*", close: "*" },
];

type Found = {
  kind: Kind;
  start: number;
  innerStart: number;
  innerEnd: number;
  end: number;
  href?: string;
};

/** 从 text 的 from 位置起，找出最早一个「开闭定界符都完整」的标记 */
function findNext(text: string, from: number): Found | null {
  let best: Found | null = null;
  for (let i = from; i < text.length; i++) {
    // 链接：[label](https://...)
    if (text[i] === "[") {
      const lm = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/.exec(text.slice(i));
      if (lm) {
        return {
          kind: "link",
          start: i,
          innerStart: i + 1,
          innerEnd: i + 1 + lm[1].length,
          end: i + lm[0].length,
          href: lm[2],
        };
      }
    }
    // 成对定界符
    for (const p of PAIRS) {
      if (!text.startsWith(p.open, i)) continue;
      const innerStart = i + p.open.length;
      const closeAt = text.indexOf(p.close, innerStart);
      if (closeAt < 0 || closeAt === innerStart) continue; // 忽略空标记
      const candidate: Found = {
        kind: p.kind,
        start: i,
        innerStart,
        innerEnd: closeAt,
        end: closeAt + p.close.length,
      };
      // 越靠前越优先；同一起点取内部更长者（让 ** 优先于 *）
      if (!best || candidate.start < best.start ||
          (candidate.start === best.start && candidate.end > best.end)) {
        best = candidate;
      }
    }
    if (best && best.start === i) break; // 当前位置已确定最优，不必再往后找
  }
  return best;
}

/** 剧透片段：默认黑底黑字，左键拖动选中（::selection）或点击查看 */
function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="剧透内容，点击查看"
      onClick={() => setShown(true)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShown(true); } }}
      className={`rt-spoiler${shown ? " rt-spoiler-shown" : ""}`}
    >
      {children}
    </span>
  );
}

/** 递归渲染：标记内部继续解析，支持任意嵌套（如 **粗体里含 ||剧透||**） */
function parseInline(text: string, keyBase: string, depth = 0): ReactNode[] {
  if (depth > 6) return [text];
  const out: ReactNode[] = [];
  let cursor = 0;
  let idx = 0;

  while (cursor < text.length) {
    const f = findNext(text, cursor);
    if (!f) {
      out.push(text.slice(cursor));
      break;
    }
    if (f.start > cursor) out.push(text.slice(cursor, f.start));

    const key = `${keyBase}-${idx++}`;
    const innerText = text.slice(f.innerStart, f.innerEnd);
    const children = f.kind === "code" ? innerText : parseInline(innerText, `${key}-i`, depth + 1);

    switch (f.kind) {
      case "spoiler":
        out.push(<Spoiler key={key}>{children}</Spoiler>);
        break;
      case "bold":
        out.push(<strong key={key}>{children}</strong>);
        break;
      case "italic":
        out.push(<em key={key}>{children}</em>);
        break;
      case "underline":
        out.push(<u key={key}>{children}</u>);
        break;
      case "strike":
        out.push(<s key={key}>{children}</s>);
        break;
      case "code":
        out.push(<code key={key} className="rt-code">{children}</code>);
        break;
      case "link":
        out.push(
          /^https?:\/\//i.test(f.href || "") ? (
            <a key={key} href={f.href} target="_blank" rel="noopener noreferrer" className="rt-link">{children}</a>
          ) : (
            <Fragment key={key}>{children}</Fragment>
          )
        );
        break;
    }
    cursor = f.end;
  }
  return out;
}

/** 把富文本安全地渲染成 React 元素；支持行首 `> ` 引用、`- ` 列表 */
export default function RichText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className={`rt-root ${className}`}>
      {lines.map((line, i) => {
        if (line.startsWith("> ")) {
          return <div key={i} className="rt-quote">{parseInline(line.slice(2), `q${i}`)}</div>;
        }
        if (line.startsWith("- ")) {
          return <div key={i} className="rt-list"><span className="rt-bullet">•</span>{parseInline(line.slice(2), `l${i}`)}</div>;
        }
        return <div key={i}>{parseInline(line, `p${i}`)}</div>;
      })}
    </div>
  );
}

/** 去掉标记取纯文本（用于搜索、摘要等场景） */
export function richTextToPlain(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\|\|([\s\S]+?)\|\|/g, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/)[^\s)]+\)/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/^> /gm, "")
    .replace(/^- /gm, "")
    .trim();
}
