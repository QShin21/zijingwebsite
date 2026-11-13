import Link from "next/link";
import { getCommunities, getTeams } from "@/lib/v2";
import { pageNumber, read, readOptional, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, PageHero, Pager, Wrap } from "@/components/v2/ui";
import { TeamTile } from "@/components/v2/cards";
import { TeamsNav } from "@/components/v2/TeamsNav";
import layout from "@/components/v2/layout.module.css";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("代表队", "Teams") };
}
const statuses = { active: { zh: "活跃", en: "Active" }, resting: { zh: "休整", en: "Resting" }, archived: { zh: "归档", en: "Archived" } } as const;

export default async function Teams({ searchParams }: { searchParams: Search }) {
  const { t } = await getT();
  const search = await searchParams;
  const rawCommunity = single(search.community) ?? single(search.game);
  const community = rawCommunity && /^[\w-]{1,120}$/.test(rawCommunity) ? rawCommunity : undefined;
  const rawStatus = single(search.status);
  const status = rawStatus && rawStatus in statuses ? (rawStatus as keyof typeof statuses) : undefined;
  const page = pageNumber(search.page);
  const [result, communities] = await Promise.all([
    read(getTeams, { community, status, page, limit: 24 }, "/teams"),
    readOptional(getCommunities, { limit: 50 }),
  ]);
  const filtered = Boolean(community || status);
  return (
    <>
      <PageHero
        tone="stage"
        eyebrow={t("TEAMS · 代表队中心", "TEAMS · Team center")}
        title={t("代表队", "Teams")}
        description={t("各游戏社群的代表队、公开队员简介与已核验荣誉。想上场？到选拔中心找开放批次。", "Teams from each game community, public player profiles and verified honors. Want to play? Find an open batch in the tryout center.")}
        actions={
          <>
            <ButtonLink href="/teams/recruitment" tone="accent" icon="arrow">
              {t("选拔中心", "Tryout center")}
            </ButtonLink>
            <ButtonLink href="/teams/honors" tone="stage">
              {t("荣誉墙", "Honor wall")}
            </ButtonLink>
          </>
        }
      />
      <Wrap className={layout.pageBody}>
        <TeamsNav current="teams" />
        <div className={layout.sidebarLayout}>
          <div>
            <form className={layout.filters} method="get" action="/teams" aria-label={t("筛选代表队", "Filter teams")}>
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
              <label>
                {t("状态", "Status")}
                <select name="status" defaultValue={status ?? ""}>
                  <option value="">{t("全部状态", "All statuses")}</option>
                  {Object.entries(statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label.zh, label.en)}
                    </option>
                  ))}
                </select>
              </label>
              <div className={layout.filterActions}>
                <button type="submit" className="button">
                  {t("筛选", "Filter")}
                </button>
                {filtered && (
                  <Link href="/teams" className="text-link">
                    {t("清除筛选", "Clear filters")}
                  </Link>
                )}
              </div>
            </form>
            <p className={layout.resultMeta}>
              <span>
                {filtered ? t("筛选结果", "Results") : t("全部队伍", "All teams")} · {t(`${result.totalDocs} 支`, `${result.totalDocs} ${result.totalDocs === 1 ? "team" : "teams"}`)}
              </span>
            </p>
            {result.docs.length ? (
              <div className={layout.grid2}>
                {result.docs.map((card) => (
                  <TeamTile key={card.team.id} card={card} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={filtered ? t("没有符合条件的队伍", "No matching teams") : t("还没有公开的代表队", "No public teams yet")}
                icon="trophy"
                actions={
                  filtered ? (
                    <ButtonLink href="/teams" tone="ghost" size="small">
                      {t("清除筛选", "Clear filters")}
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/teams/apply" tone="ghost" size="small">
                      {t("申请建立代表队", "Apply to create a team")}
                    </ButtonLink>
                  )
                }
              >
                {t("代表队由社群管理员申请建立，审核通过后出现在这里。", "Community admins apply to create teams; approved teams appear here.")}
              </EmptyState>
            )}
            <Pager page={result.page} totalPages={result.totalPages} path="/teams" query={{ community, status }} />
          </div>
          <aside className={`${layout.panel} ${layout.sticky}`}>
            <h2 className={layout.panelTitle}>{t("组织与管理", "Organization")}</h2>
            <p style={{ color: "var(--z-muted)", fontSize: 14 }}>{t("建队申请与队伍事务，按当前社群任职和授权处理。", "Team applications and team affairs are handled according to your current community role and permissions.")}</p>
            <ul style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <li>
                <Link className="text-link" href="/teams/apply">
                  {t("申请建立代表队", "Apply to create a team")}
                </Link>
              </li>
              <li>
                <Link className="text-link" href="/teams/manage">
                  {t("代表队工作台", "Team workspace")}
                </Link>
              </li>
              <li>
                <Link className="text-link" href="/teams/recruitment#mine">
                  {t("我的选拔申请", "My tryout applications")}
                </Link>
              </li>
            </ul>
          </aside>
        </div>
      </Wrap>
    </>
  );
}
