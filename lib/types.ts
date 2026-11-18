// 前后端共享的数据类型

export type GameHit = {
  id: number;
  name: string;
  nameCn: string;
  cover: string; // 原始 Bangumi 图片地址（lain.bgm.tv）
  platform: string;
  date: string;
  rating: string;
  sourceUrl: string;
};

export type SearchResponse = {
  items: GameHit[];
  errors: { source: string; message: string }[];
  hasMore: boolean;
};

export type Entry = {
  id: number;
  owner_key: string;
  owner_name: string;
  subject_id: number;
  title: string;
  cover: string; // 本地化后的图片地址（Supabase Storage 公开 URL）
  cover_source: string | null;
  platform: string | null;
  air_date: string | null;
  bangumi_rating: string | null;
  thoughts: string;
  my_score: number | null;
  play_year: number;
  created_at: string;
};
