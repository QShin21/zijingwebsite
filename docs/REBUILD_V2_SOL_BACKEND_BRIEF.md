# 致 Sol：竞在紫荆 V2 后端任务书（自足版）

发出方：前端与产品负责人 Claude Code `claude-opus-5-5`（max）。日期：2026-11-11。
你是 GPT-6.1 Sol max，负责本次重做的**全部后端**。前端（网站与微信小程序）由 Claude 实现。父助手负责并行调度、运行需要命令行的生成步骤和最终推送。产品设计见 `docs/REBUILD_V2_PRODUCT_DESIGN.md`，与本文冲突时以本文的接口合同为准，并在 `docs/REBUILD_V2_CONTRACT_CHANGES.md` 记录你提出的任何变更。

---

## 1. 目标

为网站和小程序提供一套**面向新界面的读取视图层（V2）**。它包括四部分：

- 共享服务函数 `src/lib/v2/**`：网站服务端组件直接调用；
- HTTP 路由 `/api/v2/*`：供小程序及网站客户端组件使用；
- 版本化图片接口：替换列表中内联的 base64 图片；
- 少量 additive 数据与权限调整：社群活动时间字段、访客可见页面。

复杂写流程（报名、骨干、代表队、简介、荣誉、社群申请、升推）**继续使用现有服务与路由**，你只需保证它们与新视图兼容，并在 P1 补齐小程序风采投稿与风采审核。

完成标准：接口按 §5 类型逐字段实现，对访客/成员/授权者的投影经测试证明正确；不暴露私人资料；不做破坏性迁移；旧接口在兼容期内继续可用。

## 2. 环境与纪律

- 仓库：`/workspace/shared/zijingwebsite`，本地分支 `new`。Node 24.12、pnpm 11.19，依赖已安装。数据库只用 `pnpm db:dev` 的隔离合成库，绝不连接生产；不读取、不打印 `.env`、凭据与真实私人资料。
- 不推送、不部署、不上传小程序。是否本地提交由父助手协调；任何情况下不要覆盖或回滚前端独占文件（§3）。
- 不新增依赖。若确有必要，先写入 `docs/REBUILD_V2_CONTRACT_CHANGES.md` 并由父助手确认。
- 不删除生产数据；迁移只能 additive，`down` 只用于隔离库演练。
- 保持既有安全规则：公开 Local API 使用 `overrideAccess: false`、`user: null`、`draft: false` 与最小字段；平台角色、社群任职、队伍任职分别鉴权；私人报名、导出、名片二维码、实名与手机号只给现有授权对象；论坛/聊天/评论/点赞/进群进度保持移除。
- 文案用简体中文，错误信息不得包含堆栈、SQL、内部 ID 规则或他人身份信息。不要在任何文档中使用「不是……而是……」句式。

## 3. 文件所有权（避免同文件编辑）

**你独占：**

- `src/lib/**`（含新建 `src/lib/v2/**`）
- `src/app/(frontend)/api/**`（含新建 `api/v2/[...path]/route.ts`）
- `src/app/(frontend)/**/actions.ts`
- `src/app/(frontend)/community/[slug]/contacts/route.ts`、`src/app/(frontend)/community/applications/[id]/qr/route.ts`
- `src/app/(payload)/**`、`src/app/health/**`、`src/app/robots.ts`、`src/app/sitemap.ts`
- `src/proxy.ts`、`src/access/**`、`src/collections/**`、`src/globals/**`、`src/migrations/**`、`src/payload.config.ts`、`src/payload-types.ts`（生成）
- `scripts/**`，**除** `scripts/build-design-tokens.mjs` 与 `scripts/miniapp-icons.mjs`
- `tests/*.test.ts` 与 `tests/fixtures/**`，**除**下方前端测试清单
- 文档：`docs/REBUILD_V2_BACKEND_STATUS.md`、`docs/REBUILD_V2_CONTRACT_CHANGES.md`、`docs/evidence/rebuild-v2-backend-*.json`

**前端独占（不要编辑）：**

- `src/app/(frontend)/**` 中除上列路由与 actions 以外的全部文件（页面、布局、loading/error/not-found、样式）
- `src/app/(design)/**`、`src/components/**`、`src/design/tokens.json` 及其生成物、`src/app/icon.svg`
- `miniprogram/**`（整个小程序）
- `scripts/build-design-tokens.mjs`、`scripts/miniapp-icons.mjs`
- `tests/e2e/**`、`tests/design-tokens.test.ts`
- 读取 `miniprogram/` 源码的客户端测试：`tests/miniapp.test.ts`、`miniapp-wxml-bindings`、`miniapp-startup`、`miniapp-theme`、`miniapp-preview-expressions`、`rebuild-native`、`miniapp-team-workspaces`、`miniapp-team-honor-workspaces`、`miniapp-team-profiles`、`miniapp-team-honors`、`miniapp-staff-review-lifecycle`、`miniapp-privacy-consent`、`miniapp-reading-lifecycle`、`miniapp-honor-media`、`miniapp-community-flows`、`miniapp-community-write-lifecycle`、`miniapp-community-contact-consent`、`showcase-video`，以及同时读取 `miniprogram/` 与 `src/` 的混合测试 `miniapp-team-signup`、`miniapp-team-profile-confirmation-http`、`miniapp-staff-flows`、`miniapp-signup-methods`、`miniapp-signup-lifecycle`、`miniapp-questionnaire`、`miniapp-content-flows`、`miniapp-http-contract`（均为 `tests/*.test.ts`）。

**混合测试的交接：** 小程序将被重写，混合测试中的客户端部分会由前端替换。请在 M1 内把这些混合测试里的**服务端断言**（路由状态码、鉴权、字段投影、并发冲突）复制成你拥有的新文件 `tests/v2-legacy-*.test.ts`，并在状态文档里列出对应关系。前端只在你的替代文件落地后修改混合测试，服务端覆盖面不得因此降低。

**共享但不改：** `package.json`/锁文件（不新增依赖）、`CLAUDE.md`、`AGENTS.md`。

## 4. 现有可复用能力（请复用，勿重写规则）

| 领域 | 文件 | 关键导出 |
| --- | --- | --- |
| 内容读取 | `src/lib/content.ts` | `cms`、`list`（公开投影）、`bySlug`、`fixed`、`site`、`media`、`names` |
| 权限 | `src/lib/rules.ts` | `canParticipate`、`canPublish`、`communityIDs`、`managesGame`、`canReviewShowcase`、`canReviewCommunityApplication`、`canManageStaffRecruitment`、`canReviewPromotion`、`canAppoint`、`canSubmitClubContent`、`canReadActivitySignups`、`canExportActivitySignups`、`eventState`、`registrationState`、`safeURL` |
| 报名 | `src/lib/activity-signups.ts` | `activity`、`signupState`、`ownSignup`、`formVersion` |
| 社群 | `src/lib/community-contacts.ts`、`community-event-list.ts`、`community-operations.ts`、`community-video.ts`、`showcase-images.ts` | `communityContacts`、`communityEventPage`、`decideCommunityApplication`、`communityVideo`、`normalizeShowcaseImage` |
| 升推 | `src/lib/content-promotions.ts` | `promotedContent`、`readPromotionSource`、`changePromotion` |
| 骨干 | `src/lib/staff-recruitment.ts`、`staff-recruitment-model.ts` | `currentStaffBatches`、`publicStaffBatch`、`ownStaffApplication`、`ownStaffReceiptHeaders`、`readStaffApplications`、`staffWindow` |
| 代表队 | `src/lib/team-core.ts`、`team-memberships.ts`、`miniapp-team.ts` | `teamRecruitmentInfo`、`teamRecruitmentState`、`normalizeTeamForm`、`canManageTeam`、`listActiveTeamMemberships`、`teamApplicationLabels`、`teamLifecycleLabels` |
| 简介 | `src/lib/team-profiles.ts` | `readTeamProfiles`（公开投影只含本人授权展示的简介） |
| 荣誉 | `src/lib/team-honor-service.ts` | `teamHonorService`、`PublicHonor`、`HonorArchive`（公开投影须与现有 `/api/team-honor-archives/[team]` 一致） |
| 小程序身份 | `src/lib/miniapp-auth.ts` | `miniappUser`、`miniappLogin` |
| 页面访问 | `src/lib/page-access.ts`、`src/proxy.ts` | `isGuestPage` 等 |

现有写接口（保持行为，新界面继续调用）：

- 报名：`/api/activities/[kind]/[id]/signup`（GET/POST/PUT/PATCH）、`/api/activities/manage`
- 骨干：`/api/staff/batches/[id]/application`（GET/POST/PATCH）、`staff/manage/actions.ts`
- 代表队：`/api/team-core`（GET/POST）
- 简介：`/api/team-profiles/[teamID]`（GET/PUT）
- 荣誉：`/api/team-honors`、`/api/team-honors/[id]`、`/api/team-honor-archives/[team]`、`/api/team-honor-evidence/[id]/video`、`/api/private-team-honor-videos/[filename]`、`teams/honors/actions.ts`
- 视频与问卷：`/api/showcase-videos/[filename]`、`/api/questionnaires/generate`
- 社群：`community/actions.ts`、`community/promotions/actions.ts`、`/community/[slug]/contacts`、`/community/applications/[id]/qr`
- 账号：`account/actions.ts`
- 小程序桥：`/api/miniapp/*`

## 5. V2 接口合同

### 5.1 通用约定

- 路由：单一处理器 `src/app/(frontend)/api/v2/[...path]/route.ts`，内部分派到 `src/lib/v2/*`。`runtime = "nodejs"`，`dynamic = "force-dynamic"`。
- 身份：`const { user } = await p.auth({ headers: request.headers })`，同时支持网站 Cookie 与小程序 `Authorization: JWT <token>`。涉及私人数据与写入时，按 `miniapp-club.ts` 的 `currentUser` 做法重新读取用户的最新角色、任职与账号状态。停用账号按访客处理（读）或返回 403（写）。
- 写入防跨站：Cookie 身份的 POST 必须校验 `Origin` 与站点地址一致（与现有写路由相同规则）；`Authorization: JWT` 请求免此校验。
- 响应头：JSON 一律 `Cache-Control: private, no-store`、`X-Content-Type-Options: nosniff`。
- 错误体：`{ "error": string, "code"?: ErrorCode, "fields"?: Record<string, string> }`。`ErrorCode` 取值：`AUTH_REQUIRED`(401)、`FORBIDDEN`(403)、`NOT_FOUND`(404)、`VALIDATION`(400)、`CONFLICT`(409)、`PAYLOAD_TOO_LARGE`(413)、`UNSUPPORTED_MEDIA`(415)、`RATE_LIMITED`(429)、`UNAVAILABLE`(503)。对不可读对象一律 404，不泄露存在性。
- 分页：`page` 从 1 开始，`limit` 默认 12、上限 50；返回 `Page<T>`。
- 时间：`ISODateTime` 为 UTC ISO 字符串；`BeijingDate` 为 `YYYY-MM-DD`（Asia/Shanghai）。
- 空数据：返回空数组或 `null`（按类型），**不要**返回 404 或报错。
- 富文本：Lexical JSON 原样返回（字段 `body`），并做与现有 `validateRichText` 相同的安全约束；纯文本正文用 `bodyText`。
- 图片：一律返回 `ImageRef`，`src` 为站内相对路径（媒体库 `url` 或 §5.3 图片接口），**禁止**在 JSON 中返回 `data:` URL。
- 网站链接：`href` 为网站路径；客户端路由用 `ref`（小程序据此拼页面路径）。
- 演示资料：所有卡片带 `demo`；生产环境仍按现有规则不返回演示活动。

### 5.2 类型（放在 `src/lib/v2/types.ts`，前端直接导入；字段名按此实现）

```ts
export type ID = number;
export type ISODateTime = string;
export type BeijingDate = string;
export type PlatformRole = "president" | "vicePresident" | "backbone" | "communityAdmin" | "member";
export type ErrorCode = "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT"
  | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA" | "RATE_LIMITED" | "UNAVAILABLE";

export type Page<T> = { docs: T[]; page: number; totalPages: number; totalDocs: number; hasNextPage: boolean };
export type ImageRef = { src: string; width: number | null; height: number | null; alt: string };
export type CommunityRef = { id: ID; slug: string; title: string; hue: number }; // hue = (id * 137) % 360
export type TeamRef = { id: ID; slug: string; title: string; community: CommunityRef | null };
export type FixedPageKey = "about" | "contact" | "privacy" | "join" | "join-members" | "join-teams" | "join-staff";

export type ItemRef =
  | { type: "event"; source: "club"; id: ID; slug: string }
  | { type: "event"; source: "community"; id: ID; community: string }
  | { type: "announcement"; id: ID; slug: string }
  | { type: "communityNotice"; id: ID; community: string }
  | { type: "news"; id: ID; slug: string }
  | { type: "album"; id: ID; slug: string }
  | { type: "showcase"; id: ID; community: string }
  | { type: "honor"; key: string; team: string }
  | { type: "staffBatch"; id: ID }
  | { type: "teamRecruitment"; id: ID }
  | { type: "community"; slug: string }
  | { type: "team"; slug: string }
  | { type: "page"; key: FixedPageKey };

export type CommunityCapabilities = {
  community: CommunityRef; publish: boolean; reviewShowcase: boolean; manageTeams: boolean;
  viewSignups: boolean; exportSignups: boolean; contactCard: boolean;
};
export type Viewer = {
  id: ID; name: string; email: string; roles: PlatformRole[]; department: "execution" | "publicity" | null;
  capabilities: {
    publishClub: boolean; submitClubContent: boolean; reviewCommunityApplications: boolean;
    manageStaffRecruitment: boolean; reviewPromotions: boolean; appoint: boolean; reviewEstablishments: boolean;
    communities: CommunityCapabilities[];
  };
};

export type SignupSummary = {
  mode: "form" | "external" | "channel" | "none";
  state: "open" | "notStarted" | "deadlinePassed" | "closed" | "unavailable";
  label: string;                 // 现有中文措辞，见 §5.5 映射
  opensAt: ISODateTime | null;
  deadline: ISODateTime | null;
  viewerSubmitted: boolean | null; // 访客为 null
};
export type EventCard = {
  key: string;                   // "club:12" | "community:34"
  ref: ItemRef; href: string;
  title: string; summary: string | null; cover: ImageRef | null;
  community: CommunityRef | null; team: TeamRef | null;
  category: "比赛" | "观赛" | "交流" | "训练" | "其他" | null;
  startAt: ISODateTime | null; endAt: ISODateTime | null; location: string | null;
  state: "upcoming" | "live" | "ended" | "cancelled" | "postponed";
  stateLabel: string;            // eventState() 原文
  signup: SignupSummary;
  promoted: boolean; demo: boolean; archived: boolean;
  publishedAt: ISODateTime | null; // 社群活动用 createdAt
};
export type ArticleCard = {
  key: string; kind: "announcement" | "communityNotice" | "news" | "album";
  ref: ItemRef; href: string; label: string; // 公告/社群通知/新闻/回顾/人物故事/影像
  title: string; summary: string | null; cover: ImageRef | null;
  community: CommunityRef | null; publishedAt: ISODateTime | null; promoted: boolean; demo: boolean;
};
export type ShowcaseCard = {
  key: string; id: ID; ref: ItemRef; href: string; community: CommunityRef;
  title: string; body: string | null;
  images: { image: ImageRef; caption: string | null }[];
  video: { kind: "bilibili"; embedSrc: string; pageURL: string | null } | { kind: "file"; src: string } | { kind: "link"; url: string } | null;
  authorName: string; createdAt: ISODateTime; revision: string;
  status: "visible" | "pending" | "hidden" | "rejected";
  reviewNote: string | null;     // 仅作者与审核者可见，其余为 null
  promotion: { status: string; label: string } | null; // 仅有权查看升推状态者
  viewer: { isAuthor: boolean; canReview: boolean; canRequestPromotion: boolean } | null;
};
export type HonorCard = {
  key: string; ref: ItemRef; href: string; team: TeamRef;
  title: string; competition: string; placing: string; date: BeijingDate | null; description: string | null;
  images: ImageRef[]; video: { src: string } | null; // 与现有公开档案投影一致；私有证据不进入
  legacy: boolean; demo: boolean; approvedAt: ISODateTime | null;
};
export type FeedItem =
  | { kind: "article"; item: ArticleCard }
  | { kind: "showcase"; item: ShowcaseCard }
  | { kind: "honor"; item: HonorCard };

export type CommunityCard = {
  community: CommunityRef; summary: string | null; cover: ImageRef | null; demo: boolean;
  counts: { upcomingEvents: number; teams: number; showcase: number };
  viewer: { isOfficer: boolean } | null;
};
export type TeamCard = {
  team: TeamRef; summary: string | null; cover: ImageRef | null; demo: boolean; archived: boolean;
  status: "active" | "resting" | "archived" | "unestablished"; statusLabel: string;
  counts: { publicMembers: number; honors: number };
  roster: { name: string; avatar: ImageRef | null }[]; // 前 5 位公开简介
  openRecruitment: { id: ID; title: string; deadline: ISODateTime | null; stateLabel: string } | null;
  viewer: { membership: "active" | "left" | "revoked" | null; canManage: boolean } | null;
};
export type TeamProfileCard = { id: ID; displayName: string; position: string; biography: string; avatar: ImageRef | null };
export type RecruitmentCard = {
  key: string; ref: ItemRef; href: string; kind: "team" | "staff";
  title: string; summary: string | null; team: TeamRef | null; community: CommunityRef | null;
  opensAt: ISODateTime | null; deadline: ISODateTime | null;
  state: "open" | "upcoming" | "closed"; stateLabel: string;
  viewerApplication: { status: string; statusLabel: string } | null;
};
export type ApplicationItem = {
  key: string; // "staff:1" | "teamJoin:2" | "teamEstablishment:3" | "communityOfficer:4"
  kind: "staff" | "teamJoin" | "teamEstablishment" | "communityOfficer";
  categoryLabel: string; title: string; status: string; statusLabel: string;
  tone: "neutral" | "info" | "warning" | "success" | "danger";
  href: string; updatedAt: ISODateTime; next: string;
  steps: { label: string; state: "done" | "current" | "todo" }[];
};
export type SignupReceiptCard = {
  key: string; eventTitle: string; event: EventCard | null; // 活动已撤下时为 null
  submittedAt: ISODateTime; updatedAt: ISODateTime; href: string; editable: boolean;
};
export type MembershipView = {
  id: ID; team: TeamRef; status: "active" | "left" | "revoked";
  joinedAt: ISODateTime | null; leftAt: ISODateTime | null;
  actions: { editProfile: boolean; submitHonor: boolean; leave: boolean };
};
export type TodoItem = {
  key: string; kind: "applicationReturned" | "applicationDraft" | "honorReturned" | "review";
  title: string; detail: string; href: string; updatedAt: ISODateTime | null; count: number | null;
};
export type ManageQueue = {
  key: "communityApplications" | "staffApplications" | "teamEstablishments" | "teamJoins" | "honors"
    | "promotions" | "showcase" | "activities" | "cms";
  title: string; href: string; pending: number | null; scope: string;
};
export type FixedPage = {
  key: FixedPageKey; title: string; body: unknown | null;
  sections: { id: string; heading: string; text: string }[]; updatedAt: ISODateTime | null;
  contacts: { label: string; text: string; url: string | null }[] | null; // 仅 contact 页
};
```

### 5.3 服务函数（`src/lib/v2/index.ts` 导出，网站服务端组件直接调用）

统一签名 `(p: Payload, viewer: User | null, input) => Promise<…>`；HTTP 处理器调用同一函数。

| 编号 | 函数 | HTTP | 访问 | 返回 |
| --- | --- | --- | --- | --- |
| A1 | `getSession` | `GET /api/v2/session` | 公开 | `{ viewer: Viewer \| null }` |
| A2 | `getHome` | `GET /api/v2/home` | 公开（成员多字段） | `HomeResponse` |
| A3 | `getCalendar` | `GET /api/v2/calendar` | 公开（成员范围更大） | `Page<EventCard>` |
| A4 | `getEventDetail` | `GET /api/v2/events/{club\|community}/{idOrSlug}` | 社团活动公开；社群活动成员 | `EventDetail` |
| A5 | `getFeed` | `GET /api/v2/feed` | 公开（访客仅公告） | `Page<FeedItem> & { restricted: boolean }` |
| A6 | `getArticle` | `GET /api/v2/articles/{kind}/{idOrSlug}` | 公告公开；其他成员 | `ArticleDetail` |
| A7 | `getCommunities` | `GET /api/v2/communities` | 成员 | `Page<CommunityCard>` |
| A8 | `getCommunity` | `GET /api/v2/communities/{slug}` | 成员 | `CommunityDetail` |
| A9 | `getContacts` | `GET /api/v2/communities/{slug}/contacts` | 成员 | `{ contacts: { id: ID; name: string; qr: ImageRef }[] }` |
| A10 | `getShowcase` | `GET /api/v2/communities/{slug}/showcase` | 成员 | `Page<ShowcaseCard>` |
| A10b | `getCommunityPosts` | `GET /api/v2/communities/{slug}/posts` | 成员 | `Page<EventCard \| ArticleCard>` |
| A11 | `getTeams` | `GET /api/v2/teams` | 成员 | `Page<TeamCard>` |
| A12 | `getTeam` | `GET /api/v2/teams/{slug}` | 成员 | `TeamDetail` |
| A13 | `getHonors` | `GET /api/v2/honors` | 成员 | `Page<HonorCard> & { years: number[] }` |
| A14 | `getRecruitmentCenter` | `GET /api/v2/recruitment` | 公开（访客只有骨干） | `RecruitmentCenter` |
| A15 | — | `GET /api/v2/images/{kind}/{id}/{index}` | 同父对象 | 图片二进制 |
| A16 | `createUpload`（P1） | `POST /api/v2/uploads` | 成员 | `{ upload: UploadReceipt }` |
| A17 | `createShowcase`、`reviewShowcase`（P1） | `POST /api/v2/communities/{slug}/showcase`、`POST /api/v2/showcase/{id}/review` | 成员 / 审核者 | `{ showcase: ShowcaseCard }` |
| A18 | `getMe` | `GET /api/v2/me` | 成员 | `MeResponse` |
| A19 | `getMySignups`、`getMyApplications` | `GET /api/v2/me/signups`、`GET /api/v2/me/applications` | 成员 | `Page<SignupReceiptCard>`、`Page<ApplicationItem>` |
| A20 | `getManage` | `GET /api/v2/manage` | 有任一管理能力者，否则 `{ queues: [] }` | `{ queues: ManageQueue[] }` |
| A21 | `getFixedPage` | `GET /api/v2/pages/{key}` | about/contact/privacy/join/join-staff 公开；join-members/join-teams 成员 | `FixedPage` |

### 5.4 逐接口规则

**A1 session。** `Viewer.capabilities` 由 `rules.ts` 计算：`publishClub = canPublish`，`submitClubContent`，`reviewCommunityApplications`，`manageStaffRecruitment`，`reviewPromotions`，`appoint`，`reviewEstablishments = canPublish`；`communities` 来自在任 `communityOffices`（`manageTeams` 对应 `handleJoins`，`contactCard` 对应 `contactConsent`）。`email` 只返回本人。

**A2 home。**

```ts
export type HomeResponse = {
  viewer: Viewer | null;
  site: { name: string; heroTitle: string | null; heroSubtitle: string | null; heroImage: ImageRef | null;
    heroAction: { label: string; href: string } | null; footer: string | null };
  today: BeijingDate;
  spotlight: EventCard | null;
  upcoming: EventCard[];          // ≤ 6
  openSignups: EventCard[];       // signup.state === "open"，≤ 4
  openCalls: RecruitmentCard[];   // 访客：开放中的骨干批次；成员：另加开放中的代表队招新；≤ 6，按截止时间升序
  notices: ArticleCard[];         // ≤ 4：公开公告 + 已升推社群通知，按发布时间降序
  highlights: FeedItem[] | null;  // 成员 ≤ 5：最新荣誉、已升推风采、影像；访客 null
  communities: CommunityCard[] | null; // 成员 ≤ 8，按 games.sort；访客 null
  me: { todo: number; upcomingSignups: number; reviewPending: number } | null; // 访客 null
  about: { excerpt: string | null } | null; // 固定页 about 正文首段纯文本 ≤ 160 字；未发布为 null
};
```

`spotlight` 选择：`Site.featuredEvents` 中第一个未结束、未取消的；否则最近的即将开始社团活动（按 `startAt` 升序）；否则进行中的；都没有为 `null`。`heroAction` 来自 `heroButtonLabel/heroButtonURL`（沿用现有 `publicHref` 安全规则）。`Site.modules`、`Site.navigation` 不再参与。

**A3 calendar。** 查询参数：`scope=all|club|community|mine`（默认 all；`mine` 需登录）、`community=<slug>`、`category=比赛|观赛|交流|训练|其他`（仅社团活动有类型；指定类型时排除社群活动）、`range=upcoming|past|month`（默认 upcoming）、`month=YYYY-MM`（range=month 时必填）、`page`、`limit`。

- 来源：已发布社团活动（`list("events")` 公开投影）；访客另加已升推社群活动（`promotedContent(p, "event")`）；成员另加所有 `status=visible`、`category=event` 的社群帖子。去重键为 `key`，升推项 `promoted=true`。
- `upcoming`：`state ∈ {upcoming, live, postponed}`；有 `startAt` 的按 `startAt` 升序在前；无 `startAt` 的社群活动仅当 `createdAt` 在 30 天内，按 `createdAt` 降序排在后面。
- `past`：`state ∈ {ended, cancelled}` 或无时间且超过 30 天，按 `startAt`/`createdAt` 降序。
- `month`：`startAt` 落在该北京时间月份内，升序。
- 跨两个集合分页：各取按排序前 500 条候选在内存合并分页，并在状态文档中写明上限。
- `viewerSubmitted`：成员视图一次性查询本人 `event-signups`（`dedupeKey` 前缀 `kind:id:userID`），不得逐条查询。

**A4 event detail。**

```ts
export type EventDetail = {
  event: EventCard;
  body: unknown | null; bodyText: string | null; images: ImageRef[];
  registration: { url: string | null; channelText: string | null; qrCode: ImageRef | null; contact: string | null;
    requirements: string | null; checkedAt: ISODateTime | null } | null; // 仅社团活动
  related: { news: ArticleCard[]; albums: ArticleCard[] };              // 仅社团活动
  viewer: { canManageSignup: boolean; canViewSignups: boolean; canExportSignups: boolean; canRequestPromotion: boolean } | null;
};
```

`idOrSlug` 为纯数字按 ID 查，否则按 slug（仅社团活动）。报名与回执继续走 `/api/activities/{events|community-posts}/{id}/signup`。`viewer` 中三项报名能力复用 `activity()` 返回的 `manager/canView/canExport`。

**A5 feed。** `kind=all|announcements|news|albums|showcase|honors`、`community=<slug>`、`page`。访客无论 `kind` 只返回公开公告和已升推社群通知，`restricted=true`。成员：`all` 按日期降序合并公告、社群通知（可见）、新闻、影像、已发布风采（visible）、已核验荣誉。

**A6 article。** `kind=announcement|news|album|communityNotice`。

```ts
export type ArticleDetail = {
  article: ArticleCard; body: unknown | null; bodyText: string | null; images: ImageRef[];
  sections: { id: string; heading: string; text: string }[];
  photos: Page<{ image: ImageRef; caption: string | null }> | null; // album 分页，limit 12
  related: { event: EventCard | null; team: TeamRef | null };
};
```

**A7 communities。** `q`（≤ 80 字，匹配 title/summary）、`page`。计数：`upcomingEvents` 为可见社群活动中 upcoming 或 30 天内无时间的数量；`teams` 为未归档队伍；`showcase` 为 visible 风采。用 `p.count`，禁止拉全量文档计数。

**A8 community detail。**

```ts
export type CommunityDetail = {
  card: CommunityCard; body: unknown | null;
  officers: { id: ID; name: string; hasContactCard: boolean }[]; // 在任且 contactConsent 的管理员
  upcoming: EventCard[];       // ≤ 3
  notices: ArticleCard[];      // ≤ 3
  showcase: ShowcaseCard[];    // ≤ 6 visible
  teams: TeamCard[];           // 本社群队伍
  viewer: { canPublish: boolean; canReviewShowcase: boolean; pendingShowcase: number | null;
    canManageTeams: boolean; canViewSignups: boolean; canApplyOfficer: boolean };
};
```

**A9 contacts。** 与 `communityContacts(slug)` 同一筛选；`qr` 指向 A15 `contact` 图片。仅成员；社群不存在 404。

**A10 showcase。** `view=public|mine|review`。`mine` 返回本人全部状态；`review` 需 `canReviewShowcase`，返回 pending；`public` 只返回 visible。视频用 `communityVideo` 解析，受控文件走 `/api/showcase-videos/...`。

**A10b posts。** `category=event|notice`；管理者可见 hidden（标记在卡片 `stateLabel` 或 `label` 中注明「已隐藏」）。

**A11 teams。** `community=<slug>`、`status=active|resting|archived`、`page`。`roster` 与 `publicMembers` 只计本人授权展示的简介；头像走 A15 `profile`。

**A12 team detail。**

```ts
export type TeamDetail = {
  card: TeamCard; body: unknown | null;
  positions: { name: string; duties: string | null; requirements: string | null; commitment: string | null; arrangement: string | null }[];
  roster: TeamProfileCard[];
  legacyRoster: { displayName: string; position: string | null }[];   // 旧档案中已授权的阵容
  honors: HonorCard[];
  seasons: { id: ID; title: string; startAt: ISODateTime | null; members: { displayName: string; position: string | null }[] }[];
  recruitments: RecruitmentCard[]; events: EventCard[];
  viewer: { membership: MembershipView | null; canManage: boolean; canEditProfile: boolean; canSubmitHonor: boolean } | null;
};
```

**A13 honors。** `team`、`community`、`year`、`page`；来源为已批准的队伍荣誉记录（`teamHonorService` 公开档案投影）与已核验旧荣誉（`legacy=true`）；`years` 为有记录的年份降序。

**A14 recruitment。**

```ts
export type RecruitmentCenter = {
  staff: RecruitmentCard[];                 // 公开骨干批次，state 来自 staffWindow
  teams: Page<RecruitmentCard> | null;      // 成员：open/closed 的代表队招新；访客 null
  mine: ApplicationItem[] | null;           // 成员：本人骨干与入队申请；访客 null
};
```

**A15 图片接口。** `GET /api/v2/images/{kind}/{id}/{index}?v={version}`：

| kind | 来源 | 访问规则 |
| --- | --- | --- |
| `showcase` | `community-showcase.images[index].source` | visible；或作者本人；或该社群 reviewShowcase；或 canPublish |
| `community-post` | `community-posts.postImages[index]` | 帖子对该用户可读 |
| `event-post` / `announcement-post` | `events` / `announcements` 的 `postImages[index]` | 已发布（与公开投影一致） |
| `profile` | `team-member-profiles.avatar`（index=0） | 简介 visible，或本人 |
| `contact` | 路径 `/contact/{communityID}/{userID}`：该管理员名下最近一份有二维码的社群申请 `wechatQr` | 成员，且满足 `communityContacts` 的同一筛选 |
| `honor` | 已批准荣誉记录的公开图片 | 与公开档案一致 |
| `upload`（P1） | 未消费的临时上传 | 仅上传者 |

返回解码后的二进制，`Content-Type` 按实际格式。`version` 为存储内容 SHA-256 前 16 位。`v` 与当前一致时返回 `Cache-Control: private, max-age=31536000, immutable`，否则 `private, no-cache` 并带 `ETag`；支持 `If-None-Match` 返回 304。任何不可读一律 404。`ImageRef.src` 必须包含正确的 `v`。媒体库图片继续使用 Payload `url`，同时提供 `width/height/alt`。

**A16 uploads（P1）。** `multipart/form-data`，字段 `file`（单个）、`purpose=showcase`。限制 2 MB、静态 PNG/JPEG/WebP、≤ 4000 万像素；用 `normalizeShowcaseImage` 规范为 WebP。新增集合 `pending-uploads`（owner、purpose、data、width、height、expiresAt=24h、consumedAt），只允许本人读取。每次上传时顺带清理已过期记录。

```ts
export type UploadReceipt = { id: ID; purpose: "showcase"; width: number; height: number; expiresAt: ISODateTime; preview: ImageRef };
```

小程序 `wx.uploadFile` 一次只传一个文件，因此采用「逐张上传 → 一次提交」。

**A17 风采投稿与审核（P1）。**

- `POST /api/v2/communities/{slug}/showcase`，JSON `{ title: string; body?: string; videoURL?: string; images: { upload: ID; caption?: string }[] }`（≤ 6 张）。消费本人未过期上传，经现有 `participationGuard` 规则（`context.webShowcaseWrite: true`）创建，返回 201 `{ showcase }`。上传已消费或过期返回 409 `CONFLICT`；被禁言返回 403。
- `POST /api/v2/showcase/{id}/review`，JSON `{ decision: "visible" | "rejected" | "hidden"; reviewNote?: string; revision: string }`。把 `reviewShowcaseAction` 的规则抽到 `src/lib`，网站 action 与此接口共用。修订号不一致返回 409；退回/拒绝必须填写意见（与网站一致）。

**A18 me。**

```ts
export type MeResponse = {
  viewer: Viewer;
  todo: TodoItem[];                 // 退回待补充、入队草稿、荣誉退回；以及各审核队列（count>0 时）
  upcoming: EventCard[];            // 已报名且未结束，≤ 5
  applications: ApplicationItem[];  // 进行中优先，≤ 8
  memberships: MembershipView[];
  counts: { signups: number; applications: number };
};
```

`ApplicationItem.steps` 为三段：「已提交 / 审核中 / 结果」，按现有状态映射；`next` 文案沿用 `/account` 现有表述（如「查看反馈，按要求补充后重新提交。」）。`href` 指向现有网站页面。

**A20 manage。** 每个队列只在用户具备对应能力时出现：

| key | 能力 | pending 计数 |
| --- | --- | --- |
| communityApplications | canReviewCommunityApplication | 状态 pending 的社群申请 |
| staffApplications | canManageStaffRecruitment | submitted/reviewing 的骨干申请 |
| teamEstablishments | canPublish | pending 建队申请 |
| teamJoins | 管理任一队伍 | 所管队伍的 pending 入队申请 |
| honors | 荣誉审核权限（沿用现有判断） | 待审荣誉 |
| promotions | canReviewPromotion | 待审升推 |
| showcase | 任一社群 reviewShowcase | 待审风采 |
| activities | submitClubContent 或任一 viewSignups | null |
| cms | submitClubContent | null |

计数查询必须走 `overrideAccess: false` 加该用户身份；无法安全计数时返回 `null`。

**A21 pages。** `contact` 页附带 `Site.contacts`；其余 `contacts=null`。`join-members`、`join-teams` 仅成员。

### 5.5 报名状态映射

| 来源 | 条件 | mode | state | label |
| --- | --- | --- | --- | --- |
| 社团活动/社群活动 | `signupForm.enabled` | form | `signupState()`：报名开放→open、报名尚未开始→notStarted、报名已截止→deadlinePassed、报名已关闭→closed | 原文 |
| 社团活动 | 未启用问卷且 `registrationURL` 安全 | external | `registrationState()`：报名开放→open、尚未开始→notStarted、已截止→deadlinePassed、已关闭→closed、暂无报名渠道→unavailable | 原文 |
| 社团活动 | 未启用问卷、无 URL、有 `channelText` | channel | 同上 | 原文 |
| 其他 | — | none | unavailable | 「未启用报名」 |

`opensAt/deadline` 取问卷或报名字段中实际生效的开始/截止时间。

## 6. 数据与权限变更（additive）

1. **社群活动时间**：`community-posts` 新增可空字段 `startAt`、`endAt`（date，Asia/Shanghai 录入、UTC 存储）、`location`（text ≤ 120）。仅 `category=event` 可填，同时填写时结束必须晚于开始。生成迁移、更新 `payload-types`。`publishCommunityAction` 接受 FormData 字段 `startAt`、`endAt`（`YYYY-MM-DDTHH:mm`，北京时间）、`location`。P1 新增 `updateCommunityPostScheduleAction(formData: id, revision, startAt, endAt, location)`，仅本社群发布者。旧帖保持为空，日程归入「时间待定」。
2. **临时上传集合**（P1）：`pending-uploads`，见 A16；不在后台导航显示。
3. **访客页面**：`page-access.ts` 增加精确 `/`、`/join`，前缀 `/about`、`/contact`、`/join/staff`。注意 `/` 只能精确匹配，不能让 `startsWith("/")` 放开全站。`proxy.ts` 删除未登录 `/` 跳转 `/events` 的特例。社群、代表队及其余页面维持登录要求，私人 API 规则不变。同步更新 `tests/page-access.test.ts` 与代理测试。
4. **Site 全局**：保留 `modules`、`navigation` 字段与数据，仅把后台说明改为「V2 网站不使用此字段」；不删除字段。
5. 不改用户、角色、任职、代表队、荣誉、报名的既有结构与权限。

## 7. 兼容

- `/api/miniapp/*`、Payload REST 及全部现有路由在兼容期保持原行为（线上小程序 0.5.x 仍在使用）。下线由父助手另行决定。
- `tests/web-reset-contracts.test.ts` 的入口基线只追加 V2 路由，不删除旧入口。
- 网站旧页面路径全部保留（前端重做内容），你不需要新增重定向。

## 8. 测试（隔离合成库）

每个服务函数至少覆盖：

1. 访客 / 普通成员 / 社群管理员（分别有、无 viewSignups/reviewShowcase/handleJoins）/ 骨干 / 副社长 / 停用账号六类身份的投影差异。
2. 负向断言：响应中不出现他人邮箱、手机号、实名、`wechatQr`/data URL、`internalNotes`、他人的 `reviewNote`、草稿、待审内容、生产环境演示资料、私有荣誉证据。
3. 空库返回空数组或 null，不报错；分页边界；`limit` 上限。
4. 日程合并排序、`range` 各分支、无时间社群活动的 30 天规则、`viewerSubmitted` 批量查询（断言查询次数不随条数线性增长）。
5. 图片接口访问矩阵、`v` 命中与不命中的缓存头、304、404 不泄露存在性。
6. HTTP：Cookie 与 JWT 两种身份、POST 的 Origin 校验、错误体与状态码、`Cache-Control`。
7. 迁移：隔离库 up；旧帖字段为空；`community-posts` 既有数据摘要不变。
8. P1：上传大小/类型/像素、过期与重复消费 409、禁言 403、审核修订冲突 409、退回必填意见。
9. 访问：未登录 `/`、`/about`、`/contact`、`/join`、`/join/staff/**` 不跳转；`/community`、`/teams`、`/account` 仍跳转登录。
10. `pnpm typecheck`、改动文件 ESLint、相关 Vitest、`pnpm build` 实际执行。退出码与摘要写入 `docs/evidence/rebuild-v2-backend-*.json`，未运行的写「未运行」。

## 9. 里程碑与交付

- **M1（优先，前端依赖）**：`types.ts` 先行提交到工作树并通知父助手；随后 A1–A4、A14、A15、A21、访客页面变更、社群活动时间字段与迁移；混合测试服务端断言迁移（§3）。
- **M2**：A5–A13、A18–A20。
- **M3（P1）**：A16、A17、日程编辑 action。

每个里程碑结束时更新 `docs/REBUILD_V2_BACKEND_STATUS.md`。逐接口标注「已实现 / 已测试 / 偏差」，写明数据量上限与已知限制。任何字段改名、增删或语义变化，先写入 `docs/REBUILD_V2_CONTRACT_CHANGES.md`（旧→新、原因、影响端），并由父助手转告前端。不得静默改动 `types.ts` 已发布的字段。

## 10. 默认决策（无需再问）

- 计数取不到时返回 `null`，前端隐藏。
- 社群色相固定为 `(id × 137) mod 360`。
- 访客日程包含已升推社群活动，点开详情需登录（与现状一致）。
- 小程序复杂创作（问卷设计、批次配置、社群发布、升推审核）不提供新接口，保持网页端完成。
- 列表内所有图片走 A15 或媒体库 URL，不再内联。
