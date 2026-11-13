import Link from "next/link";
import { getCommunity, getContacts } from "@/lib/v2";
import { CommunityContactCards } from "@/components/CommunityJoin";
import { read, readOptional } from "@/components/v2/data";
import { ButtonLink, EmptyState, Section, Wrap } from "@/components/v2/ui";
import { MatchCard, NoticeRow, ShowcaseTile, TeamTile } from "@/components/v2/cards";
import { RichText } from "@/components/v2/RichText";
import { Icon } from "@/components/v2/Icon";
import { empty } from "@/components/v2/copy";
import { hueStyle } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";
import styles from "@/components/v2/community.module.css";
import { getT } from "@/lib/i18n/server";

export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getT();
  const [detail, contacts] = await Promise.all([
    read(getCommunity, { slug }, `/community/${slug}`),
    readOptional(getContacts, { slug }),
  ]);
  const { card, viewer } = detail;
  const base = `/community/${slug}`;
  const manage = [
    viewer.canPublish && { href: `${base}/updates/new`, label: t("发布活动或通知", "Post an event or notice"), count: null },
    viewer.canReviewShowcase && { href: `${base}/showcase?view=review`, label: t("审核社群风采", "Review showcase"), count: viewer.pendingShowcase },
    viewer.canViewSignups && { href: "/activities", label: t("报名名单与问卷工作台", "Sign-ups and questionnaires"), count: null },
    viewer.canManageTeams && { href: "/teams/manage", label: t("代表队工作台", "Team workspace"), count: null },
    viewer.canPublish && { href: "/community/promotions", label: t("升推到社团主页", "Promote to club front page"), count: null },
  ].filter(Boolean) as { href: string; label: string; count: number | null }[];
  return (
    <Wrap className={layout.pageBody}>
      <h1 className="sr-only">{card.community.title}</h1>
      <div className={styles.overview}>
        <div className={styles.main}>
          <Section id="community-upcoming" title={t("近期活动", "Upcoming events")} more={{ href: `${base}/updates`, label: t("活动与通知", "Events and notices") }}>
            {detail.upcoming.length ? (
              <div className={styles.postList}>
                {detail.upcoming.map((event) => (
                  <MatchCard key={event.key} event={event} />
                ))}
              </div>
            ) : (
              <EmptyState title={t("还没有新的活动安排", "No upcoming events yet")} icon="calendar" compact>
                {t("管理员发布安排后会出现在这里，你可以先联系管理员了解社群。", "Events appear here once admins post them. You can contact an admin to learn about the community.")}
              </EmptyState>
            )}
          </Section>
          {detail.notices.length > 0 && (
            <Section id="community-notices" title={t("最新通知", "Latest notices")} more={{ href: `${base}/updates?category=notice`, label: t("全部通知", "All notices") }}>
              <ul className={`${layout.list} ${layout.panel}`}>
                {detail.notices.map((notice) => (
                  <NoticeRow key={notice.key} article={notice} />
                ))}
              </ul>
            </Section>
          )}
          <Section id="community-showcase" title={t("社群风采", "Community showcase")} more={{ href: `${base}/showcase`, label: t("全部风采", "All showcase") }} count={card.counts.showcase}>
            {detail.showcase.length ? (
              <div className={layout.grid3}>
                {detail.showcase.map((item) => (
                  <ShowcaseTile key={item.key} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={t(empty.showcase.title, "No showcase yet")}
                icon="image"
                compact
                actions={
                  <ButtonLink href={`${base}/showcase/new`} tone="ghost" size="small">
                    {t("投稿风采", "Submit to showcase")}
                  </ButtonLink>
                }
              >
                {t(empty.showcase.body, "Members' highlights appear here after admin review.")}
              </EmptyState>
            )}
          </Section>
          {detail.teams.length > 0 && (
            <Section id="community-teams" title={t("本社群代表队", "Teams in this community")} more={{ href: `/teams?community=${slug}`, label: t("全部队伍", "All teams") }}>
              <div className={layout.grid2}>
                {detail.teams.map((team) => (
                  <TeamTile key={team.team.id} card={team} />
                ))}
              </div>
            </Section>
          )}
          {detail.body != null && (
            <Section id="community-about" title={t("认识这个社群", "About this community")}>
              <RichText body={detail.body} />
            </Section>
          )}
        </div>
        <aside className={styles.side}>
          <section id="community-contacts" className={styles.contactPanel} style={hueStyle(card.community.hue)} aria-labelledby="contacts-title">
            <h2 id="contacts-title">{t("联系管理员，申请进群", "Contact an admin to join")}</h2>
            <p>{t(`保存微信名片，在微信中识别并加好友，备注昵称和“${card.community.title}”。由管理员人工邀请进群；注册与查看名片都不代表已入群。`, `Save a WeChat card, scan it in WeChat to add the admin, and note your nickname and “${card.community.title}”. Admins add you to the group manually; registering or viewing cards does not mean you have joined.`)}</p>
            {detail.officers.length > 0 && (
              <ul className={styles.officers} aria-label={t("在任管理员", "Current admins")}>
                {detail.officers.map((officer) => (
                  <li key={officer.id}>{officer.name}</li>
                ))}
              </ul>
            )}
          </section>
          {contacts && contacts.contacts.length > 0 ? (
            <CommunityContactCards contacts={contacts.contacts.map((contact) => ({ id: contact.id, name: contact.name, qr: contact.qr.src }))} />
          ) : (
            <EmptyState
              title={t(empty.contacts.title, "No admin contact cards to show")}
              icon="qr"
              compact
              actions={
                viewer.canApplyOfficer ? (
                  <ButtonLink href="/community/apply" tone="ghost" size="small">
                    {t("申请参与社群组织", "Apply to help organize")}
                  </ButtonLink>
                ) : undefined
              }
            >
              {t(empty.contacts.body, "Cards appear here once current admins agree to show them.")}
            </EmptyState>
          )}
          {manage.length > 0 && (
            <nav className={styles.manage} aria-label={t("社群管理", "Community admin")}>
              <h2 className="sr-only">{t("社群管理", "Community admin")}</h2>
              {manage.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                  {item.count ? <strong>{item.count}</strong> : <Icon name="chevron" size={18} />}
                </Link>
              ))}
            </nav>
          )}
        </aside>
      </div>
    </Wrap>
  );
}
