import Link from "next/link";
import type { ReactNode } from "react";
import { CommunityGameIcon } from "../CommunityGameIcon";
import type {
  ApplicationItem,
  ArticleCard,
  CommunityCard,
  EventCard,
  FeedItem,
  HonorCard,
  ManageQueue,
  MembershipView,
  RecruitmentCard,
  ShowcaseCard,
  SignupReceiptCard,
  TeamCard,
  TodoItem,
} from "@/lib/v2";
import { Icon, type IconName } from "./Icon";
import { CommunityChip, DemoPill, Img, StatusPill, AvatarStack, type Tone } from "./ui";
import {
  countdown,
  dateParts,
  deadlineText,
  formatDate,
  formatDateTime,
  formatRange,
  formatShort,
  hueStyle,
  initial,
} from "./format";
import styles from "./cards.module.css";
import { ShowcaseVideoPlayer } from "./ShowcaseVideoPlayer";

/* ---------- scoreboard date ---------- */
export function DateBlock({ iso, size = "md", tone = "plain" }: { iso: string | null; size?: "sm" | "md" | "lg"; tone?: "plain" | "stage" | "accent" }) {
  const p = dateParts(iso);
  return (
    <span
      className={[styles.date, styles[`date_${size}`], tone !== "plain" ? styles[`date_${tone}`] : ""].filter(Boolean).join(" ")}
      aria-hidden={p ? undefined : true}
    >
      {p ? (
        <>
          <span className={styles.dateMonth}>{p.month}月</span>
          <span className={styles.dateDay}>{String(p.day).padStart(2, "0")}</span>
          <span className={styles.dateWeek}>{p.weekday}</span>
        </>
      ) : (
        <>
          <span className={styles.dateMonth}>时间</span>
          <span className={styles.dateTbd}>待定</span>
        </>
      )}
    </span>
  );
}

export function eventTone(event: EventCard): Tone {
  return event.state === "live"
    ? "live"
    : event.state === "cancelled"
      ? "danger"
      : event.state === "postponed"
        ? "warning"
        : event.state === "ended"
          ? "neutral"
          : "action";
}
export function signupTone(event: EventCard): Tone | null {
  if (event.signup.viewerSubmitted) return "success";
  switch (event.signup.state) {
    case "open":
      return "success";
    case "notStarted":
      return "info";
    case "deadlinePassed":
    case "closed":
      return "neutral";
    default:
      return null;
  }
}
function SignupPill({ event }: { event: EventCard }) {
  const tone = signupTone(event);
  if (!tone || event.signup.mode === "none") return null;
  return <StatusPill tone={tone}>{event.signup.viewerSubmitted ? "已报名" : event.signup.label}</StatusPill>;
}

/* ---------- match card (对阵卡) ---------- */
/** Stable hook naming the promoted community source ("community-posts:12"); presentation only. */
function promotionSource(ref: EventCard["ref"], promoted: boolean): string | undefined {
  if (!promoted) return undefined;
  switch (ref.type) {
    case "event":
      return ref.source === "community" ? `community-posts:${ref.id}` : undefined;
    case "communityNotice":
      return `community-posts:${ref.id}`;
    default:
      return undefined;
  }
}

export function MatchCard({
  event,
  variant = "row",
  headingLevel = 3,
  eager,
  archive,
}: {
  event: EventCard;
  variant?: "row" | "tile" | "spotlight";
  headingLevel?: 2 | 3;
  eager?: boolean;
  /** Personal archive control; only the account overview passes it. Public schedules never do. */
  archive?: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const when = event.startAt || event.endAt ? formatRange(event.startAt, event.endAt) : event.publishedAt ? `发布于 ${formatDate(event.publishedAt)}` : "时间待定";
  const soon = event.state === "upcoming" ? countdown(event.startAt) : null;
  return (
    <article
      className={`${styles.match} ${styles[`match_${variant}`]}`}
      style={event.community ? hueStyle(event.community.hue) : undefined}
      data-community={event.community ? "" : undefined}
      data-state={event.state}
      data-promotion-source={promotionSource(event.ref, event.promoted)}
    >
      <DateBlock iso={event.startAt} size={variant === "spotlight" ? "lg" : variant === "tile" ? "sm" : "md"} tone={variant === "spotlight" ? "accent" : "plain"} />
      <div className={styles.matchBody}>
        <div className={styles.matchTop}>
          {event.community ? <CommunityChip community={event.community} /> : <span className={styles.clubTag}>社团活动</span>}
          {event.category && <span className={styles.category}>{event.category}</span>}
          {event.promoted && <span className={styles.promoted}>精选</span>}
          {event.demo && <DemoPill />}
        </div>
        <Heading className={styles.matchTitle}>
          <Link href={event.href} className={styles.stretch}>
            {event.title}
          </Link>
        </Heading>
        <p className={styles.matchMeta}>
          <span>
            <Icon name="clock" size={15} />
            {when}
          </span>
          {event.location && (
            <span>
              <Icon name="pin" size={15} />
              {event.location}
            </span>
          )}
          {event.team && (
            <span>
              <Icon name="trophy" size={15} />
              {event.team.title}
            </span>
          )}
        </p>
        {variant === "spotlight" && event.summary && <p className={styles.matchSummary}>{event.summary}</p>}
        <div className={styles.matchFoot}>
          <StatusPill tone={eventTone(event)}>{event.stateLabel}</StatusPill>
          <SignupPill event={event} />
          {soon && <span className={styles.countdown}>{soon}</span>}
          {event.signup.state === "open" && event.signup.deadline && !event.signup.viewerSubmitted && (
            <span className={styles.deadline}>{deadlineText(event.signup.deadline)}</span>
          )}
        </div>
      </div>
      {variant !== "tile" && event.cover && (
        <span className={styles.matchCover} aria-hidden="true">
          <Img image={event.cover} alt="" eager={eager} />
        </span>
      )}
      {archive ? (
        <div className={styles.matchSide}>
          <span className={styles.matchArrow} aria-hidden="true">
            <Icon name="arrow" size={18} />
          </span>
          {archive}
        </div>
      ) : (
        <span className={styles.matchArrow} aria-hidden="true">
          <Icon name="arrow" size={18} />
        </span>
      )}
    </article>
  );
}

/** Groups events by Beijing day for the calendar timeline. */
export function groupByDay(events: EventCard[]) {
  const groups: { key: string; label: string; iso: string | null; events: EventCard[] }[] = [];
  for (const event of events) {
    const p = dateParts(event.startAt);
    const key = p ? p.key : "tbd";
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, label: p ? `${p.month}月${p.day}日 ${p.weekday}` : "时间待定", iso: event.startAt, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

/* ---------- notices & articles ---------- */
export function NoticeRow({ article }: { article: ArticleCard }) {
  return (
    <li className={styles.notice} data-promotion-source={promotionSource(article.ref, article.promoted)}>
      <span className={styles.noticeDate}>{formatShort(article.publishedAt) || "—"}</span>
      <div>
        <p className={styles.noticeLabel}>
          {article.label}
          {article.community && <span> · {article.community.title}</span>}
          {article.promoted && <span className={styles.promoted}>精选</span>}
        </p>
        <h3>
          <Link href={article.href} className={styles.stretch}>
            {article.title}
          </Link>
        </h3>
      </div>
      <Icon name="chevron" size={18} />
    </li>
  );
}

export function ArticleTile({ article, headingLevel = 3 }: { article: ArticleCard; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={styles.article} data-cover={article.cover ? "" : undefined} data-promotion-source={promotionSource(article.ref, article.promoted)}>
      {article.cover ? (
        <span className={styles.articleCover}>
          <Img image={article.cover} alt="" />
        </span>
      ) : (
        <span className={styles.articleBadge} aria-hidden="true">
          <Icon name={article.kind === "album" ? "image" : article.kind === "news" ? "news" : "megaphone"} size={22} />
        </span>
      )}
      <div className={styles.articleBody}>
        <p className={styles.articleMeta}>
          <span className={styles.kindTag}>{article.label}</span>
          {article.community && <CommunityChip community={article.community} />}
          {article.demo && <DemoPill />}
        </p>
        <Heading>
          <Link href={article.href} className={styles.stretch}>
            {article.title}
          </Link>
        </Heading>
        {article.summary && <p className={styles.clamp}>{article.summary}</p>}
        <p className={styles.small}>{formatDate(article.publishedAt)}</p>
      </div>
    </article>
  );
}

/* ---------- community ---------- */
export function CommunityCover({ hue, cover, size = "md" }: { title: string; hue: number; cover?: CommunityCard["cover"]; size?: "md" | "lg" }) {
  return (
    <span className={`${styles.cover} ${size === "lg" ? styles.coverLg : ""}`} style={hueStyle(hue)} aria-hidden="true">
      <span className={styles.gameIcon}><CommunityGameIcon image={cover} /></span>
    </span>
  );
}
export function CommunityTile({ card }: { card: CommunityCard }) {
  const { community, counts } = card;
  const facts = [
    counts.upcomingEvents > 0 ? `即将活动 ${counts.upcomingEvents}` : null,
    counts.teams > 0 ? `队伍 ${counts.teams}` : null,
    counts.showcase > 0 ? `风采 ${counts.showcase}` : null,
  ].filter(Boolean);
  return (
    <article className={styles.community} style={hueStyle(community.hue)}>
      <CommunityCover title={community.title} hue={community.hue} cover={card.cover} />
      <div className={styles.communityBody}>
        <h3>
          <Link href={`/community/${community.slug}`} className={styles.stretch}>
            {community.title}
          </Link>
        </h3>
        {card.summary && <p className={styles.clamp}>{card.summary}</p>}
        <p className={styles.facts}>
          {facts.length ? facts.join(" · ") : "进入社群查看最新安排"}
          {card.viewer?.isOfficer && <span className={styles.officer}>我是管理员</span>}
          {card.demo && <DemoPill />}
        </p>
      </div>
    </article>
  );
}

/* ---------- teams ---------- */
const teamTone: Record<TeamCard["status"], Tone> = { active: "success", resting: "warning", archived: "neutral", unestablished: "info" };
export function TeamTile({ card }: { card: TeamCard }) {
  return (
    <article className={styles.team} style={card.team.community ? hueStyle(card.team.community.hue) : undefined}>
      <div className={styles.teamHead}>
        <span className={styles.teamCrest} aria-hidden="true">
          {card.cover ? <Img image={card.cover} alt="" /> : initial(card.team.title)}
        </span>
        <div>
          <h3>
            <Link href={`/teams/${card.team.slug}`} className={styles.stretch}>
              {card.team.title}
            </Link>
          </h3>
          <p className={styles.teamTags}>
            {card.team.community && <CommunityChip community={card.team.community} />}
            <StatusPill tone={teamTone[card.status]}>{card.statusLabel}</StatusPill>
            {card.demo && <DemoPill />}
          </p>
        </div>
      </div>
      {card.summary && <p className={styles.clamp}>{card.summary}</p>}
      <div className={styles.teamFoot}>
        <AvatarStack people={card.roster} total={card.counts.publicMembers} />
        <span className={styles.teamStats}>
          {card.counts.honors > 0 && (
            <span>
              <Icon name="trophy" size={15} /> {card.counts.honors}
            </span>
          )}
          {card.viewer?.membership === "active" && <span className={styles.officer}>我的队伍</span>}
        </span>
      </div>
      {card.openRecruitment && (
        <p className={styles.teamCall}>
          <span>选拔开放</span>
          {card.openRecruitment.title}
          {card.openRecruitment.deadline && <em>{deadlineText(card.openRecruitment.deadline)}</em>}
        </p>
      )}
    </article>
  );
}

/* ---------- honors (奖杯卡) ---------- */
export function HonorTile({ honor, showTeam = true }: { honor: HonorCard; showTeam?: boolean }) {
  return (
    <article className={styles.honor} style={honor.team.community ? hueStyle(honor.team.community.hue) : undefined}>
      <div className={styles.honorTop}>
        <span className={styles.trophy} aria-hidden="true">
          <Icon name="trophy" size={26} />
        </span>
        <span className={styles.placing}>{honor.placing || "荣誉"}</span>
      </div>
      {honor.images[0] && (
        <span className={styles.honorImage}>
          <Img image={honor.images[0]} alt="" />
        </span>
      )}
      <h3>
        <Link href={honor.href} className={styles.stretch}>
          {honor.title || honor.competition}
        </Link>
      </h3>
      <p className={styles.honorCompetition}>{honor.competition}</p>
      <p className={styles.small}>
        {showTeam && <>{honor.team.title} · </>}
        {honor.date ? formatDate(honor.date) : "日期待补"}
        {honor.legacy && " · 档案"}
      </p>
    </article>
  );
}

/* ---------- recruitment ---------- */
const callTone: Record<RecruitmentCard["state"], Tone> = { open: "success", upcoming: "info", closed: "neutral" };
export function RecruitmentTile({ call }: { call: RecruitmentCard }) {
  const deadline = call.state === "open" ? deadlineText(call.deadline) : call.state === "upcoming" && call.opensAt ? `${formatDateTime(call.opensAt)} 开放` : null;
  return (
    <article className={styles.call} data-kind={call.kind} style={call.community ? hueStyle(call.community.hue) : undefined}>
      <p className={styles.callKind}>
        <Icon name={call.kind === "staff" ? "flag" : "trophy"} size={16} />
        {call.kind === "staff" ? "骨干招新" : "代表队选拔"}
        {call.team && <span> · {call.team.title}</span>}
      </p>
      <h3>
        <Link href={call.href} className={styles.stretch}>
          {call.title}
        </Link>
      </h3>
      {call.summary && <p className={styles.clamp}>{call.summary}</p>}
      <div className={styles.callFoot}>
        <StatusPill tone={callTone[call.state]}>{call.stateLabel}</StatusPill>
        {call.viewerApplication && <StatusPill tone="action">我的申请：{call.viewerApplication.statusLabel}</StatusPill>}
        {deadline && <span className={styles.deadline}>{deadline}</span>}
      </div>
    </article>
  );
}

/* ---------- showcase ---------- */
const showcaseTone: Record<ShowcaseCard["status"], Tone> = { visible: "success", pending: "warning", hidden: "neutral", rejected: "danger" };
const showcaseLabel: Record<ShowcaseCard["status"], string> = { visible: "已展示", pending: "待审核", hidden: "已隐藏", rejected: "已退回" };
export function ShowcaseTile({ item, showStatus, promoted }: { item: ShowcaseCard; showStatus?: boolean; promoted?: boolean }) {
  const image = item.images[0]?.image;
  return (
    <article className={styles.showcase} style={hueStyle(item.community.hue)} data-promotion-source={promoted ? `community-showcase:${item.id}` : undefined}>
      <div className={styles.showcaseMedia} data-empty={image ? undefined : ""}>
        {image ? (
          <Img image={image} alt="" />
        ) : !item.video ? (
          <span className={styles.coverInitial} aria-hidden="true">
            {initial(item.title)}
          </span>
        ) : null}
        {item.images.length > 1 && <span className={styles.mediaCount}>{item.images.length} 张</span>}
        {item.video && <ShowcaseVideoPlayer video={item.video} title={item.title} />}
      </div>
      <div className={styles.showcaseBody}>
        <h3>
          <Link href={item.href} className={item.video ? styles.showcaseTitleLink : styles.stretch}>
            {item.title}
          </Link>
        </h3>
        <p className={styles.small}>
          {item.authorName} · {formatDate(item.createdAt)}
        </p>
        {(showStatus || item.status !== "visible") && <StatusPill tone={showcaseTone[item.status]}>{showcaseLabel[item.status]}</StatusPill>}
      </div>
    </article>
  );
}

/** `promoted` marks feeds already filtered to club-level promotions (home highlights). */
export function FeedTile({ item, promoted }: { item: FeedItem; promoted?: boolean }) {
  if (item.kind === "honor") return <HonorTile honor={item.item} />;
  if (item.kind === "showcase") return <ShowcaseTile item={item.item} promoted={promoted} />;
  return <ArticleTile article={item.item} />;
}

/* ---------- me: applications, todo, queues, receipts ---------- */
export function ApplicationCard({ item, archive }: { item: ApplicationItem; archive?: ReactNode }) {
  return (
    <article className={styles.application} data-archived={item.archived ? "" : undefined}>
      <div className={styles.applicationHead}>
        <p className={styles.small}>{item.categoryLabel}</p>
        <span className={styles.applicationPills}>
          {item.archived && <span className={styles.archivedTag}>已归档</span>}
          <StatusPill tone={item.tone === "neutral" ? "neutral" : item.tone}>{item.statusLabel}</StatusPill>
        </span>
      </div>
      <h3>
        <Link href={item.href} className={styles.stretch}>
          {item.title}
        </Link>
      </h3>
      {item.steps.length > 0 && (
        <ol className={styles.steps} aria-label="办理进度">
          {item.steps.map((step, index) => (
            <li key={`${step.label}-${index}`} data-state={step.state}>
              <span aria-hidden="true">{step.state === "done" ? <Icon name="check" size={13} /> : index + 1}</span>
              {step.label}
              <span className="sr-only">{step.state === "done" ? "（已完成）" : step.state === "current" ? "（当前）" : "（待办）"}</span>
            </li>
          ))}
        </ol>
      )}
      {archive ? (
        <div className={styles.applicationFoot}>
          <p className={styles.next}>{item.next}</p>
          {archive}
        </div>
      ) : (
        <p className={styles.next}>{item.next}</p>
      )}
    </article>
  );
}

export function TodoList({ items }: { items: TodoItem[] }) {
  return (
    <ul className={styles.todo}>
      {items.map((item) => (
        <li key={item.key} data-kind={item.kind}>
          <span className={styles.todoIcon} aria-hidden="true">
            <Icon name={item.kind === "review" ? "inbox" : item.kind === "applicationDraft" ? "edit" : "bell"} size={18} />
          </span>
          <div>
            <h3>
              <Link href={item.href} className={styles.stretch}>
                {item.title}
              </Link>
            </h3>
            <p>{item.detail}</p>
          </div>
          {typeof item.count === "number" && item.count > 0 ? <span className={styles.todoCount}>{item.count}</span> : <Icon name="chevron" size={18} />}
        </li>
      ))}
    </ul>
  );
}

const queueIcon: Record<ManageQueue["key"], IconName> = {
  communityApplications: "community",
  staffApplications: "flag",
  teamEstablishments: "shield",
  teamJoins: "user",
  honors: "trophy",
  promotions: "megaphone",
  showcase: "image",
  activities: "list",
  cms: "settings",
};
export function QueueGrid({ queues }: { queues: ManageQueue[] }) {
  return (
    <ul className={styles.queues}>
      {queues.map((queue) => (
        <li key={queue.key}>
          <span className={styles.queueIcon} aria-hidden="true">
            <Icon name={queueIcon[queue.key]} size={20} />
          </span>
          <div>
            <h3>
              {queue.key === "cms" ? (
                <a href={queue.href} className={styles.stretch}>
                  {queue.title}
                </a>
              ) : (
                <Link href={queue.href} className={styles.stretch}>
                  {queue.title}
                </Link>
              )}
            </h3>
            <p>{queue.scope}</p>
          </div>
          {queue.pending === null ? (
            <Icon name="chevron" size={18} />
          ) : queue.pending > 0 ? (
            <span className={styles.queueCount} aria-label={`待处理 ${queue.pending} 项`}>
              {queue.pending}
            </span>
          ) : (
            <span className={styles.queueDone}>已全部处理</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ReceiptRow({ receipt, archive }: { receipt: SignupReceiptCard; archive?: ReactNode }) {
  return (
    <li className={styles.receipt} data-archived={receipt.archived ? "" : undefined}>
      <DateBlock iso={receipt.event?.startAt ?? null} size="sm" />
      <div>
        <h3>
          <Link href={receipt.href} className={styles.stretch}>
            {receipt.eventTitle}
          </Link>
        </h3>
        <p className={styles.small}>
          提交于 {formatDateTime(receipt.submittedAt)}
          {receipt.updatedAt !== receipt.submittedAt && ` · 更新于 ${formatDateTime(receipt.updatedAt)}`}
        </p>
      </div>
      <div className={styles.receiptSide}>
        {receipt.archived && <span className={styles.archivedTag}>已归档</span>}
        <StatusPill tone={receipt.editable ? "success" : "neutral"}>{receipt.editable ? "可修改" : receipt.event ? "已提交" : "活动已撤下"}</StatusPill>
        {archive}
      </div>
    </li>
  );
}

export function MembershipCard({ membership }: { membership: MembershipView }) {
  const status = membership.status === "active" ? "在队" : membership.status === "left" ? "已离队" : "已撤销";
  return (
    <article className={styles.membership} style={membership.team.community ? hueStyle(membership.team.community.hue) : undefined}>
      <span className={styles.teamCrest} aria-hidden="true">
        {initial(membership.team.title)}
      </span>
      <div>
        <h3>
          <Link href={`/teams/${membership.team.slug}`}>{membership.team.title}</Link>
        </h3>
        <p className={styles.small}>
          {status}
          {membership.joinedAt && ` · ${formatDate(membership.joinedAt)} 入队`}
          {membership.leftAt && ` · ${formatDate(membership.leftAt)} 离队`}
        </p>
        <p className={styles.membershipActions}>
          {membership.actions.editProfile && <Link href={`/teams/profiles/${membership.team.id}`}>编辑我的简介</Link>}
          {membership.actions.submitHonor && <Link href={`/teams/honors?view=mine&team=${membership.team.id}`}>投稿荣誉</Link>}
          {membership.actions.leave && <Link href="/teams/recruitment#my-team-memberships">办理离队</Link>}
        </p>
      </div>
    </article>
  );
}
