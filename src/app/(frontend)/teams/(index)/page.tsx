import Link from "next/link";
import { getCommunities, getTeams } from "@/lib/v2";
import { pageNumber, read, readOptional, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, PageHero, Pager, Wrap } from "@/components/v2/ui";
import { TeamTile } from "@/components/v2/cards";
import { TeamsNav } from "@/components/v2/TeamsNav";
import layout from "@/components/v2/layout.module.css";

export const metadata = { title: "代表队" };
const statuses = { active: "活跃", resting: "休整", archived: "归档" } as const;

export default async function Teams({ searchParams }: { searchParams: Search }) {
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
        eyebrow="TEAMS · 代表队中心"
        title="代表队"
        description="各游戏社群的代表队、公开队员简介与已核验荣誉。想上场？到选拔中心找开放批次。"
        actions={
          <>
            <ButtonLink href="/teams/recruitment" tone="accent" icon="arrow">
              选拔中心
            </ButtonLink>
            <ButtonLink href="/teams/honors" tone="stage">
              荣誉墙
            </ButtonLink>
          </>
        }
      />
      <Wrap className={layout.pageBody}>
        <TeamsNav current="teams" />
        <div className={layout.sidebarLayout}>
          <div>
            <form className={layout.filters} method="get" action="/teams" aria-label="筛选代表队">
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
              <label>
                状态
                <select name="status" defaultValue={status ?? ""}>
                  <option value="">全部状态</option>
                  {Object.entries(statuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className={layout.filterActions}>
                <button type="submit" className="button">
                  筛选
                </button>
                {filtered && (
                  <Link href="/teams" className="text-link">
                    清除筛选
                  </Link>
                )}
              </div>
            </form>
            <p className={layout.resultMeta}>
              <span>
                {filtered ? "筛选结果" : "全部队伍"} · {result.totalDocs} 支
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
                title={filtered ? "没有符合条件的队伍" : "还没有公开的代表队"}
                icon="trophy"
                actions={
                  filtered ? (
                    <ButtonLink href="/teams" tone="ghost" size="small">
                      清除筛选
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/teams/apply" tone="ghost" size="small">
                      申请建立代表队
                    </ButtonLink>
                  )
                }
              >
                代表队由社群管理员申请建立，审核通过后出现在这里。
              </EmptyState>
            )}
            <Pager page={result.page} totalPages={result.totalPages} path="/teams" query={{ community, status }} />
          </div>
          <aside className={`${layout.panel} ${layout.sticky}`}>
            <h2 className={layout.panelTitle}>组织与管理</h2>
            <p style={{ color: "var(--z-muted)", fontSize: 14 }}>建队申请与队伍事务，按当前社群任职和授权处理。</p>
            <ul style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <li>
                <Link className="text-link" href="/teams/apply">
                  申请建立代表队
                </Link>
              </li>
              <li>
                <Link className="text-link" href="/teams/manage">
                  代表队工作台
                </Link>
              </li>
              <li>
                <Link className="text-link" href="/teams/recruitment#mine">
                  我的选拔申请
                </Link>
              </li>
            </ul>
          </aside>
        </div>
      </Wrap>
    </>
  );
}
