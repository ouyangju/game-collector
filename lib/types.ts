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

export type SessionUser = {
  id: string;
  username: string;
  nickname: string;
  role: "user" | "admin";
  avatar?: string | null;
  bio?: string;
};

export type SiteSettings = {
  hero_image: string;
  announcement: string;
};

export type Comment = {
  id: number;
  entry_id: number;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

// 广场列表里每条帖子的社交统计（由服务端聚合）
export type SocialStat = {
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

export type Entry = {
  id: number;
  owner_key: string;
  user_id: string | null;
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
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
};

export type EntriesResponse = {
  items: Entry[];
  user: SessionUser | null;
  // 广场里展示发帖人头像用；按 user_id 索引（未过户的旧数据没有用户，取不到）
  users?: Record<string, { nickname: string; avatar: string | null }>;
};

// ===== 个人主页 =====

export type Profile = {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  bio: string;
  role: "user" | "admin";
  created_at: string;
};

// 访客查看他人主页时返回的全部内容（只读取，不可编辑）
export type ProfileResponse = {
  profile: Profile;
  entries: Entry[];
  stats: { games: number; thoughts: number; likes: number };
};

// QQ 号查询结果（服务端代理官方接口 + 头像转存）
export type QQInfo = {
  nickname: string;
  avatar: string | null;
  qq: string;
};

// ===== 活动 / 投票 =====

// 投票人（仅管理员可见）
export type PollVoter = {
  user_id: string;
  nickname: string;
  created_at: string;
};

// 投票选项：带票数统计；voters 字段仅管理员身份下返回
export type PollOption = {
  id: number;
  poll_id: number;
  subject_id: number;
  title: string;
  cover: string | null;
  cover_source: string | null;
  platform: string | null;
  position: number;
  vote_count: number;
  voters?: PollVoter[];
};

// 一个投票；status 由服务端按当前时间判定
export type Poll = {
  id: number;
  title: string;
  created_by: string | null;
  creator_name: string;
  created_at: string;
  ends_at: string;
  status: "active" | "ended";
  options: PollOption[];
  total_votes: number;
  my_vote_option_id: number | null;
};

export type PollsResponse = {
  items: Poll[];
  user: SessionUser | null;
};

// 管理员创建投票时提交的单个选项
export type PollOptionInput = {
  subject_id: number;
  title: string;
  cover: string | null;
  cover_source: string | null;
  platform: string | null;
};
