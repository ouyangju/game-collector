"use client";

import { useRef, useState, type KeyboardEvent } from "react";

/**
 * 富文本编辑器：在 textarea 基础上加工具栏，对选中的文字包裹标记语法。
 * 存储仍是纯文本（标记语法），与 lib/richtext.tsx 的解析器配套。
 *
 * 支持的按钮：剧透 / 粗体 / 斜体 / 下划线 / 删除线 / 代码 / 链接 / 引用 / 列表
 */

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  className?: string;
  /** 文本域自身的类名（用于放大特定场景的输入框） */
  textareaClassName?: string;
  /** Ctrl/⌘ + Enter 的回调（评论发送用） */
  onSubmitShortcut?: () => void;
};

type Tool = {
  label: string;
  title: string;
  before: string;
  after: string;
  sample: string;
  /** 行首工具：如引用、列表 */
  linePrefix?: string;
};

const TOOLS: Tool[] = [
  { label: "🖤", title: "剧透（选中查看）", before: "||", after: "||", sample: "剧透内容" },
  { label: "B", title: "粗体 (Ctrl+B)", before: "**", after: "**", sample: "粗体" },
  { label: "I", title: "斜体 (Ctrl+I)", before: "*", after: "*", sample: "斜体" },
  { label: "U", title: "下划线 (Ctrl+U)", before: "__", after: "__", sample: "下划线" },
  { label: "S", title: "删除线", before: "~~", after: "~~", sample: "删除线" },
  { label: "</>", title: "行内代码", before: "`", after: "`", sample: "代码" },
  { label: "🔗", title: "链接", before: "[", after: "](https://)", sample: "链接文字" },
  { label: "❝", title: "引用", before: "", after: "", sample: "", linePrefix: "> " },
  { label: "•", title: "列表项", before: "", after: "", sample: "", linePrefix: "- " },
];

export default function RichTextEditor({
  value,
  onChange,
  maxLength = 3000,
  rows = 4,
  placeholder,
  className = "",
  textareaClassName = "",
  onSubmitShortcut,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [linkMode, setLinkMode] = useState(false);

  const applyTool = (tool: Tool) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);

    // 行首工具：在当前行开头插入前缀
    if (tool.linePrefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const next = value.slice(0, lineStart) + tool.linePrefix + value.slice(lineStart);
      if (next.length > maxLength) return;
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + tool.linePrefix!.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }

    // 链接特殊处理：先填文字，再把光标放到 url 位置
    if (tool.before === "[") {
      const text = selected || tool.sample;
      const middle = `${tool.before}${text}](${""}`;
      const tail = ")";
      const insert = middle + tail;
      const next = value.slice(0, start) + insert + value.slice(end);
      if (next.length > maxLength) return;
      onChange(next);
      setLinkMode(true);
      requestAnimationFrame(() => {
        el.focus();
        const urlPos = start + middle.length;
        el.setSelectionRange(urlPos, urlPos);
      });
      return;
    }

    const text = selected || tool.sample;
    const insert = tool.before + text + tool.after;
    const next = value.slice(0, start) + insert + value.slice(end);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      if (selected) {
        el.setSelectionRange(start + tool.before.length, start + tool.before.length + text.length);
      } else {
        // 无选中时把占位文字选中，方便直接替换
        el.setSelectionRange(start + tool.before.length, start + tool.before.length + text.length);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmitShortcut?.();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      const map: Record<string, Tool> = { b: TOOLS[1], i: TOOLS[2], u: TOOLS[3] };
      applyTool(map[e.key.toLowerCase()]);
    }
  };

  return (
    <div className={`rt-editor ${className}`}>
      <div className="rt-toolbar" role="toolbar" aria-label="文字格式工具栏">
        {TOOLS.map((t, i) => (
          <button
            key={i}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => e.preventDefault()} // 防止 textarea 失焦、丢失选区
            onClick={() => applyTool(t)}
            className={`rt-tool ${i === 0 ? "rt-tool-spoiler" : ""}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-muted">选中文字后点按钮加格式</span>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className={`input mt-1 resize-y leading-relaxed ${textareaClassName}`}
      />
      <div className="mt-0.5 text-right text-[11px] text-muted">
        {value.length}/{maxLength}
        {linkMode ? <span className="ml-2 text-primary-dark">链接：把 https:// 后面补成完整地址</span> : null}
      </div>
    </div>
  );
}
