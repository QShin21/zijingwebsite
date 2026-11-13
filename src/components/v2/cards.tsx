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
  formatDay,
  formatRange,
  formatShort,
  hueStyle,
  initial,
} from "./format";
import styles from "./cards.module.css";
import { getT } from "@/lib/i18n/server";
import type { Locale, Translate } from "@/lib/i18n/locale";
import { articleLabel, eventStateLabel, publicLabel, recruitmentStateLabel, signupStateLabel, teamStatusLabel } from "@/lib/i18n/labels-public";
import { ShowcaseVideoPlayer } from "./ShowcaseVideoPlayer";

/* ---------- scoreboard date ---------- */
const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdaysEn: Record<string, string> = { 周日: "Sun", 周一: "Mon", 周二: "Tue", 周三: "Wed", 周四: "Thu", 周五: "Fri", 周六: "Sat" }; // i18n-exempt: keys are format.ts zh weekdays
export async function DateBlock({ iso, size = "md", tone = "plain" }: { iso: string | null; size?: "sm" | "md" | "lg"; tone?: "plain" | "stage" | "accent" }) {
  const { t, locale } = await getT();
  const en = locale === "en";
  const p = dateParts(iso);
  return (
    <span
      className={[styles.date, styles[`date_${size}`], tone !== "plain" ? styles[`date_${tone}`] : ""].filter(Boolean).join(" ")}
      aria-hidden={p ? undefined : true}
    >
      {p ? (
        <>
          <span className={styles.dateMonth}>{en ? monthsEn[p.month - 1] : `${p.month}月`}</span>
          <span className={styles.dateDay}>{String(p.day).padStart(2, "0")}</span>
          <span className={styles.dateWeek}>{en ? weekdaysEn[p.weekday] ?? p.weekday : p.weekday}</span>
        </>
      ) : (
        <>
          <span className={styles.dateMonth}>{t("时间", "Time")}</span>
          <span className={styles.dateTbd}>{t("待定", "TBA")}</span>
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
function SignupPill({ event, locale }: { event: EventCard; locale: Locale }) {
  const tone = signupTone(event);
  if (!tone || event.signup.mode === "none") return null;
  const t = (zh: string, en: string) => (locale === "en" ? en : zh);
  return <StatusPill tone={tone}>{event.signup.viewerSubmitted ? t("已报名", "Signed up") : signupStateLabel(event.signup.state, event.signup.label, locale)}</StatusPill>;
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

export async function MatchCard({
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
  const { t, locale } = await getT();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const when =
    event.startAt || event.endAt
      ? formatRange(event.startAt, event.endAt, locale)
      : event.publishedAt
        ? t(`发布于 ${formatDate(event.publishedAt)}`, `Published ${formatDate(event.publishedAt, locale)}`)
        : t("时间待定", "Time TBA");
  const soon = event.state === "upcoming" ? countdown(event.startAt, undefined, locale) : null;
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
          {event.community ? <CommunityChip community={event.community} /> : <span className={styles.clubTag}>{t("社团活动", "Club event")}</span>}
          {event.category && <span className={styles.category}>{publicLabel(event.category, locale)}</span>}
          {event.promoted && <span className={styles.promoted}>{t("精选", "Featured")}</span>}
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
          <StatusPill tone={eventTone(event)}>{eventStateLabel(event.state, event.stateLabel, locale)}</StatusPill>
          <SignupPill event={event} locale={locale} />
          {soon && <span className={styles.countdown}>{soon}</span>}
          {event.signup.state === "open" && event.signup.deadline && !event.signup.viewerSubmitted && (
            <span className={styles.deadline}>{deadlineText(event.signup.deadline, undefined, locale)}</span>
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
export function groupByDay(events: EventCard[], locale: Locale = "zh") {
  const groups: { key: string; label: string; iso: string | null; events: EventCard[] }[] = [];
  for (const event of events) {
    const p = dateParts(event.startAt);
    const key = p ? p.key : "tbd";
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, label: p ? formatDay(event.startAt, locale) : locale === "en" ? "Time TBA" : "时间待定", iso: event.startAt, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

/* ---------- notices & articles ---------- */
export async function NoticeRow({ article }: { article: ArticleCard }) {
  const { t, locale } = await getT();
  return (
    <li className={styles.notice} data-promotion-source={promotionSource(article.ref, article.promoted)}>
      <span className={styles.noticeDate}>{formatShort(article.publishedAt) || "—"}</span>
      <div>
        <p className={styles.noticeLabel}>
          {articleLabel(article.kind, article.label, locale)}
          {article.community && <span> · {article.community.title}</span>}
          {article.promoted && <span className={styles.promoted}>{t("精选", "Featured")}</span>}
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

export async function ArticleTile({ article, headingLevel = 3 }: { article: ArticleCard; headingLevel?: 2 | 3 }) {
  const { locale } = await getT();
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
          <span className={styles.kindTag}>{articleLabel(article.kind, article.label, locale)}</span>
          {article.community && <CommunityChip community={article.community} />}
          {article.demo && <DemoPill />}
        </p>
        <Heading>
          <Link href={article.href} className={styles.stretch}>
            {article.title}
          </Link>
        </Heading>
        {article.summary && <p className={styles.clamp}>{article.summary}</p>}
        <p className={styles.small}>{formatDate(article.publishedAt, locale)}</p>
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
export async function CommunityTile({ card }: { card: CommunityCard }) {
  const { t } = await getT();
  const { community, counts } = card;
  const facts = [
    counts.upcomingEvents > 0 ? t(`即将活动 ${counts.upcomingEvents}`, `Upcoming ${counts.upcomingEvents}`) : null,
    counts.teams > 0 ? t(`队伍 ${counts.teams}`, `Teams ${counts.teams}`) : null,
    counts.showcase > 0 ? t(`风采 ${counts.showcase}`, `Showcase ${counts.showcase}`) : null,
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
          {facts.length ? facts.join(" · ") : t("进入社群查看最新安排", "Open the community for the latest plans")}
          {card.viewer?.isOfficer && <span className={styles.officer}>{t("我是管理员", "I'm an admin")}</span>}
          {card.demo && <DemoPill />}
        </p>
      </div>
    </article>
  );
}

/* ---------- teams ---------- */
const teamTone: Record<TeamCard["status"], Tone> = { active: "success", resting: "warning", archived: "neutral", unestablished: "info" };
export async function TeamTile({ card }: { card: TeamCard }) {
  const { t, locale } = await getT();
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
            <StatusPill tone={teamTone[card.status]}>{teamStatusLabel(card.status, card.statusLabel, locale)}</StatusPill>
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
          {card.viewer?.membership === "active" && <span className={styles.officer}>{t("我的队伍", "My team")}</span>}
        </span>
      </div>
      {card.openRecruitment && (
        <p className={styles.teamCall}>
          <span>{t("选拔开放", "Tryouts open")}</span>
          {card.openRecruitment.title}
          {card.openRecruitment.deadline && <em>{deadlineText(card.openRecruitment.deadline, undefined, locale)}</em>}
        </p>
      )}
    </article>
  );
}

/* ---------- honors (奖杯卡) ---------- */
export async function HonorTile({ honor, showTeam = true }: { honor: HonorCard; showTeam?: boolean }) {
  const { t, locale } = await getT();
  return (
    <article className={styles.honor} style={honor.team.community ? hueStyle(honor.team.community.hue) : undefined}>
      <div className={styles.honorTop}>
        <span className={styles.trophy} aria-hidden="true">
          <Icon name="trophy" size={26} />
        </span>
        <span className={styles.placing}>{honor.placing || t("荣誉", "Honor")}</span>
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
        {honor.date ? formatDate(honor.date, locale) : t("日期待补", "Date TBA")}
        {honor.legacy && t(" · 档案", " · Archive")}
      </p>
    </article>
  );
}

/* ---------- recruitment ---------- */
const callTone: Record<RecruitmentCard["state"], Tone> = { open: "success", upcoming: "info", closed: "neutral" };
export async function RecruitmentTile({ call }: { call: RecruitmentCard }) {
  const { t, locale } = await getT();
  const deadline =
    call.state === "open"
      ? deadlineText(call.deadline, undefined, locale)
      : call.state === "upcoming" && call.opensAt
        ? t(`${formatDateTime(call.opensAt)} 开放`, `Opens ${formatDateTime(call.opensAt, locale)}`)
        : null;
  return (
    <article className={styles.call} data-kind={call.kind} style={call.community ? hueStyle(call.community.hue) : undefined}>
      <p className={styles.callKind}>
        <Icon name={call.kind === "staff" ? "flag" : "trophy"} size={16} />
        {call.kind === "staff" ? t("骨干招新", "Staff recruitment") : t("代表队选拔", "Team tryouts")}
        {call.team && <span> · {call.team.title}</span>}
      </p>
      <h3>
        <Link href={call.href} className={styles.stretch}>
          {call.title}
        </Link>
      </h3>
      {call.summary && <p className={styles.clamp}>{call.summary}</p>}
      <div className={styles.callFoot}>
        <StatusPill tone={callTone[call.state]}>{recruitmentStateLabel(call.state, call.stateLabel, locale)}</StatusPill>
        {call.viewerApplication && (
          <StatusPill tone="action">{t(`我的申请：${call.viewerApplication.statusLabel}`, `My application: ${publicLabel(call.viewerApplication.statusLabel, locale)}`)}</StatusPill>
        )}
        {deadline && <span className={styles.deadline}>{deadline}</span>}
      </div>
    </article>
  );
}

/* ---------- showcase ---------- */
const showcaseTone: Record<ShowcaseCard["status"], Tone> = { visible: "success", pending: "warning", hidden: "neutral", rejected: "danger" };
const showcaseLabel = (t: Translate): Record<ShowcaseCard["status"], string> => ({
  visible: t("已展示", "Shown"),
  pending: t("待审核", "Pending review"),
  hidden: t("已隐藏", "Hidden"),
  rejected: t("已退回", "Returned"),
});
export async function ShowcaseTile({ item, showStatus, promoted }: { item: ShowcaseCard; showStatus?: boolean; promoted?: boolean }) {
  const { t, locale } = await getT();
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
        {item.images.length > 1 && <span className={styles.mediaCount}>{t(`${item.images.length} 张`, `${item.images.length} photos`)}</span>}
        {item.video && <ShowcaseVideoPlayer video={item.video} title={item.title} />}
      </div>
      <div className={styles.showcaseBody}>
        <h3>
          <Link href={item.href} className={item.video ? styles.showcaseTitleLink : styles.stretch}>
            {item.title}
          </Link>
        </h3>
        <p className={styles.small}>
          {item.authorName} · {formatDate(item.createdAt, locale)}
        </p>
        {(showStatus || item.status !== "visible") && <StatusPill tone={showcaseTone[item.status]}>{showcaseLabel(t)[item.status]}</StatusPill>}
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
export async function ApplicationCard({ item, archive }: { item: ApplicationItem; archive?: ReactNode }) {
  const { t, locale } = await getT();
  return (
    <article className={styles.application} data-archived={item.archived ? "" : undefined}>
      <div className={styles.applicationHead}>
        <p className={styles.small}>{publicLabel(item.categoryLabel, locale)}</p>
        <span className={styles.applicationPills}>
          {item.archived && <span className={styles.archivedTag}>{t("已归档", "Archived")}</span>}
          <StatusPill tone={item.tone === "neutral" ? "neutral" : item.tone}>{publicLabel(item.statusLabel, locale)}</StatusPill>
        </span>
      </div>
      <h3>
        <Link href={item.href} className={styles.stretch}>
          {item.title}
        </Link>
      </h3>
      {item.steps.length > 0 && (
        <ol className={styles.steps} aria-label={t("办理进度", "Progress")}>
          {item.steps.map((step, index) => (
            <li key={`${step.label}-${index}`} data-state={step.state}>
              <span aria-hidden="true">{step.state === "done" ? <Icon name="check" size={13} /> : index + 1}</span>
              {publicLabel(step.label, locale)}
              <span className="sr-only">
                {step.state === "done" ? t("（已完成）", " (done)") : step.state === "current" ? t("（当前）", " (current)") : t("（待办）", " (to do)")}
              </span>
            </li>
          ))}
        </ol>
      )}
      {archive ? (
        <div className={styles.applicationFoot}>
          <p className={styles.next}>{publicLabel(item.next, locale)}</p>
          {archive}
        </div>
      ) : (
        <p className={styles.next}>{publicLabel(item.next, locale)}</p>
      )}
    </article>
  );
}

export async function TodoList({ items }: { items: TodoItem[] }) {
  const { locale } = await getT();
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
            <p>{publicLabel(item.detail, locale)}</p>
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
export async function QueueGrid({ queues }: { queues: ManageQueue[] }) {
  const { t, locale } = await getT();
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
                  {publicLabel(queue.title, locale)}
                </a>
              ) : (
                <Link href={queue.href} className={styles.stretch}>
                  {publicLabel(queue.title, locale)}
                </Link>
              )}
            </h3>
            <p>{publicLabel(queue.scope, locale)}</p>
          </div>
          {queue.pending === null ? (
            <Icon name="chevron" size={18} />
          ) : queue.pending > 0 ? (
            <span className={styles.queueCount} aria-label={t(`待处理 ${queue.pending} 项`, `${queue.pending} pending`)}>
              {queue.pending}
            </span>
          ) : (
            <span className={styles.queueDone}>{t("已全部处理", "All done")}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export async function ReceiptRow({ receipt, archive }: { receipt: SignupReceiptCard; archive?: ReactNode }) {
  const { t, locale } = await getT();
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
          {t(`提交于 ${formatDateTime(receipt.submittedAt)}`, `Submitted ${formatDateTime(receipt.submittedAt, locale)}`)}
          {receipt.updatedAt !== receipt.submittedAt && t(` · 更新于 ${formatDateTime(receipt.updatedAt)}`, ` · Updated ${formatDateTime(receipt.updatedAt, locale)}`)}
        </p>
      </div>
      <div className={styles.receiptSide}>
        {receipt.archived && <span className={styles.archivedTag}>{t("已归档", "Archived")}</span>}
        <StatusPill tone={receipt.editable ? "success" : "neutral"}>{receipt.editable ? t("可修改", "Editable") : receipt.event ? t("已提交", "Submitted") : t("活动已撤下", "Event withdrawn")}</StatusPill>
        {archive}
      </div>
    </li>
  );
}

export async function MembershipCard({ membership }: { membership: MembershipView }) {
  const { t, locale } = await getT();
  const status = membership.status === "active" ? t("在队", "Active") : membership.status === "left" ? t("已离队", "Left") : t("已撤销", "Revoked");
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
          {membership.joinedAt && t(` · ${formatDate(membership.joinedAt)} 入队`, ` · Joined ${formatDate(membership.joinedAt, locale)}`)}
          {membership.leftAt && t(` · ${formatDate(membership.leftAt)} 离队`, ` · Left ${formatDate(membership.leftAt, locale)}`)}
        </p>
        <p className={styles.membershipActions}>
          {membership.actions.editProfile && <Link href={`/teams/profiles/${membership.team.id}`}>{t("编辑我的简介", "Edit my profile")}</Link>}
          {membership.actions.submitHonor && <Link href={`/teams/honors?view=mine&team=${membership.team.id}`}>{t("投稿荣誉", "Submit an honor")}</Link>}
          {membership.actions.leave && <Link href="/teams/recruitment#my-team-memberships">{t("办理离队", "Leave team")}</Link>}
        </p>
      </div>
    </article>
  );
}
