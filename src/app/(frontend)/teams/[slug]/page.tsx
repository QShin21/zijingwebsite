import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { getTeam, type TeamDetail } from "@/lib/v2";
import { read } from "@/components/v2/data";
import { Avatar, ButtonLink, CommunityChip, DemoPill, EmptyState, Section, StatusPill, Wrap, type Tone } from "@/components/v2/ui";
import { HonorTile, MatchCard, RecruitmentTile } from "@/components/v2/cards";
import { RichText } from "@/components/v2/RichText";
import { Icon } from "@/components/v2/Icon";
import { empty } from "@/components/v2/copy";
import { formatDate, hueStyle, initial } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";
import styles from "./team.module.css";

type Props = { params: Promise<{ slug: string }> };
const load = cache((slug: string) => read(getTeam, { slug }, `/teams/${slug}`));
const tone: Record<TeamDetail["card"]["status"], Tone> = { active: "success", resting: "warning", archived: "neutral", unestablished: "info" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { card } = await load((await params).slug);
  return { title: card.team.title, description: card.summary ?? undefined };
}

export default async function Team({ params }: Props) {
  const detail = await load((await params).slug);
  const { card, viewer } = detail;
  const team = card.team;
  const hue = team.community?.hue ?? 262;
  const open = detail.recruitments.find((call) => call.state === "open");
  return (
    <>
      <header className={styles.hero} style={hueStyle(hue)}>
        <div className={styles.heroInner}>
          <nav className={styles.crumbs} aria-label="面包屑">
            <Link href="/teams">代表队</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{team.title}</span>
          </nav>
          <div className={styles.identity}>
            <span className={styles.crest} aria-hidden="true">
              {initial(team.title)}
            </span>
            <div className={styles.titles}>
              <p className={styles.tags}>
                {team.community && <CommunityChip community={team.community} link />}
                <StatusPill tone={tone[card.status]}>{card.statusLabel}</StatusPill>
                {card.demo && <DemoPill />}
              </p>
              <h1>{team.title}</h1>
              {card.summary && <p className={styles.summary}>{card.summary}</p>}
            </div>
          </div>
          <ul className={styles.stats} aria-label="队伍数据">
            <li>
              <strong>{card.counts.publicMembers}</strong>
              <span>公开队员</span>
            </li>
            <li>
              <strong>{card.counts.honors}</strong>
              <span>已核验荣誉</span>
            </li>
            <li>
              <strong>{detail.seasons.length}</strong>
              <span>赛季档案</span>
            </li>
          </ul>
          <div className={styles.actions}>
            {open && (
              <ButtonLink href={open.href} tone="accent" icon="arrow">
                报名选拔：{open.title}
              </ButtonLink>
            )}
            {viewer?.canEditProfile && (
              <ButtonLink href={`/teams/profiles/${team.id}`} tone="stage" icon="edit">
                编辑我的简介
              </ButtonLink>
            )}
            {viewer?.canSubmitHonor && (
              <ButtonLink href={`/teams/honors?view=mine&team=${team.id}`} tone="stage" icon="trophy">
                投稿荣誉
              </ButtonLink>
            )}
            {viewer?.canManage && (
              <ButtonLink href={`/teams/manage/${team.id}`} tone="stage" icon="settings">
                本队工作台
              </ButtonLink>
            )}
          </div>
        </div>
      </header>
      <Wrap className={layout.pageBody}>
        {viewer?.membership && (
          <p className={styles.membership}>
            <Icon name="shield" size={18} />
            {viewer.membership.status === "active" ? "你是本队现任队员" : viewer.membership.status === "left" ? "你曾是本队队员" : "你的成员关系已撤销"}
            {viewer.membership.joinedAt && ` · ${formatDate(viewer.membership.joinedAt)} 入队`}
            {viewer.membership.actions.leave && (
              <Link href="/teams/recruitment#my-team-memberships" className="text-link">
                办理离队
              </Link>
            )}
          </p>
        )}
        <Section id="roster" title="队员" count={detail.roster.length}>
          {detail.roster.length ? (
            <ul className={styles.roster}>
              {detail.roster.map((profile) => (
                <li key={profile.id} className={styles.profile}>
                  <Avatar name={profile.displayName} image={profile.avatar} size={64} />
                  <div>
                    <h3>{profile.displayName}</h3>
                    {profile.position && <p className={styles.position}>{profile.position}</p>}
                    {profile.biography && <p className={styles.bio}>{profile.biography}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={empty.roster.title} icon="user" compact>
              {empty.roster.body}
            </EmptyState>
          )}
        </Section>
        <Section id="honors" title="荣誉" count={detail.honors.length} more={{ href: `/teams/honors?team=${team.id}`, label: "荣誉墙" }}>
          {detail.honors.length ? (
            <div className={layout.grid3}>
              {detail.honors.map((honor) => (
                <HonorTile key={honor.key} honor={honor} showTeam={false} />
              ))}
            </div>
          ) : (
            <EmptyState title={empty.honors.title} icon="trophy" compact>
              {empty.honors.body}
            </EmptyState>
          )}
        </Section>
        {detail.recruitments.length > 0 && (
          <Section id="recruitment" title="选拔">
            <div className={layout.grid2}>
              {detail.recruitments.map((call) => (
                <RecruitmentTile key={call.key} call={call} />
              ))}
            </div>
          </Section>
        )}
        {detail.positions.length > 0 && (
          <Section id="positions" title="位置与要求">
            <div className={layout.grid2}>
              {detail.positions.map((position, index) => (
                <article key={`${position.name}-${index}`} className={layout.panel}>
                  <h3>{position.name}</h3>
                  <dl className={styles.positionFacts}>
                    {position.duties && (
                      <div>
                        <dt>职责</dt>
                        <dd>{position.duties}</dd>
                      </div>
                    )}
                    {position.requirements && (
                      <div>
                        <dt>要求</dt>
                        <dd>{position.requirements}</dd>
                      </div>
                    )}
                    {position.commitment && (
                      <div>
                        <dt>投入</dt>
                        <dd>{position.commitment}</dd>
                      </div>
                    )}
                    {position.arrangement && (
                      <div>
                        <dt>安排</dt>
                        <dd>{position.arrangement}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              ))}
            </div>
          </Section>
        )}
        {detail.events.length > 0 && (
          <Section id="events" title="相关活动">
            <div className={styles.events}>
              {detail.events.slice(0, 6).map((event) => (
                <MatchCard key={event.key} event={event} />
              ))}
            </div>
          </Section>
        )}
        {detail.body != null && (
          <Section id="about" title="队伍介绍">
            <RichText body={detail.body} />
          </Section>
        )}
        {detail.seasons.length > 0 && (
          <Section id="seasons" title="赛季档案">
            <ol className={styles.seasons}>
              {detail.seasons.map((season) => (
                <li key={season.id} id={`season-${season.id}`}>
                  <span className={styles.seasonDate}>{season.startAt ? formatDate(season.startAt) : "时间待补"}</span>
                  <div>
                    <h3>{season.title}</h3>
                    {season.members.length > 0 ? (
                      <p>
                        {season.members.map((member) => (member.position ? `${member.displayName}（${member.position}）` : member.displayName)).join("、")}
                      </p>
                    ) : (
                      <p className={styles.muted}>本赛季阵容未公开。</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </Wrap>
    </>
  );
}
