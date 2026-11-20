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

// 头图：可多张，按顺序自动轮播
export type HeroImage = {
  id: number;
  url: string;
  position: number;
  created_at: string;
};

// 公告：active 在主页显示，archived 归入"往期公告"
export type Announcement = {
  id: number;
  title: string;
  content: string;
  status: "active" | "archived";
  position: number;
  created_at: string;
  archived_at: string | null;
};

export type HeroResponse = { items: HeroImage[] };
export type AnnouncementsResponse = {
  active: Announcement[];
  archived: Announcement[];
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
  subject_id: number | null;
  source?: "bangumi" | "custom";
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
  // 第一条评论的预览（广场默认展示）
  first_comment?: { author_name: string; content: string; created_at: string } | null;
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

// ===== 周推游戏 =====

// 回答里的一款游戏（Bangumi 或自定义上传，不含感想）
export type WeeklyGame = {
  id: number;
  answer_id: number;
  subject_id: number | null;
  source: "bangumi" | "custom";
  title: string;
  cover: string | null;
  cover_source: string | null;
  platform: string | null;
  position: number;
};

// 某用户对某问题的一组回答
export type WeeklyAnswer = {
  id: number;
  question_id: number;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  created_at: string;
  updated_at: string;
  games: WeeklyGame[];
};

// 一个问题（含截止状态、每人最多选的游戏数）
export type WeeklyQuestion = {
  id: number;
  question: string;
  max_games: number;
  created_by: string | null;
  creator_name: string;
  created_at: string;
  ends_at: string;
  status: "active" | "ended";
  answers: WeeklyAnswer[];
  my_answer_id: number | null;
};

export type WeeklyResponse = {
  items: WeeklyQuestion[];
  user: SessionUser | null;
};

// 用户提交回答时的单个游戏（复用上传/搜索流程，无感想字段）
export type WeeklyGameInput = {
  subject_id: number | null;
  source: "bangumi" | "custom";
  title: string;
  cover: string | null;
  cover_source: string | null;
  platform: string | null;
};
