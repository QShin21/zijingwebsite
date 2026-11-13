// Shared V2 view contracts. Published by the Opus product brief.
import type { Affiliation } from "../affiliation";

export type ID = number;
export type ISODateTime = string;
export type BeijingDate = string;
export type PlatformRole = "president" | "vicePresident" | "backbone" | "communityAdmin" | "honoraryBackbone" | "member";
export type ErrorCode = "AUTH_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT"
  | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA" | "RATE_LIMITED" | "UNAVAILABLE";

export type Page<T> = { docs: T[]; page: number; totalPages: number; totalDocs: number; hasNextPage: boolean };
export type ImageRef = { src: string; width: number | null; height: number | null; alt: string };
export type PublicationPresentation = { mode: "gallery" | "article"; blocks: ({ type: "text"; text: string } | { type: "image"; image: ImageRef })[] };
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
  affiliation: Affiliation;
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
  viewer: { isOfficer: boolean; canManageIcon?: boolean } | null;
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
  href: string; webOnly: boolean; updatedAt: ISODateTime; next: string;
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
  title: string; detail: string; href: string; webOnly: boolean; updatedAt: ISODateTime | null; count: number | null;
};
export type ManageQueue = {
  key: "communityApplications" | "staffApplications" | "teamEstablishments" | "teamJoins" | "honors"
    | "promotions" | "showcase" | "activities" | "cms";
  title: string; href: string; webOnly: boolean; pending: number | null; scope: string;
};
export type FixedPage = {
  key: FixedPageKey; title: string; body: unknown | null;
  sections: { id: string; heading: string; text: string }[]; updatedAt: ISODateTime | null;
  contacts: { label: string; text: string; url: string | null }[] | null; // 仅 contact 页
};

export type HomeSectionKind = "upcoming" | "open" | "notices" | "promoted" | "communities" | "highlights" | "about";
export type HomeSection = { kind: HomeSectionKind; enabled: boolean; title: string };
export type HomeResponse = {
  sections: HomeSection[]; // CMS order, visibility and titles; never grants content access
  promoted: { events: EventCard[]; notices: ArticleCard[]; showcases: ShowcaseCard[] | null };
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

export type EventDetail = {
  event: EventCard;
  body: unknown | null; bodyText: string | null; images: ImageRef[];
  presentation?: PublicationPresentation | null;
  registration: { url: string | null; channelText: string | null; qrCode: ImageRef | null; contact: string | null;
    requirements: string | null; checkedAt: ISODateTime | null } | null; // 仅社团活动
  related: { news: ArticleCard[]; albums: ArticleCard[] };              // 仅社团活动
  viewer: { canManageSignup: boolean; canViewSignups: boolean; canExportSignups: boolean; canRequestPromotion: boolean } | null;
};

export type ArticleDetail = {
  article: ArticleCard; body: unknown | null; bodyText: string | null; images: ImageRef[];
  presentation?: PublicationPresentation | null;
  sections: { id: string; heading: string; text: string }[];
  photos: Page<{ image: ImageRef; caption: string | null }> | null; // album 分页，limit 12
  related: { event: EventCard | null; team: TeamRef | null };
};

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

/** Lightweight layout projection, without body, contacts or child content lists. */
export type CommunityHeader = Pick<CommunityDetail, "card" | "viewer">;

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

export type RecruitmentCenter = {
  staff: RecruitmentCard[];                 // 公开骨干批次，state 来自 staffWindow
  teams: Page<RecruitmentCard> | null;      // 成员：open/closed 的代表队招新；访客 null
  mine: ApplicationItem[] | null;           // 成员：本人骨干与入队申请；访客 null
};

export type UploadReceipt = { id: ID; purpose: "showcase" | "publication"; width: number; height: number; expiresAt: ISODateTime; preview: ImageRef };

export type MeResponse = {
  viewer: Viewer;
  todo: TodoItem[];                 // 退回待补充、入队草稿、荣誉退回；以及各审核队列（count>0 时）
  upcoming: EventCard[];            // 已报名且未结束，≤ 5
  applications: ApplicationItem[];  // 进行中优先，≤ 8
  memberships: MembershipView[];
  counts: { signups: number; applications: number };
};
