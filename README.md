# 游戏墙（Next.js 服务端版）

和你朋友 buttervote.com 相同的技术思路：**前端不直连 Bangumi**，而是请求自己的服务端 API，由服务端去调 Bangumi 的游戏搜索接口，再把封面抓下来存到 Supabase Storage（图片本地化），最后数据存 Supabase 数据库。

技术栈：Next.js 14（App Router）+ TypeScript + Tailwind CSS + Supabase。

---

## 一、需不需要申请个人服务器？

**不需要。** 推荐路线是「免费 Serverless + 免费 Supabase」，个人小工具完全够用，也不用管运维：

| 方案 | 是否要买服务器 | 费用 | 适合 |
| --- | --- | --- | --- |
| **A. Vercel + Supabase（推荐）** | 否 | 免费额度足够 | 个人/群内小工具，最省事 |
| B. 自购 VPS（腾讯云/阿里云轻量） | 是 | 约 ¥30–60/月 | 想完全自控、长期稳定运行 |

两条路线的部署步骤在下面第四节。**代码完全一样**，只是部署的地方不同。

> 为什么会这样？你的应用需要「一个能跑 Node.js 服务端的地方」+「一个数据库」。Vercel 免费提供前者，Supabase 免费提供后者。只有当你不想依赖这些平台时，才需要自己买 VPS。

---

## 二、申请 Supabase（免费，两条路线都要用）

Supabase 提供 Postgres 数据库 + 图片存储，免费层对个人项目足够。

1. 打开 https://supabase.com ，点 **Start your project**，用 GitHub 账号登录（没有就先注册一个 GitHub）。
2. 点 **New project**，填：
   - Name：随意，如 `game-wall`
   - Database Password：自己设一个**强密码并保存好**
   - Region：选离你近的，如 `Southeast Asia (Singapore)`
3. 等 1–2 分钟创建完成。
4. 左侧 **Project Settings → API**，记下三个值：
   - `Project URL` → 填到 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（**保密，只在服务端用**）
5. 左侧 **SQL Editor → New query**，把本仓库 `supabase/schema.sql` 全文粘贴进去，点 **Run**。看到成功提示即可（建账户表/清单表/点赞表/评论表 + 策略 + `game-covers` 桶）。
6. 左侧 **Storage**，确认出现 `game-covers` 桶，且是 Public。

> ⚠️ **已有数据库升级（重要）**：如果你的 Supabase 里已经跑过旧版 `schema.sql`（已有一批清单数据），**不要重新跑新版 schema**。请改为执行 `supabase/migration-v2.sql`——它只做增量升级（加 `users`/`likes`/`comments` 表、给 `game_list` 加 `user_id` 列），不会破坏已有数据。旧数据在账号首次登录时会自动过户到该账号。

---

## 三、本地配置与运行

```bash
cd game-collector-server
npm install
cp .env.example .env.local      # Windows PowerShell 用：Copy-Item .env.example .env.local
```

编辑 `.env.local`，填入第二节拿到的三个值，以及可选的 Bangumi UA：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
BANGUMI_UA=GameCollector/1.0 (你的邮箱)
```

然后启动：

```bash
npm run dev
```

浏览器打开 http://localhost:3000 。

验证顺序：
1. 首次进入弹登录框 → 填账户名 + 密码（≥6 位）。新账户名自动注册；旧账户名密码错误会被拒绝。
2. 刷新页面 → 无需重复登录（会话 Cookie 保存 30 天）。
3. 点「搜索游戏」→ 输入「艾尔登法环」→ 应出现 Bangumi 游戏封面网格（封面走本地服务端代理）。
4. 点某张卡片「选择」→ 服务端抓取封面转存到 Supabase → 加入清单。
5. 写感想、打分 → 刷新页面数据仍在。
6. 切到「群友广场」→ 默认显示本月帖子；可按月份切换、按发布时间或点赞数排序。
7. 给别人的帖子点赞（再点一次取消）、发表评论（自己的评论可删除）。
8. 另一台设备/浏览器打开同一地址，用不同账户名登录 → 能看到彼此的清单并互动。

>  sessions 用 `SUPABASE_SERVICE_ROLE_KEY` 派生密钥做 HMAC 签名，存在 httpOnly Cookie 里；密码用 scrypt 加盐哈希，服务端不存明文。账户表对匿名角色完全不开放，密码哈希不会泄露。

> Bangumi API 要求规范的 User-Agent，服务端已用 `BANGUMI_UA` 设置。若搜索报 403，去 https://next.bgm.tv/demo/access-token 申请一个 access token（公开搜索一般不需要，但限流时有帮助）。

---

## 四、部署上线（把网站放到公网，群友才能访问）

### 路线 A：Vercel（推荐，免费，无需服务器）

> ⚠️ **部署前必做（否则部署成功但功能不全）**：确认你已经在 Supabase 后台的 **SQL Editor** 里执行过 `supabase/schema.sql`（建 `game_list` 表 + `game-covers` 存储桶）。如果没执行，搜索能用但"加入清单/写感想"会报错。执行方法见第二节第 5 步。

1. 把项目推到 GitHub：在 GitHub 新建一个仓库，然后把本目录 `game-collector-server` 的内容推送上去。
   ```bash
   cd game-collector-server
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/你的用户名/你的仓库.git
   git branch -M main
   git push -u origin main
   ```
   注意 `.env.local` 不会上传（在 `.gitignore` 里），这是对的。
2. 打开 https://vercel.com ，用 GitHub 登录 → **Add New → Project** → 导入刚才的仓库。
3. 是关键一步：在 **Environment Variables** 里添加四个变量（名字和本地 `.env.local` 一样）：
   `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`BANGUMI_UA`。
4. 点 **Deploy**，等 1–2 分钟。完成后 Vercel 会给你一个 `https://xxx.vercel.app` 的网址。
5. 把这个网址发给群友即可。**以后每次 `git push`，Vercel 会自动重新部署。**

### 路线 B：自购 VPS（想完全自控时）

1. 买服务器：腾讯云「轻量应用服务器」或阿里云「轻量应用服务器」，选 **2核2G / 40G 盘 / 带宽 3–5Mbps**，系统选 **Ubuntu 22.04**，约 ¥30–60/月。买完拿到公网 IP 和 root 密码。
2. 装环境（SSH 登录服务器后执行）：
   ```bash
   # 装 Node.js 22
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
   apt install -y nodejs git
   ```
3. 上传代码（在你自己电脑执行，把 IP 换成你的）：
   ```bash
   scp -r ./game-collector-server root@你的公网IP:/root/
   ```
4. 在服务器上配置环境变量并启动：
   ```bash
   cd /root/game-collector-server
   npm install
   # 创建 .env.local，填入四个变量（同上）
   nano .env.local
   npm run build
   npm start
   ```
   此时用 `http://你的公网IP:3000` 已能访问。
5. 用 PM2 让它常驻（关掉 SSH 也不停）：
   ```bash
   npm install -g pm2
   pm2 start npm --name game-wall -- start
   pm2 startup && pm2 save
   ```
6. （可选但推荐）绑域名 + HTTPS：
   - 买个域名，解析 A 记录到服务器 IP。
   - 装 Nginx 反代 3000 端口，再用 `certbot` 申请免费 Let's Encrypt 证书。

> 对大多数情况，路线 A 更省事：不用买服务器、不用装系统、不用管 HTTPS 和运维，还自带全球 CDN。建议先用 A 跑起来，确实有需要再迁到 B。

---

## 四·五、部署到 Cloudflare Workers（国内裸连方案，和你朋友一致）

> 你朋友 buttervote.com 的做法就是这套：用 **OpenNext** 把 Next.js 应用转换成 Cloudflare Worker 部署，所以国内能直连。Vercel 默认域名 `*.vercel.app` 在国内常被 DNS 污染，而 Cloudflare 不受影响。

项目已经改造好 OpenNext 支持（依赖、`wrangler.jsonc`、`open-next.config.ts`、部署脚本都已就位）。

### 方式一：Cloudflare Workers Builds（推荐，连 GitHub 自动构建）

好处：构建在 Cloudflare 的 Linux 云端完成，**完全绕开 Windows 本地构建的兼容问题**；以后 `git push` 自动重新部署，和你朋友一样。

1. 确认 GitHub 仓库 `ouyangju/game-collector` 已包含最新代码（含 `wrangler.jsonc`、`open-next.config.ts`）。
2. 打开 https://dash.cloudflare.com → 左侧 **Workers & Pages** → **Create** → **Workers** → **Connect to Git（通过 Git 部署）** → 用 GitHub 登录并授权 → 选择 `ouyangju/game-collector` 仓库。
3. 构建配置填写：
   - **Build command**：`npm run build && npx opennextjs-cloudflare build`
   - **Deploy command**：`npx opennextjs-cloudflare deploy`
   - **Root directory**：留空（项目就在仓库根目录）
4. 在 **Environment variables**（构建和运行时都要填）添加 4 个变量，和 `.env.local` 完全一致：
   `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`BANGUMI_UA`。
5. 点 **Save and Deploy**，等 2–5 分钟。成功后会给你 `https://game-collector.<你的子域>.workers.dev` 网址。
6. （可选）绑定自己的域名：Worker → **Settings → Domains & Routes → Custom Domain**，添加你的域名，Cloudflare 会自动配好 DNS 和证书。

### 方式二：本地命令行部署

> ⚠️ Windows 原生环境下 OpenNext 构建可能因 WASM 文件名含 `?module` 而失败。若失败请改用方式一，或用 WSL / GitHub Codespaces。

```bash
# 1. 先登录 Cloudflare（会打开浏览器授权）
npx wrangler login

# 2. 创建 .dev.vars（本地 Workers 用的环境变量），内容与 .env.local 相同
Copy-Item .env.local .dev.vars

# 3. 本地预览（可选）
npm run preview:cf

# 4. 构建并部署
npm run deploy:cf
```

线上环境变量在 Cloudflare 后台设置：Worker → **Settings → Variables and Secrets** → 添加那 4 个变量（`service_role` 这类密钥勾选 Secret）。

### 两种方案对比

| | Vercel（当前） | Cloudflare Workers（推荐） |
|---|---|---|
| 国内裸连 | ❌ 默认域名被污染 | ✅ 可直连 |
| 代码 | 同一份 | 同一份（已兼容两者） |
| 数据库/图片 | Supabase（海外，国内可连） | 同左 |
| 自动部署 | git push | git push |

你朋友能裸连的“秘密”就是这一层：换个不受污染的托管网络。代码、数据库、图片方案都不用变。

---

## 五、项目结构

```
game-collector-server/
├── app/
│   ├── api/auth/route.ts           # 登录/自动注册/退出/会话恢复
│   ├── api/entries/route.ts        # 清单 CRUD + 点赞评论数聚合
│   ├── api/likes/route.ts          # 点赞（一人一赞，可取消）
│   ├── api/comments/route.ts       # 评论的增删查
│   ├── api/games/search/route.ts   # 服务端代理 Bangumi 游戏搜索（type=4），带12分钟缓存
│   ├── api/games/image/route.ts    # 抓图→校验→转存 Supabase，返回公开URL
│   ├── api/games/thumbnail/route.ts# 抓图→返回二进制，供搜索结果即时展示
│   ├── globals.css / layout.tsx / page.tsx
├── components/
│   ├── HomeClient.tsx              # 主界面：登录/清单/广场(月份+排序)/点赞评论
│   ├── SearchDialog.tsx            # 搜索弹窗（网格结果、缩略图回退、加载更多）
│   └── identity.ts                 # 本地 owner_key（用于旧数据过户识别）
├── lib/
│   ├── auth.ts                     # 密码哈希(scrypt)、HMAC 签名会话、当前用户
│   ├── bangumi.ts                  # Bangumi 搜索：简繁双搜、去重、缓存、超时
│   ├── image-guard.ts              # 图片白名单(lain.bgm.tv)+格式/大小/魔数校验
│   ├── supabase.ts                 # Supabase 客户端（浏览器端 + 服务端）
│   └── types.ts                    # 前后端共享类型
└── supabase/
    ├── schema.sql                  # 全新安装：建表 + RLS + 存储桶
    └── migration-v2.sql            # 已有数据库升级：账户/点赞/评论 + 旧数据过户
```

## 六、和你朋友方案的对应关系

| buttervote 的做法 | 本项目的对应实现 |
| --- | --- |
| Next.js App Router | ✅ 同 |
| 前端调自家 `/api/characters/search` | ✅ `/api/games/search` |
| 服务端请求 Bangumi，多来源聚合 | ✅ 服务端请求 Bangumi（按你要求只保留游戏搜索） |
| 图片代理 + 域名白名单 + 魔数校验 | ✅ `/api/games/thumbnail` + `lib/image-guard.ts` |
| 图片转存 Supabase Storage | ✅ `/api/games/image` → `game-covers` 桶 |
| 内存缓存 / 超时 / 分页 | ✅ 12 分钟缓存 / 20 秒超时 / 加载更多 |
| 暖色调 UI + 搜索弹窗 + 裁剪上传 | ✅ 暖色调 + 搜索弹窗（游戏封面通常无需裁剪，故省略裁剪步骤） |
