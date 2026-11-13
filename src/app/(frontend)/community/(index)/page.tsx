import Link from "next/link";
import { getCommunities } from "@/lib/v2";
import { pageNumber, read, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, PageHero, Pager, Wrap } from "@/components/v2/ui";
import { CommunityTile } from "@/components/v2/cards";
import { empty } from "@/components/v2/copy";
import layout from "@/components/v2/layout.module.css";
import styles from "@/components/v2/community.module.css";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("游戏社群", "Game communities") };
}

export default async function Communities({ searchParams }: { searchParams: Search }) {
  const { t } = await getT();
  const search = await searchParams;
  const q = (single(search.q) ?? "").trim().slice(0, 80);
  const page = pageNumber(search.page);
  const result = await read(getCommunities, { q: q || undefined, page, limit: 24 }, "/community");
  return (
    <>
      <PageHero
        tone="stage"
        eyebrow={t("COMMUNITIES · 游戏社群", "COMMUNITIES")}
        title={t("找到同好，从这里开场", "Find your people and start here")}
        description={t("游戏社群是紫荆的日常据点。找到你玩的游戏，看看活动与风采，再联系管理员人工拉你进群。", "Game communities are where Zijing gathers day to day. Find your game, browse its events and showcase, then contact an admin to be added to the group.")}
        actions={
          <ButtonLink href="/community/apply" tone="stage" icon="plus">
            {t("申请组织社群", "Apply to organize a community")}
          </ButtonLink>
        }
      />
      <Wrap className={layout.pageBody}>
        <form action="/community" method="get" role="search" className={styles.search}>
          <label htmlFor="community-search" className="sr-only">
            {t("按游戏或社群名称查找", "Search by game or community name")}
          </label>
          <input id="community-search" name="q" type="search" defaultValue={q} maxLength={80} placeholder={t("搜索游戏名称或介绍关键词", "Search game names or keywords")} />
          <button className="button" type="submit">
            {t("查找社群", "Search")}
          </button>
          {q && (
            <Link className="button light" href="/community">
              {t("全部社群", "All communities")}
            </Link>
          )}
        </form>
        <p className={layout.resultMeta}>
          <span>
            {q ? t(`“${q}”的匹配结果`, `Results for “${q}”`) : t("已开放社群", "Open communities")} · {t(`${result.totalDocs} 个`, `${result.totalDocs}`)}
          </span>
        </p>
        {result.docs.length ? (
          <div className={layout.communities}>
            {result.docs.map((card) => (
              <CommunityTile key={card.community.id} card={card} />
            ))}
          </div>
        ) : q ? (
          <EmptyState title={t("没有找到匹配的社群", "No matching communities")} icon="search" actions={<ButtonLink href="/community" tone="ghost" size="small">{t("查看全部社群", "View all communities")}</ButtonLink>}>
            {t("换一个游戏名称或关键词试试。", "Try another game name or keyword.")}
          </EmptyState>
        ) : (
          <EmptyState title={t(empty.communities.title, "Communities are being prepared")} icon="community" actions={<ButtonLink href="/community/apply" tone="ghost" size="small">{t("申请组织新社群", "Apply to organize a new community")}</ButtonLink>}>
            {t(empty.communities.body, "To organize your game as a community, submit an organizer application.")}
          </EmptyState>
        )}
        <Pager page={result.page} totalPages={result.totalPages} path="/community" query={{ q: q || undefined }} />
        <section className={styles.organize} aria-labelledby="organize-title">
          <div>
            <h2 id="organize-title">{t("把热爱的游戏，组织成社群", "Turn the game you love into a community")}</h2>
            <p>{t("参与已有社群的组织工作，或为还没出现的游戏发起申请。审核状态和处理意见会保存在你的申请记录中。", "Help organize an existing community, or apply for a game that is not here yet. Review status and comments are kept in your application record.")}</p>
          </div>
          <ButtonLink href="/community/apply" tone="accent" icon="arrow">
            {t("申请成为社群管理员", "Apply to be a community admin")}
          </ButtonLink>
        </section>
      </Wrap>
    </>
  );
}
