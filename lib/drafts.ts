"use client";

/**
 * 草稿箱：存本机 localStorage，按用户/访客命名空间隔离。
 * 无需数据库迁移；草稿仅本人本机可见，换设备不同步。
 */

export type DraftKind = "thoughts" | "comment";

export type Draft = {
  id: string;           // `${kind}-${entryId}`：同一目标只保留一份草稿
  kind: DraftKind;
  entryId: number;
  entryTitle: string;
  entryCover: string | null;
  content: string;      // 富文本标记原文
  score: number | null; // 感想评分；评论为 null
  savedAt: number;
};

const STORAGE_KEY = "gamewall_drafts_v1";

type Store = Record<string, Draft[]>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 隐私模式或空间不足时静默失败，不影响主流程
  }
}

function byTime(a: Draft, b: Draft): number {
  return b.savedAt - a.savedAt;
}

export function loadDrafts(scope: string): Draft[] {
  const list = readStore()[scope];
  return Array.isArray(list) ? list.slice().sort(byTime) : [];
}

export function saveDraft(scope: string, draft: Draft): Draft[] {
  const store = readStore();
  const list = Array.isArray(store[scope]) ? store[scope] : [];
  const next = [draft, ...list.filter((d) => d.id !== draft.id)].sort(byTime);
  store[scope] = next;
  writeStore(store);
  return next;
}

export function deleteDraft(scope: string, id: string): Draft[] {
  const store = readStore();
  const list = Array.isArray(store[scope]) ? store[scope] : [];
  const next = list.filter((d) => d.id !== id);
  store[scope] = next;
  writeStore(store);
  return next;
}

export function draftId(kind: DraftKind, entryId: number): string {
  return `${kind}-${entryId}`;
}
