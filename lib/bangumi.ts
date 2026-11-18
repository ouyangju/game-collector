import type { GameHit, SearchResponse } from "./types";

const API = "https://api.bgm.tv";
const UA = process.env.BANGUMI_UA || "GameCollector/1.0 (https://example.com; contact@example.com)";
const LIMIT = 24;

// 服务端内存缓存：key -> { result, expiresAt }。12 分钟有效，最多 64 条。
const cache = new Map<string, { result: SearchResponse; expiresAt: number }>();
const TTL = 12 * 60 * 1000;

function isChinese(s: string) {
  return /[\u4e00-\u9fff]/.test(s);
}

// 极简繁体->简体转换：仅覆盖常见字，作为兜底。
// 生产环境可换成 opencc-js 做完整转换。
const T2S: Record<string, string> = {
  遊: "游", 戲: "戏", 簽: "签", 寫: "写", 實: "实", 體: "体", 無: "无", 邊: "边", 緣: "缘",
  風: "风", 雲: "云", 電: "电", 動: "动", 畫: "画", 訪: "访", 說: "说", 語: "语",
  嗎: "吗", 謝: "谢", 愛: "爱", 將: "将", 於: "于", 後: "后", 裡: "里", 為: "为",
};
function toSimplified(s: string) {
  let out = "";
  for (const ch of s) out += T2S[ch] ?? ch;
  return out;
}

type RawSubject = {
  id: number;
  name?: string;
  name_cn?: string;
  images?: { large?: string; common?: string; grid?: string };
  platform?: string;
  date?: string;
  rating?: { score?: number };
};

async function requestSubjects(keyword: string, signal: AbortSignal): Promise<RawSubject[]> {
  const res = await fetch(`${API}/v0/search/subjects?limit=${LIMIT}&offset=0`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Bangumi 要求规范的 User-Agent，浏览器里无法自定义，服务端可以
      "User-Agent": UA,
      Accept: "application/json",
    },
    body: JSON.stringify({
      keyword,
      filter: { type: [4] }, // 4 = 游戏
      sort: "match",
    }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bangumi 返回 ${res.status}`);
  const json = (await res.json()) as { data?: RawSubject[] };
  return Array.isArray(json.data) ? json.data : [];
}

function normalize(raw: RawSubject[]): GameHit[] {
  return raw
    .filter((s) => s && s.id)
    .map((s) => {
      const imgs = s.images || {};
      return {
        id: s.id,
        name: s.name || "",
        nameCn: s.name_cn || "",
        cover: imgs.large || imgs.common || imgs.grid || "",
        platform: s.platform || "",
        date: (s.date || "").slice(0, 10),
        rating: typeof s.rating?.score === "number" ? s.rating.score.toFixed(1) : "",
        sourceUrl: `https://bgm.tv/subject/${s.id}`,
      };
    });
}

function dedupe(items: GameHit[]): GameHit[] {
  const seen = new Set<number>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/**
 * 服务端搜索游戏。中文名自动同时搜简体与繁体（对齐朋友网站的做法）。
 * 返回统一结构，前端只认这个结构，不直接接触 Bangumi。
 */
export async function searchGames(keyword: string, page: number): Promise<SearchResponse> {
  const q = keyword.trim().slice(0, 100);
  const key = JSON.stringify([q, page]);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    cache.delete(key);
    cache.set(key, hit); // LRU：命中后移到末尾
    return hit.result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const queries = isChinese(q) ? Array.from(new Set([q, toSimplified(q)])) : [q];
    const errors: { source: string; message: string }[] = [];
    const batches = await Promise.all(
      queries.map(async (term) => {
        try {
          return normalize(await requestSubjects(term, controller.signal));
        } catch (e) {
          errors.push({ source: "bangumi", message: e instanceof Error ? e.message : "请求失败" });
          return [] as GameHit[];
        }
      })
    );
    const items = dedupe(batches.flat());
    // 全部查询都失败时抛出异常，让接口返回明确的错误而不是静默空列表
    if (items.length === 0 && errors.length === queries.length) {
      throw new Error(errors[0].message || "Bangumi 暂不可用");
    }
    const result: SearchResponse = {
      items: items.slice(0, LIMIT),
      errors,
      // v0 搜索没有可靠的 total，用「是否满页」近似判断还有没有下一页
      hasMore: items.length >= LIMIT && page < 20,
    };
    for (const [k, v] of cache) if (v.expiresAt <= Date.now()) cache.delete(k);
    cache.set(key, { result, expiresAt: Date.now() + TTL });
    while (cache.size > 64) cache.delete(cache.keys().next().value as string);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
