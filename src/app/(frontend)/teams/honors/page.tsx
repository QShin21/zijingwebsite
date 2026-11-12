import Link from "next/link";
import { notFound } from "next/navigation";
import { getHonors, type HonorCard } from "@/lib/v2";
import { TeamHonorsPanel } from "@/components/TeamHonorsPanel";
import { teamHonorScopeID } from "@/components/TeamHonorNavigation";
import { pageNumber, read, request, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, LinkTabs, Notice, PageHero, Pager, Wrap } from "@/components/v2/ui";
import { HonorTile } from "@/components/v2/cards";
import { TeamsNav } from "@/components/v2/TeamsNav";
import { empty } from "@/components/v2/copy";
import layout from "@/components/v2/layout.module.css";
import styles from "@/components/team-pages/TeamPages.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "荣誉墙" };

function byYear(items: HonorCard[]) {
  const groups = new Map<string, HonorCard[]>();
  for (const item of items) {
    const year = item.date?.slice(0, 4) ?? "日期待补";
    groups.set(year, [...(groups.get(year) ?? []), item]);
  }
  return [...groups.entries()];
}

export default async function TeamHonors({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const team = query.team ? teamHonorScopeID(query.team) : undefined;
  const game = query.game ? teamHonorScopeID(query.game) : undefined;
  if (team === null || game === null) notFound();
  const view = query.view === "mine" || query.view === "review" ? query.view : "public";
  const page = pageNumber(single(query.page));
  const message = single(query.message);
  const tabs = (
    <LinkTabs
      label="荣誉视图"
      items={[
        { href: "/teams/honors", label: "荣誉墙", current: view === "public" },
        { href: "/teams/honors?view=mine", label: "我的投稿", current: view === "mine" },
        { href: "/teams/honors?view=review", label: "审核", current: view === "review" },
      ]}
    />
  );

  if (view !== "public") {
    const { payload, user } = await request();
    return (
      <>
        <PageHero
          tone="stage"
          eyebrow={view === "review" ? "HONORS · 审核工作台" : "HONORS · 队员投稿"}
          title={view === "review" ? "队伍荣誉审核" : "我的荣誉投稿"}
          description={view === "review" ? "核验赛事与成果材料，为投稿人留下明确的处理意见。" : "记录队伍的比赛与成绩，继续草稿，查看审核进度。"}
          back={{ href: "/teams/honors", label: "荣誉墙" }}
        />
        <Wrap className={layout.pageBody}>
          {tabs}
          {message && <Notice>{message}</Notice>}
          <div className={styles.workspace}>
            <TeamHonorsPanel payload={payload} user={user} view={view} page={page} team={team} game={game} />
          </div>
        </Wrap>
      </>
    );
  }

  const year = single(query.year);
  const validYear = year && /^\d{4}$/.test(year) ? year : undefined;
  const result = await read(getHonors, { team, community: game, year: validYear, page, limit: 24 }, "/teams/honors");
  const filtered = Boolean(team || game || validYear);
  return (
    <>
      <PageHero
        tone="stage"
        eyebrow="HALL OF FAME · 荣誉墙"
        title="荣誉墙"
        description="每一座奖杯都经过核验。按年份浏览紫荆代表队的比赛成绩与高光时刻。"
        actions={
          <ButtonLink href="/teams/honors?view=mine" tone="accent" icon="plus">
            投稿荣誉
          </ButtonLink>
        }
      />
      <Wrap className={layout.pageBody}>
        <TeamsNav current="honors" />
        {tabs}
        {message && <Notice>{message}</Notice>}
        {result.years.length > 0 && (
          <nav className={layout.filters} aria-label="按年份筛选">
            <Link href="/teams/honors" className={!validYear ? "button" : "button light"}>
              全部年份
            </Link>
            {result.years.map((value) => (
              <Link key={value} href={`/teams/honors?year=${value}`} className={validYear === String(value) ? "button" : "button light"}>
                {value}
              </Link>
            ))}
          </nav>
        )}
        <p className={layout.resultMeta}>
          <span>
            {filtered ? "筛选结果" : "全部荣誉"} · {result.totalDocs} 项
          </span>
          {filtered && <Link href="/teams/honors">清除筛选</Link>}
        </p>
        {result.docs.length ? (
          byYear(result.docs).map(([label, items]) => (
            <section key={label} className={layout.dayGroup} aria-label={`${label} 年荣誉`}>
              <h2 className={layout.dayHead}>{label}</h2>
              <div className={layout.grid3}>
                {items.map((honor) => (
                  <HonorTile key={honor.key} honor={honor} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState title={empty.honors.title} icon="trophy" actions={<ButtonLink href="/teams/honors?view=mine" tone="ghost" size="small">投稿荣誉</ButtonLink>}>
            {empty.honors.body}
          </EmptyState>
        )}
        <Pager
          page={result.page}
          totalPages={result.totalPages}
          path="/teams/honors"
          query={{ team: team ? String(team) : undefined, game: game ? String(game) : undefined, year: validYear }}
        />
      </Wrap>
    </>
  );
}
