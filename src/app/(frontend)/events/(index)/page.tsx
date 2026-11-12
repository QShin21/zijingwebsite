import Link from "next/link";
import { getCalendar, getCalendarDays, getCommunities } from "@/lib/v2";
import {
  pageNumber,
  read,
  readOptional,
  request,
  single,
  type Search,
} from "@/components/v2/data";
import {
  ButtonLink,
  EmptyState,
  LinkTabs,
  PageHero,
  Pager,
  Wrap,
} from "@/components/v2/ui";
import { MatchCard, groupByDay } from "@/components/v2/cards";
import { empty } from "@/components/v2/copy";
import { dayKey } from "@/components/v2/format";
import { ScheduleCalendar } from "@/components/v2/ScheduleCalendar";
import calendarStyles from "@/components/v2/schedule-calendar.module.css";
import layout from "@/components/v2/layout.module.css";

export const metadata = { title: "日程", alternates: { canonical: "/events" } };

const scopes = ["all", "club", "community", "mine"] as const;
const ranges = ["upcoming", "past", "month"] as const;
const categories = ["比赛", "观赛", "交流", "训练", "其他"] as const;
type Scope = (typeof scopes)[number];
type Range = (typeof ranges)[number];

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

export default async function Calendar({
  searchParams,
}: {
  searchParams: Search;
}) {
  const search = await searchParams;
  const { user } = await request();
  const signedIn = Boolean(user);
  const rawScope = single(search.scope);
  const scope: Scope =
    scopes.includes(rawScope as Scope) && (rawScope !== "mine" || signedIn)
      ? (rawScope as Scope)
      : "all";
  const rawRange = single(search.range) ?? single(search.time);
  const range: Range = ranges.includes(rawRange as Range)
    ? (rawRange as Range)
    : "upcoming";
  const rawMonth = single(search.month);
  const month =
    range === "month"
      ? rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth)
        ? rawMonth
        : currentMonth()
      : undefined;
  const rawDay = single(search.day);
  const day =
    range === "month" &&
    rawDay &&
    /^\d{4}-\d{2}-\d{2}$/.test(rawDay) &&
    rawDay.startsWith(`${month}-`) &&
    Number.isFinite(Date.parse(`${rawDay}T00:00:00Z`)) &&
    new Date(`${rawDay}T00:00:00Z`).toISOString().slice(0, 10) === rawDay
      ? rawDay
      : undefined;
  const calendarMonth = month ?? currentMonth();
  const rawCategory = single(search.category) ?? single(search.type);
  const category = categories.includes(
    rawCategory as (typeof categories)[number],
  )
    ? rawCategory
    : undefined;
  const rawCommunity = single(search.community);
  const community =
    signedIn && rawCommunity && /^[\w-]{1,120}$/.test(rawCommunity)
      ? rawCommunity
      : undefined;
  const page = pageNumber(search.page);
  // Server-side filter (getCalendar signupOpen) keeps pagination and totals exact.
  const signupOpen = single(search.signupOpen) === "1" ? "1" : undefined;
  const query = {
    scope: scope === "all" ? undefined : scope,
    range: range === "upcoming" ? undefined : range,
    month,
    day,
    category,
    community,
    signupOpen,
  };
  const href = (patch: Partial<typeof query>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...query, ...patch }))
      if (value) params.set(key, value);
    const text = params.toString();
    return text ? `/events?${text}` : "/events";
  };
  const [result, communities, calendarDays] = await Promise.all([
    read(
      getCalendar,
      {
        scope,
        range,
        month,
        day,
        category,
        community,
        signupOpen: signupOpen === "1",
        page,
        limit: 24,
      },
      "/events",
    ),
    signedIn ? readOptional(getCommunities, { limit: 50 }) : null,
    signedIn
      ? read(
          getCalendarDays,
          { month: calendarMonth, category, community },
          "/events",
        )
      : null,
  ]);
  const groups = groupByDay(result.docs);
  const today = dayKey(new Date().toISOString());
  const filtered = Boolean(
    query.scope ||
      query.category ||
      query.community ||
      query.signupOpen ||
      range !== "upcoming",
  );

  return (
    <>
      <PageHero
        tone="stage"
        eyebrow="SCHEDULE · 日程"
        title="日程"
        description={
          signedIn
            ? "社团活动与各游戏社群的活动汇成一条时间线。报名、回执与历史安排都从这里找。"
            : "社团活动与精选社群活动。登录后可查看全部社群活动与本人报名。"
        }
        actions={
          signedIn ? (
            <ButtonLink
              href={href({ scope: "mine" })}
              tone="accent"
              icon="ticket"
            >
              我的报名
            </ButtonLink>
          ) : (
            <ButtonLink
              href="/login?returnTo=%2Fevents"
              tone="accent"
              icon="login"
            >
              登录查看全部
            </ButtonLink>
          )
        }
      />
      <Wrap className={layout.pageBody}>
        <LinkTabs
          label="日程范围"
          items={[
            {
              href: href({ scope: undefined, signupOpen: undefined }),
              label: "全部",
              current: scope === "all" && !signupOpen,
            },
            {
              href: href({ scope: undefined, signupOpen: "1" }),
              label: "可报名",
              current: scope === "all" && Boolean(signupOpen),
            },
            {
              href: href({ scope: "club", signupOpen: undefined }),
              label: "社团活动",
              current: scope === "club",
            },
            {
              href: href({ scope: "community", signupOpen: undefined }),
              label: "社群活动",
              current: scope === "community",
            },
            ...(signedIn
              ? [
                  {
                    href: href({ scope: "mine", signupOpen: undefined }),
                    label: "已报名",
                    current: scope === "mine",
                  },
                ]
              : []),
          ]}
        />
        <form
          className={layout.filters}
          method="get"
          action="/events"
          aria-label="筛选日程"
        >
          {query.day && <input type="hidden" name="day" value={query.day} />}
          {query.scope && (
            <input type="hidden" name="scope" value={query.scope} />
          )}
          <label className={layout.filterCheck}>
            <input
              type="checkbox"
              name="signupOpen"
              value="1"
              defaultChecked={Boolean(signupOpen)}
            />
            只看报名开放
          </label>
          <label>
            时间
            <select name="range" defaultValue={range}>
              <option value="upcoming">即将开始</option>
              <option value="past">已结束</option>
              <option value="month">按月份</option>
            </select>
          </label>
          <label>
            月份（按月份时）
            <input
              type="month"
              name="month"
              defaultValue={month ?? currentMonth()}
            />
          </label>
          <label>
            活动类型
            <select name="category" defaultValue={category ?? ""}>
              <option value="">全部类型</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {communities && communities.docs.length > 0 && (
            <label>
              游戏社群
              <select name="community" defaultValue={community ?? ""}>
                <option value="">全部社群</option>
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
              筛选
            </button>
            {filtered && (
              <Link href="/events" className="text-link">
                清除筛选
              </Link>
            )}
          </div>
        </form>
        <div className={signedIn ? calendarStyles.layout : undefined}>
          {calendarDays && (
            <aside className={calendarStyles.sidebar}>
              <ScheduleCalendar
                month={calendarMonth}
                today={today}
                selectedDay={day}
                days={calendarDays}
                href={href}
              />
            </aside>
          )}
          <div className={calendarStyles.results} id="event-results">
            <p className={layout.resultMeta}>
              <span>
                {range === "past"
                  ? "已结束"
                  : range === "month"
                    ? `${month} 月份`
                    : "即将开始"}{" "}
                · 共 {result.totalDocs} 场
              </span>
              {day && <span>{day} 当天</span>}
              {category && <span>类型：{category}</span>}
              {signupOpen && <span>仅报名开放</span>}
            </p>
            {groups.length ? (
              groups.map((group) => (
                <section
                  key={group.key}
                  className={layout.dayGroup}
                  aria-label={group.label}
                >
                  <h2
                    className={layout.dayHead}
                    data-today={group.key === today ? "" : undefined}
                  >
                    {group.label}
                  </h2>
                  {group.events.map((event) => (
                    <MatchCard key={event.key} event={event} />
                  ))}
                </section>
              ))
            ) : scope === "mine" ? (
              <EmptyState
                title={empty.mySignups.title}
                actions={
                  <ButtonLink href="/events" tone="ghost" size="small">
                    查看可报名活动
                  </ButtonLink>
                }
              >
                {empty.mySignups.body}
              </EmptyState>
            ) : (
              <EmptyState
                title={filtered ? empty.filtered.title : empty.weekEvents.title}
                actions={
                  filtered ? (
                    <ButtonLink href="/events" tone="ghost" size="small">
                      清除筛选
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/announcements" tone="ghost" size="small">
                      查看公告
                    </ButtonLink>
                  )
                }
                icon="calendar"
              >
                {filtered ? empty.filtered.body : empty.weekEvents.body}
              </EmptyState>
            )}
            <Pager
              page={result.page}
              totalPages={result.totalPages}
              path="/events"
              query={query}
            />
          </div>
        </div>
      </Wrap>
    </>
  );
}
