import Link from "next/link";
import { getCommunities } from "@/lib/v2";
import { pageNumber, read, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, PageHero, Pager, Wrap } from "@/components/v2/ui";
import { CommunityTile } from "@/components/v2/cards";
import { empty } from "@/components/v2/copy";
import layout from "@/components/v2/layout.module.css";
import styles from "@/components/v2/community.module.css";

export const metadata = { title: "游戏社群" };

export default async function Communities({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const q = (single(search.q) ?? "").trim().slice(0, 80);
  const page = pageNumber(search.page);
  const result = await read(getCommunities, { q: q || undefined, page, limit: 24 }, "/community");
  return (
    <>
      <PageHero
        tone="stage"
        title="游戏社群"
        description="选择游戏社群，联系在任管理员邀请进群"
        actions={
          <ButtonLink href="/community/apply" tone="stage" icon="plus">
            申请组织社群
          </ButtonLink>
        }
      />
      <Wrap className={layout.pageBody}>
        <form action="/community" method="get" role="search" className={styles.search}>
          <label htmlFor="community-search" className="sr-only">
            按游戏或社群名称查找
          </label>
          <input id="community-search" name="q" type="search" defaultValue={q} maxLength={80} placeholder="搜索游戏名称或介绍关键词" />
          <button className="button" type="submit">
            查找社群
          </button>
          {q && (
            <Link className="button light" href="/community">
              全部社群
            </Link>
          )}
        </form>
        <p className={layout.resultMeta}>
          <span>
            {q ? `“${q}”的匹配结果` : "已开放社群"} · {result.totalDocs} 个
          </span>
        </p>
        {result.docs.length ? (
          <div className={layout.communities}>
            {result.docs.map((card) => (
              <CommunityTile key={card.community.id} card={card} />
            ))}
          </div>
        ) : q ? (
          <EmptyState title="没有找到匹配的社群" icon="search" actions={<ButtonLink href="/community" tone="ghost" size="small">查看全部社群</ButtonLink>}>
            换一个游戏名称或关键词试试。
          </EmptyState>
        ) : (
          <EmptyState title={empty.communities.title} icon="community" actions={<ButtonLink href="/community/apply" tone="ghost" size="small">申请组织新社群</ButtonLink>}>
            {empty.communities.body}
          </EmptyState>
        )}
        <Pager page={result.page} totalPages={result.totalPages} path="/community" query={{ q: q || undefined }} />
        <section className={styles.organize} aria-labelledby="organize-title">
          <div>
            <h2 id="organize-title">组织游戏社群</h2>
            <p>可申请管理已有社群或组织新社群，审核进度见「我的申请」。</p>
          </div>
          <ButtonLink href="/community/apply" tone="accent" icon="arrow">
            申请成为社群管理员
          </ButtonLink>
        </section>
      </Wrap>
    </>
  );
}
