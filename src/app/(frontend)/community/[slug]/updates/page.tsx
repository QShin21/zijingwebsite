import Link from "next/link";
import { getCommunityPosts, type ArticleCard, type EventCard } from "@/lib/v2";
import { StaffRecruitmentNotice } from "@/components/StaffRecruitmentNotice";
import { pageNumber, read, request, single, type Search } from "@/components/v2/data";
import { ButtonLink, EmptyState, LinkTabs, Notice, Pager, Wrap } from "@/components/v2/ui";
import { MatchCard, NoticeRow } from "@/components/v2/cards";
import { managesGame } from "@/lib/rules";
import { bySlug } from "@/lib/content";
import layout from "@/components/v2/layout.module.css";
import styles from "@/components/v2/community.module.css";
import { getT } from "@/lib/i18n/server";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

export default async function Updates({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Search }) {
  const { slug } = await params;
  const { t, locale } = await getT();
  const search = await searchParams;
  const category = single(search.category) === "notice" ? "notice" : "event";
  const page = pageNumber(search.page);
  const base = `/community/${slug}/updates`;
  const [result, game, { user }] = await Promise.all([
    read(getCommunityPosts, { slug, category, page, limit: 12 }, base),
    bySlug("games", slug),
    request(),
  ]);
  const canPublish = Boolean(game && managesGame(user, game.id));
  const message = single(search.message);
  return (
    <Wrap className={layout.pageBody}>
      <div className={layout.sidebarLayout}>
        <div>
          <h1 className={styles.pageTitle}>{t("活动与通知", "Events and notices")}</h1>
          {message && <Notice>{localizeAccountMessage(message, locale)}</Notice>}
          <StaffRecruitmentNotice />
          <LinkTabs
            label={t("内容类别", "Content type")}
            items={[
              { href: base, label: t("社群活动", "Community events"), current: category === "event" },
              { href: `${base}?category=notice`, label: t("社群通知", "Community notices"), current: category === "notice" },
            ]}
          />
          {result.docs.length ? (
            category === "event" ? (
              <div className={styles.postList}>
                {(result.docs as EventCard[]).map((event) => (
                  <MatchCard key={event.key} event={event} />
                ))}
              </div>
            ) : (
              <ul className={`${layout.list} ${layout.panel}`}>
                {(result.docs as ArticleCard[]).map((notice) => (
                  <NoticeRow key={notice.key} article={notice} />
                ))}
              </ul>
            )
          ) : (
            <EmptyState
              title={category === "event" ? t("暂无社群活动", "No community events") : t("暂无社群通知", "No community notices")}
              icon={category === "event" ? "calendar" : "megaphone"}
              actions={
                <ButtonLink href={`/community/${slug}/showcase`} tone="ghost" size="small">
                  {t("查看社群风采", "View community showcase")}
                </ButtonLink>
              }
            >
              {t("社群的活动安排与通知发布后会在这里展示。", "Community events and notices appear here once posted.")}
            </EmptyState>
          )}
          <Pager page={result.page} totalPages={result.totalPages} path={base} query={{ category: category === "notice" ? "notice" : undefined }} />
        </div>
        <aside className={`${layout.panel} ${layout.sticky}`}>
          <h2 className={layout.panelTitle}>{t("找到一起参与的同学", "Find people to play with")}</h2>
          <p className={styles.asideText}>{t("联系管理员申请加入微信群，在社群里了解日常安排与交流方式。", "Contact an admin to join the WeChat group and learn about everyday plans in the community.")}</p>
          <p>
            <Link className="text-link" href={`/community/${slug}#community-contacts`}>
              {t("查看管理员名片", "View admin contact cards")}
            </Link>
          </p>
          {canPublish && (
            <p style={{ marginTop: 16 }}>
              <ButtonLink href={`${base}/new`} icon="plus" size="small">
                {t("发布活动或通知", "Post an event or notice")}
              </ButtonLink>
            </p>
          )}
        </aside>
      </div>
    </Wrap>
  );
}
