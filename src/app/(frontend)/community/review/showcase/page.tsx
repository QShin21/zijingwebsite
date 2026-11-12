import { getShowcaseReviewTargets } from "@/lib/v2/account";
import { read } from "@/components/v2/data";
import { ButtonLink, EmptyState, PageHero, Wrap } from "@/components/v2/ui";
import layout from "@/components/v2/layout.module.css";

export const metadata = { title: "社群风采审核" };

export default async function ShowcaseReview() {
  const targets = await read(getShowcaseReviewTargets, {}, "/community/review/showcase");
  return (
    <>
      <PageHero title="社群风采审核" description="选择社群，查看待审核投稿与处理记录" actions={<ButtonLink href="/account#manage" tone="ghost">我的管理台</ButtonLink>} />
      <Wrap className={layout.pageBody}>
        {targets.length ? (
          <ul className={layout.grid2} aria-label="可审核的社群">
            {targets.map(target => (
              <li key={target.id} className={layout.panel}>
                <h2 className={layout.panelTitle}>{target.title}</h2>
                <ButtonLink href={target.href} tone="ghost" icon="arrow">审核风采投稿</ButtonLink>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="当前没有可审核的社群">在任审核权限确认后，对应社群会出现在这里。</EmptyState>}
      </Wrap>
    </>
  );
}
