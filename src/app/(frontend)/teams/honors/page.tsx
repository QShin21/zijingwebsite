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
import { getT } from "@/lib/i18n/server";
import { honorMessage } from "./messages";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("荣誉墙", "Honor wall") };
}

type HonorView = "public" | "mine" | "review";

// Chrome around the private workspace is rendered by its own server components so the
// page keeps returning the panel element directly (tests inspect that tree).
async function HonorTabs({ view }: { view: HonorView }) {
  const { t } = await getT();
  return (
    <LinkTabs
      label={t("荣誉视图", "Honor views")}
      items={[
        { href: "/teams/honors", label: t("荣誉墙", "Honor wall"), current: view === "public" },
        { href: "/teams/honors?view=mine", label: t("我的投稿", "My submissions"), current: view === "mine" },
        { href: "/teams/honors?view=review", label: t("审核", "Review"), current: view === "review" },
      ]}
    />
  );
}

async function PrivateHero({ view }: { view: "mine" | "review" }) {
  const { t } = await getT();
  return (
    <PageHero
      tone="stage"
      eyebrow={view === "review" ? t("HONORS · 审核工作台", "HONORS · Review workspace") : t("HONORS · 队员投稿", "HONORS · Player submissions")}
      title={view === "review" ? t("队伍荣誉审核", "Team honor review") : t("我的荣誉投稿", "My honor submissions")}
      description={
        view === "review"
          ? t("核验赛事与成果材料，为投稿人留下明确的处理意见。", "Verify event and result materials and leave clear feedback for submitters.")
          : t("记录队伍的比赛与成绩，继续草稿，查看审核进度。", "Record your team's matches and results, continue drafts and track review progress.")
      }
      back={{ href: "/teams/honors", label: t("荣誉墙", "Honor wall") }}
    />
  );
}

async function MessageNotice({ message }: { message: string }) {
  const { locale } = await getT();
  return <Notice>{honorMessage(message, locale)}</Notice>;
}

function byYear(items: HonorCard[], undated: string) {
  const groups = new Map<string, HonorCard[]>();
  for (const item of items) {
    const year = item.date?.slice(0, 4) ?? undated;
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
  const tabs = <HonorTabs view={view} />;

  if (view !== "public") {
    const { payload, user } = await request();
    return (
      <>
        <PrivateHero view={view} />
        <Wrap className={layout.pageBody}>
          {tabs}
          {message && <MessageNotice message={message} />}
          <div className={styles.workspace}>
            <TeamHonorsPanel payload={payload} user={user} view={view} page={page} team={team} game={game} />
          </div>
        </Wrap>
      </>
    );
  }

  const { t } = await getT();
  const year = single(query.year);
  const validYear = year && /^\d{4}$/.test(year) ? year : undefined;
  const result = await read(getHonors, { team, community: game, year: validYear, page, limit: 24 }, "/teams/honors");
  const filtered = Boolean(team || game || validYear);
  return (
    <>
      <PageHero
        tone="stage"
        eyebrow={t("HALL OF FAME · 荣誉墙", "HALL OF FAME · Honor wall")}
        title={t("荣誉墙", "Honor wall")}
        description={t("每一座奖杯都经过核验。按年份浏览紫荆代表队的比赛成绩与高光时刻。", "Every trophy is verified. Browse Zijing teams' results and highlights by year.")}
        actions={
          <ButtonLink href="/teams/honors?view=mine" tone="accent" icon="plus">
            {t("投稿荣誉", "Submit an honor")}
          </ButtonLink>
        }
      />
      <Wrap className={layout.pageBody}>
        <TeamsNav current="honors" />
        {tabs}
        {message && <MessageNotice message={message} />}
        {result.years.length > 0 && (
          <nav className={layout.filters} aria-label={t("按年份筛选", "Filter by year")}>
            <Link href="/teams/honors" className={!validYear ? "button" : "button light"}>
              {t("全部年份", "All years")}
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
            {filtered ? t("筛选结果", "Results") : t("全部荣誉", "All honors")} · {t(`${result.totalDocs} 项`, `${result.totalDocs} ${result.totalDocs === 1 ? "honor" : "honors"}`)}
          </span>
          {filtered && <Link href="/teams/honors">{t("清除筛选", "Clear filters")}</Link>}
        </p>
        {result.docs.length ? (
          byYear(result.docs, t("日期待补", "Date TBA")).map(([label, items]) => (
            <section key={label} className={layout.dayGroup} aria-label={t(`${label} 年荣誉`, `Honors of ${label}`)}>
              <h2 className={layout.dayHead}>{label}</h2>
              <div className={layout.grid3}>
                {items.map((honor) => (
                  <HonorTile key={honor.key} honor={honor} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState title={t(empty.honors.title, "No verified honors yet")} icon="trophy" actions={<ButtonLink href="/teams/honors?view=mine" tone="ghost" size="small">{t("投稿荣誉", "Submit an honor")}</ButtonLink>}>
            {t(empty.honors.body, "Current players can submit match honors; they appear after review.")}
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
