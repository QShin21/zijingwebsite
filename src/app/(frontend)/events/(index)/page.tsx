import Link from "next/link";
import { getCalendar, getCommunities } from "@/lib/v2";
import { pageNumber, read, readOptional, request, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, LinkTabs, PageHero, Pager, Wrap } from "@/components/v2/ui";
import { MatchCard, groupByDay } from "@/components/v2/cards";
import { emptyCopy } from "@/components/v2/copy";
import { getT } from "@/lib/i18n/server";
import { publicLabel } from "@/lib/i18n/labels-public";
import { dayKey } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("日程", "Schedule"), alternates: { canonical: "/events" } };
}

const scopes = ["all", "club", "community", "mine"] as const;
const ranges = ["upcoming", "past", "month"] as const;
// i18n-exempt: CMS select option values used in queries; labels via publicLabel
const categories = ["比赛", "观赛", "交流", "训练", "其他"] as const;
type Scope = (typeof scopes)[number];
type Range = (typeof ranges)[number];

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).format(new Date());
}

export default async function Calendar({ searchParams }: { searchParams: Search }) {
  const { t, locale } = await getT();
  const empty = emptyCopy(t);
  const search = await searchParams;
  const { user } = await request();
  const signedIn = Boolean(user);
  const rawScope = single(search.scope);
  const scope: Scope = scopes.includes(rawScope as Scope) && (rawScope !== "mine" || signedIn) ? (rawScope as Scope) : "all";
  const rawRange = single(search.range) ?? single(search.time);
  const range: Range = ranges.includes(rawRange as Range) ? (rawRange as Range) : "upcoming";
  const rawMonth = single(search.month);
  const month = range === "month" ? (rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : currentMonth()) : undefined;
  const rawCategory = single(search.category) ?? single(search.type);
  const category = categories.includes(rawCategory as (typeof categories)[number]) ? rawCategory : undefined;
  const rawCommunity = single(search.community);
  const community = signedIn && rawCommunity && /^[\w-]{1,120}$/.test(rawCommunity) ? rawCommunity : undefined;
  const page = pageNumber(search.page);
  // Server-side filter (getCalendar signupOpen) keeps pagination and totals exact.
  const signupOpen = single(search.signupOpen) === "1" ? "1" : undefined;
  const query = { scope: scope === "all" ? undefined : scope, range: range === "upcoming" ? undefined : range, month, category, community, signupOpen };
  const href = (patch: Partial<typeof query>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...query, ...patch })) if (value) params.set(key, value);
    const text = params.toString();
    return text ? `/events?${text}` : "/events";
  };
  const [result, communities] = await Promise.all([
    read(getCalendar, { scope, range, month, category, community, signupOpen: signupOpen === "1", page, limit: 24 }, "/events"),
    signedIn ? readOptional(getCommunities, { limit: 50 }) : null,
  ]);
  const groups = groupByDay(result.docs, locale);
  const today = dayKey(new Date().toISOString());
  const filtered = Boolean(query.scope || query.category || query.community || query.signupOpen || range !== "upcoming");

  return (
    <>
      <PageHero
        tone="stage"
        eyebrow={t("SCHEDULE · 日程", "SCHEDULE")}
        title={t("日程", "Schedule")}
        description={
          signedIn
            ? t(
                "社团活动与各游戏社群的活动汇成一条时间线。报名、回执与历史安排都从这里找。",
                "Club and community events in one timeline. Find sign-ups, receipts and past events here.",
              )
            : t("社团活动与精选社群活动。登录后可查看全部社群活动与本人报名。", "Club events and featured community events. Sign in to see all community events and your sign-ups.")
        }
        actions={
          signedIn ? (
            <ButtonLink href={href({ scope: "mine" })} tone="accent" icon="ticket">
              {t("我的报名", "My sign-ups")}
            </ButtonLink>
          ) : (
            <ButtonLink href="/login?returnTo=%2Fevents" tone="accent" icon="login">
              {t("登录查看全部", "Sign in to see all")}
            </ButtonLink>
          )
        }
      />
      <Wrap className={layout.pageBody}>
        <LinkTabs
          label={t("日程范围", "Schedule scope")}
          items={[
            { href: href({ scope: undefined, signupOpen: undefined }), label: t("全部", "All"), current: scope === "all" && !signupOpen },
            { href: href({ scope: undefined, signupOpen: "1" }), label: t("可报名", "Open for sign-up"), current: scope === "all" && Boolean(signupOpen) },
            { href: href({ scope: "club", signupOpen: undefined }), label: t("社团活动", "Club events"), current: scope === "club" },
            { href: href({ scope: "community", signupOpen: undefined }), label: t("社群活动", "Community events"), current: scope === "community" },
            ...(signedIn ? [{ href: href({ scope: "mine", signupOpen: undefined }), label: t("已报名", "Signed up"), current: scope === "mine" }] : []),
          ]}
        />
        <form className={layout.filters} method="get" action="/events" aria-label={t("筛选日程", "Filter schedule")}>
          {query.scope && <input type="hidden" name="scope" value={query.scope} />}
          <label className={layout.filterCheck}>
            <input type="checkbox" name="signupOpen" value="1" defaultChecked={Boolean(signupOpen)} />
            {t("只看报名开放", "Sign-up open only")}
          </label>
          <label>
            {t("时间", "Time")}
            <select name="range" defaultValue={range}>
              <option value="upcoming">{t("即将开始", "Upcoming")}</option>
              <option value="past">{t("已结束", "Ended")}</option>
              <option value="month">{t("按月份", "By month")}</option>
            </select>
          </label>
          <label>
            {t("月份（按月份时）", "Month (when by month)")}
            <input type="month" name="month" defaultValue={month ?? currentMonth()} />
          </label>
          <label>
            {t("活动类型", "Event type")}
            <select name="category" defaultValue={category ?? ""}>
              <option value="">{t("全部类型", "All types")}</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {publicLabel(value, locale)}
                </option>
              ))}
            </select>
          </label>
          {communities && communities.docs.length > 0 && (
            <label>
              {t("游戏社群", "Game community")}
              <select name="community" defaultValue={community ?? ""}>
                <option value="">{t("全部社群", "All communities")}</option>
                {communities.docs.map((card) => (
                  <option key={card.community.id} value={card.community.slug}>
                    {card.community.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={layout.filterActions}>
            <button type="submit" className="button">
              {t("筛选", "Filter")}
            </button>
            {filtered && (
              <Link href="/events" className="text-link">
                {t("清除筛选", "Clear filters")}
              </Link>
            )}
          </div>
        </form>
        <p className={layout.resultMeta}>
          <span>
            {range === "past" ? t("已结束", "Ended") : range === "month" ? t(`${month} 月份`, `Month ${month}`) : t("即将开始", "Upcoming")}
            {t(` · 共 ${result.totalDocs} 场`, ` · ${result.totalDocs} events`)}
          </span>
          {category && <span>{t(`类型：${category}`, `Type: ${publicLabel(category, locale)}`)}</span>}
          {signupOpen && <span>{t("仅报名开放", "Sign-up open only")}</span>}
        </p>
        {groups.length ? (
          groups.map((group) => (
            <section key={group.key} className={layout.dayGroup} aria-label={group.label}>
              <h2 className={layout.dayHead} data-today={group.key === today ? "" : undefined}>
                {group.label}
              </h2>
              {group.events.map((event) => (
                <MatchCard key={event.key} event={event} />
              ))}
            </section>
          ))
        ) : scope === "mine" ? (
          <EmptyState title={empty.mySignups.title} actions={<ButtonLink href="/events" tone="ghost" size="small">{t("查看可报名活动", "Events open for sign-up")}</ButtonLink>}>
            {empty.mySignups.body}
          </EmptyState>
        ) : (
          <EmptyState
            title={filtered ? empty.filtered.title : empty.weekEvents.title}
            actions={
              filtered ? (
                <ButtonLink href="/events" tone="ghost" size="small">
                  {t("清除筛选", "Clear filters")}
                </ButtonLink>
              ) : (
                <ButtonLink href="/announcements" tone="ghost" size="small">
                  {t("查看公告", "View notices")}
                </ButtonLink>
              )
            }
            icon="calendar"
          >
            {filtered ? empty.filtered.body : empty.weekEvents.body}
          </EmptyState>
        )}
        <Pager page={result.page} totalPages={result.totalPages} path="/events" query={query} />
      </Wrap>
    </>
  );
}
