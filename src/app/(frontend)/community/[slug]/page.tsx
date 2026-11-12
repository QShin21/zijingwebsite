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

export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [detail, contacts] = await Promise.all([
    read(getCommunity, { slug }, `/community/${slug}`),
    readOptional(getContacts, { slug }),
  ]);
  const { card, viewer } = detail;
  const base = `/community/${slug}`;
  const manage = [
    viewer.canPublish && { href: `${base}/updates/new`, label: "发布活动或通知", count: null },
    viewer.canReviewShowcase && { href: `${base}/showcase?view=review`, label: "审核社群风采", count: viewer.pendingShowcase },
    viewer.canViewSignups && { href: "/activities", label: "报名名单与问卷工作台", count: null },
    viewer.canManageTeams && { href: "/teams/manage", label: "代表队工作台", count: null },
    viewer.canPublish && { href: "/community/promotions", label: "升推到社团主页", count: null },
  ].filter(Boolean) as { href: string; label: string; count: number | null }[];
  return (
    <Wrap className={layout.pageBody}>
      <h1 className="sr-only">{card.community.title}</h1>
      <div className={styles.overview}>
        <div className={styles.main}>
          <Section id="community-upcoming" title="近期活动" more={{ href: `${base}/updates`, label: "活动与通知" }}>
            {detail.upcoming.length ? (
              <div className={styles.postList}>
                {detail.upcoming.map((event) => (
                  <MatchCard key={event.key} event={event} />
                ))}
              </div>
            ) : (
              <EmptyState title="还没有新的活动安排" icon="calendar" compact>
                管理员发布安排后会出现在这里，你可以先联系管理员了解社群。
              </EmptyState>
            )}
          </Section>
          {detail.notices.length > 0 && (
            <Section id="community-notices" title="最新通知" more={{ href: `${base}/updates?category=notice`, label: "全部通知" }}>
              <ul className={`${layout.list} ${layout.panel}`}>
                {detail.notices.map((notice) => (
                  <NoticeRow key={notice.key} article={notice} />
                ))}
              </ul>
            </Section>
          )}
          <Section id="community-showcase" title="社群风采" more={{ href: `${base}/showcase`, label: "全部风采" }} count={card.counts.showcase}>
            {detail.showcase.length ? (
              <div className={layout.grid3}>
                {detail.showcase.map((item) => (
                  <ShowcaseTile key={item.key} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={empty.showcase.title}
                icon="image"
                compact
                actions={
                  <ButtonLink href={`${base}/showcase/new`} tone="ghost" size="small">
                    投稿风采
                  </ButtonLink>
                }
              >
                {empty.showcase.body}
              </EmptyState>
            )}
          </Section>
          {detail.teams.length > 0 && (
            <Section id="community-teams" title="本社群代表队" more={{ href: `/teams?community=${slug}`, label: "全部队伍" }}>
              <div className={layout.grid2}>
                {detail.teams.map((team) => (
                  <TeamTile key={team.team.id} card={team} />
                ))}
              </div>
            </Section>
          )}
          {detail.body != null && (
            <Section id="community-about" title="认识这个社群">
              <RichText body={detail.body} />
            </Section>
          )}
        </div>
        <aside className={styles.side}>
          <section id="community-contacts" className={styles.contactPanel} style={hueStyle(card.community.hue)} aria-labelledby="contacts-title">
            <h2 id="contacts-title">联系管理员，申请进群</h2>
            <p>保存微信名片，在微信中识别并加好友，备注昵称和“{card.community.title}”。由管理员人工邀请进群；注册与查看名片都不代表已入群。</p>
            {detail.officers.length > 0 && (
              <ul className={styles.officers} aria-label="在任管理员">
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
              title={empty.contacts.title}
              icon="qr"
              compact
              actions={
                viewer.canApplyOfficer ? (
                  <ButtonLink href="/community/apply" tone="ghost" size="small">
                    申请参与社群组织
                  </ButtonLink>
                ) : undefined
              }
            >
              {empty.contacts.body}
            </EmptyState>
          )}
          {manage.length > 0 && (
            <nav className={styles.manage} aria-label="社群管理">
              <h2 className="sr-only">社群管理</h2>
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
