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
5. 左侧 **SQL Editor → New query**，把本仓库 `supabase/schema.sql` 全文粘贴进去，点 **Run**。看到成功提示即可（建账户表/清单表/点赞表/评论表/投票三表 + 策略 + `game-covers` 桶）。
6. 左侧 **Storage**，确认出现 `game-covers` 桶，且是 Public。

> ⚠️ **已有数据库升级（重要）**：如果你的 Supabase 里已经跑过旧版脚本（已有一批清单数据），**不要重新跑新版 `schema.sql`**。按顺序增量执行：
> 1. `supabase/migration-v2.sql`（加 `users`/`likes`/`comments` 表、给 `game_list` 加 `user_id` 列）—— 若已执行过可跳过；
> 2. `supabase/migration-v3.sql`（加 `users.role` 管理员角色、`site_settings` 头图/公告表）—— 若已执行过可跳过；
> 3. `supabase/migration-v4.sql`（加 `polls`/`poll_options`/`poll_votes` 投票三表）—— 投票功能，已执行可跳过；
> 4. `supabase/migration-v5.sql`（给 `users` 加 `avatar`/`bio` 个人主页字段）—— 个人主页功能，已执行可跳过；
> 5. `supabase/migration-v6.sql`（自定义游戏、多张头图表、多条公告表；自动把旧的单张头图/单条公告迁进新表）—— 已执行可跳过；
> 6. `supabase/migration-v7.sql`（周推游戏：问题表 + 回答表 + 回答游戏表）—— 已执行可跳过；
> 7. `supabase/migration-v8.sql`（美图分享：`photos` 表 + `photo_likes` 点赞表）—— **本次新增，必须执行**。
>
> 全都是增量语句、可重复执行，不会破坏已有数据。旧数据在账号首次登录时会自动过户到该账号。
> 未执行 v5/v6/v7/v8 也不会整站报错（相关功能自动降级为空），但新功能不可用。

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
ADMIN_USERNAME=你的账户名
```

> `ADMIN_USERNAME` 填你要作为管理员的账户名（就是首次登录时注册的账户名，不区分大小写）。这个账户登录后会自动成为管理员，可见「编辑头图与公告」入口。若留空，也可在 Supabase 里手动执行 `update public.users set role='admin' where username_norm='你的账户名';`。

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
8. 用管理员账户（`.env.local` 里 `ADMIN_USERNAME` 指定的那个）登录 → 首页头图下方出现「✎ 编辑头图与公告」按钮 → 可上传头图、修改顶部公告语，保存后所有人生效。
9. 另一台设备/浏览器打开同一地址，用不同账户名登录 → 能看到彼此的清单并互动。
10. 切到「🗳️ 活动」→ 管理员点「＋ 新建投票」→ 填标题、选持续时间、从 Bangumi 搜索添加至少两个游戏选项 → 创建。
11. 任意登录用户点选项右侧「投票」→ 投票后立即看到票数与百分比；再点其他选项不会重复计票（一人一票）。
12. 管理员在投票卡片底部点「查看投票明细」→ 可看到每个选项分别是谁投的；「往期投票」里可查看所有已截止的投票结果，管理员还可删除投票。
13. 切到「🏠 个人主页」→ 点「编辑主页」→ 可改姓名、上传头像或填 QQ 号一键读取昵称头像、写个性签名。**改姓名会同步修改登录账户名**，请记住新名字。
14. 在「群友广场」点某条帖子的头像或昵称 → 进入 TA 的主页，可看头像、姓名、签名和 TA 发过的全部游戏与感想（只能看，不能改）。管理员会多出一个「编辑此主页」按钮，可代改他人资料。
15. 未登录时登录框点「👀 游客浏览」→ 可浏览清单、广场、投票和他人主页；发帖、评论、点赞、投票会提示先登录。游客状态记在本机，关闭页面后仍保留，登录即自动退出游客态。
16. 「🏠 个人主页 → 添加游戏」里点「✏️ 自定义添加」→ 上传自己的封面图、填游戏名（可不填平台）→ 加入清单，条目会标注「自定义」。
17. 首页头图区：管理员点「✎ 编辑」→「头图」页签可连续上传多张、上下调顺序、删除；首页每 5 秒自动切换，下方圆点可手动切换。头图为 16:9，与右侧公告栏并排。
18. 同一编辑弹窗的「公告」页签：可添加多条公告（标题 + 内容，建议 50–100 字）、编辑、点「归档」移入往期、删除或恢复。首页公告栏显示所有「进行中」公告（不滚动），底部「🗂️ 查看往期公告」弹窗查看已归档公告。旧的公告语会自动迁为第一条公告。
19. 「🌈 群友广场」：有评论的帖子会默认显示第一条评论；点 💬 展开全部。评论框改为多行文本域，支持换行和长文（最多 3000 字），Ctrl/⌘ + Enter 发送。
20. 「🗓️ 周推游戏」：管理员点「＋ 发起问题」→ 填问题内容（如"你最喜欢的游戏原声带来自于哪些游戏？"）、每人最多可选游戏数 n、截止时间（选具体日期时间，开始时间默认为发布时间）。
21. 登录后，在「🏠 个人主页」的个人信息下方会出现「本周的周推游戏要求：……」，点「选择我的游戏」→ 通过 Bangumi 搜索或自定义上传选出至多 n 款游戏（**不能写感想**）→ 提交。每人每个问题只能有一组回答，可在截止前修改或撤回。
22. 提交后回答出现在「🗓️ 周推游戏」展示区：所有人能看到当前问题和各人的回答列表（头像、昵称、游戏）。点「🗂️ 往期问题」可查看已截止问题及各自回答。
23. 宽屏下首页头图与公告栏长度比为 **2:1**（头图占 2/3 宽）、高度相同；窄屏自动上下堆叠。
24. **富文本与防剧透**：写感想、发评论时，输入框上方有格式工具栏。选中文字点按钮即可加格式，也支持快捷键 Ctrl/⌘ + B/I/U：
    - 🖤 **剧透黑框**（`||文字||`）：文字默认变黑隐藏，**左键拖动选中即可显形**，点一下也可显形（手机端适用）。用于隐藏结局、反转等，避免剧透。
    - **B** 粗体 `**文字**`、**I** 斜体 `*文字*`、**U** 下划线 `__文字__`、**S** 删除线 `~~文字~~`、行内代码 `` `代码` ``、链接 `[文字](https://…)`、引用 `> `、列表 `- `。
    - 标记以纯文本存储，**无需数据库改动**；渲染时解析为 React 元素（不使用 innerHTML），链接仅放行 http/https，防止注入。搜索会自动忽略标记符号。
25. **草稿箱**：写感想或发评论时点「💾 存草稿」，内容（含富文本标记、评分）会存到本机浏览器，右上角 📝 草稿箱可查看（带未读数量角标）。点「继续编辑」会跳到对应游戏/帖子并回填内容；正式保存感想或发出评论后对应草稿自动清除。**草稿仅存本机、按账号隔离，不跨设备同步，无需数据库改动**。电脑端感想编辑弹窗已加宽、文本域加大，方便写长文。
26. **🖼️ 美图分享**：与广场并列的新板块。登录后点「＋ 分享美图」可**一次上传多张图片**（JPG/PNG/WebP，单张 ≤10MB，最多 20 张）并为它们写一段文字（支持富文本/剧透黑框）。每条分享展示上传者头像昵称（可点进主页）、上传时间、图片和文字；可点赞（一人一赞，再点取消）；管理员可删除，作者本人可点「编辑」修改文字说明（图片不可改）。**每页最多 10 条分享**，超出可翻页；顶部可按日期（中国时区）筛选，日期下拉只列出有分享的日期。
27. **周推分享图**：每个回答都有「🖼️ 生成分享图」按钮，用浏览器本地 Canvas 生成一张 PNG（三列布局、最多显示 9 张游戏封面，多余的不再显示），图上含周推问题文字、回答者头像昵称和日期。可预览后下载保存/发群。纯前端生成，**无需后端、无需数据库改动**。
28. **分页与折叠**：群友广场按每页 8 条分页（切换月份/搜索/排序自动回第一页）；周推进行中的问题每页 5 条，默认按时间倒序（最新在前）。广场里**超过 100 字的感想默认折叠**，只显示前 100 字，点「展开全文」看完整富文本（折叠预览中的剧透内容会隐藏，不会泄露）。

> **投票规则**：一人一票（同一投票内不可重复投票、不可改票）；投票进行中，未投票的普通用户只看到选项、不显示票数；投过票后或投票截止后才显示得票数与比例；投票人明细仅管理员可见。持续时间从创建时刻算起，到点自动转入「往期投票」。

> **手机端**：页面已做响应式适配——顶栏、头图、清单卡片、群友广场的月份标签（可横向滑动）、活动投票卡片、弹窗都针对窄屏优化，直接用手机浏览器打开即可。

>  sessions 用 `SUPABASE_SERVICE_ROLE_KEY` 派生密钥做 HMAC 签名，存在 httpOnly Cookie 里；密码用 scrypt 加盐哈希，服务端不存明文。账户表对匿名角色完全不开放，密码哈希不会泄露。

> Bangumi API 要求规范的 User-Agent，服务端已用 `BANGUMI_UA` 设置。若搜索报 403，去 https://next.bgm.tv/demo/access-token 申请一个 access token（公开搜索一般不需要，但限流时有帮助）。

> **关于「QQ 一键填入」**：腾讯官方没有"凭 QQ 号拿昵称"的开放接口（需 OAuth 授权），所以昵称通过多个公开查询接口依次尝试，头像则用官方 `q1.qlogo.cn` 按号码拼出。两者都在**服务端**完成并转存到自己的 Storage，前端和访客都接触不到第三方地址或 QQ 号。QQ 号本身**不写入数据库**，只把查到的昵称和头像存进你的资料。若昵称含表情／特殊符号会自动过滤（因为要兼作登录名），不足 2 位时请手动填写；若公开接口临时失效，头像通常仍可读取，昵称可手填。

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
3. 是关键一步：在 **Environment Variables** 里添加五个变量（名字和本地 `.env.local` 一样）：
   `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`BANGUMI_UA`、`ADMIN_USERNAME`（管理员账户名）。
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
4. 在 **Environment variables**（构建和运行时都要填）添加 5 个变量，和 `.env.local` 完全一致：
   `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`BANGUMI_UA`、`ADMIN_USERNAME`。
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

线上环境变量在 Cloudflare 后台设置：Worker → **Settings → Variables and Secrets** → 添加那 5 个变量（`service_role` 这类密钥勾选 Secret）。

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
│   ├── api/settings/route.ts       # 站点设置的读取(公开)/写入(仅管理员)
│   ├── api/settings/upload/route.ts# 管理员上传头图→转存 Supabase→写入设置
│   ├── api/polls/route.ts          # 投票列表/创建(管理员)/删除(管理员)
│   ├── api/polls/vote/route.ts     # 投票（需登录，一人一票，校验截止时间）
│   ├── api/profile/route.ts        # 个人主页读取(公开)/编辑(自己或管理员改他人)
│   ├── api/profile/avatar/route.ts # 头像上传转存 Supabase（管理员可代传）
│   ├── api/qq/lookup/route.ts      # QQ 号→昵称+官方头像，服务端代理并转存（QQ号不落库）
│   ├── api/announcements/route.ts  # 公告增删查/归档/恢复（读公开、写仅管理员）
│   ├── api/settings/hero/route.ts  # 多张头图上传/删除/排序（读公开、写仅管理员）
│   ├── api/weekly/route.ts         # 周推问题列表/发起(管理员)/删除(管理员)
│   ├── api/weekly/answer/route.ts  # 周推回答提交修改(至多n款无感想)/撤回
│   ├── api/photos/route.ts         # 美图列表(分页/日期筛选)/发布/管理员删除
│   ├── api/photos/upload/route.ts  # 美图上传转存 Supabase（需登录）
│   ├── api/photos/like/route.ts    # 美图点赞/取消（一人一赞）
│   ├── api/games/search/route.ts   # 服务端代理 Bangumi 游戏搜索（type=4），带12分钟缓存
│   ├── api/games/image/route.ts    # 抓图→校验→转存 Supabase，返回公开URL
│   ├── api/games/upload/route.ts   # 自定义游戏封面上传（需登录，校验后转存）
│   ├── api/games/thumbnail/route.ts# 抓图→返回二进制，供搜索结果即时展示
│   ├── globals.css / layout.tsx / page.tsx
├── components/
│   ├── HomeClient.tsx              # 主界面：登录/游客/头图公告/主页/广场/活动 + 移动端适配
│   ├── EventsPanel.tsx             # 活动模块：投票/结果比例/管理员明细/往期/创建投票
│   ├── MyHome / ProfileDialog      # 个人主页资料卡 / 他人主页只读查看（管理员可编辑）
│   ├── ProfileEditor.tsx           # 资料编辑：姓名/头像上传/QQ填入/签名
│   ├── UserAvatar.tsx              # 通用头像（自定义图或姓名色块，可点击进主页）
│   ├── HeroSection.tsx             # 头图轮播 + 公告栏并行布局（16:9 头图）
│   ├── SiteEditor.tsx              # 管理员编辑多张头图与多条公告
│   ├── PastAnnouncements.tsx       # 往期公告弹窗
│   ├── CustomGameDialog.tsx        # 自定义添加游戏（自传封面+游戏名）
│   ├── WeeklyPanel.tsx             # 周推游戏展示区/发起问题/往期/分页/分享图入口
│   ├── ShareImageDialog.tsx        # 周推分享图预览与下载弹窗
│   ├── PhotosPanel.tsx             # 美图分享：多图上传+文字/展示/点赞/编辑/分页/日期筛选
│   ├── WeeklyAnswerDialog.tsx      # 周推回答弹窗（搜索+自定义选游戏，无感想）
│   ├── RichTextEditor.tsx          # 富文本编辑工具栏（剧透/粗斜体/下划线/删除线/链接等）
│   ├── DraftBox.tsx                # 草稿箱弹窗（继续编辑/删除本机草稿）
│   ├── SearchDialog.tsx            # 搜索弹窗（网格结果、缩略图回退、加载更多、多选模式）
│   └── identity.ts                 # 本地 owner_key（用于旧数据过户识别）
├── lib/
│   ├── richtext.tsx                # 富文本安全解析器（标记→React 元素，含剧透显形）
│   ├── drafts.ts                   # 草稿箱 localStorage 存储（按用户隔离）
│   ├── img-proxy.ts                # 图片同源代理地址转换（Bangumi/Supabase）
│   ├── share-image.ts              # Canvas 生成周推分享图（3列最多9张+问题+署名）
│   ├── auth.ts                     # 密码哈希(scrypt)、HMAC 签名会话、当前用户、isAdmin
│   ├── bangumi.ts                  # Bangumi 搜索：简繁双搜、去重、缓存、超时
│   ├── image-guard.ts              # 图片白名单(lain.bgm.tv)+格式/大小/魔数校验
│   ├── qq.ts                       # QQ 昵称多源查询 + 官方头像下载校验（服务端）
│   ├── supabase.ts                 # Supabase 客户端（浏览器端 + 服务端）
│   └── types.ts                    # 前后端共享类型（含 SessionUser.role / SiteSettings）
└── supabase/
    ├── schema.sql                  # 全新安装：建表 + RLS + 存储桶
    ├── migration-v2.sql            # 升级：账户/点赞/评论 + 旧数据过户
    ├── migration-v3.sql            # 升级：管理员角色(role) + 站点设置(site_settings)
    ├── migration-v4.sql            # 升级：活动投票（polls/poll_options/poll_votes + RLS）
    ├── migration-v5.sql            # 升级：个人主页（users.avatar / users.bio）
    ├── migration-v6.sql            # 升级：自定义游戏 + 多张头图 + 多条公告（含旧数据迁移）
    ├── migration-v7.sql            # 升级：周推游戏（问题/回答/回答游戏三表 + RLS）
    └── migration-v8.sql            # 升级：美图分享（photos/photo_likes 两表 + RLS）
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
