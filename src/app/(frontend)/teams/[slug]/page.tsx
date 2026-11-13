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
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }> };
const load = cache((slug: string) => read(getTeam, { slug }, `/teams/${slug}`));
const tone: Record<TeamDetail["card"]["status"], Tone> = { active: "success", resting: "warning", archived: "neutral", unestablished: "info" };
const statusEn: Record<TeamDetail["card"]["status"], string> = { active: "Active", resting: "Resting", archived: "Archived", unestablished: "Not established" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { card } = await load((await params).slug);
  return { title: card.team.title, description: card.summary ?? undefined };
}

export default async function Team({ params }: Props) {
  const { t, locale } = await getT();
  const detail = await load((await params).slug);
  const { card, viewer } = detail;
  const team = card.team;
  const hue = team.community?.hue ?? 262;
  const open = detail.recruitments.find((call) => call.state === "open");
  return (
    <>
      <header className={styles.hero} style={hueStyle(hue)}>
        <div className={styles.heroInner}>
          <nav className={styles.crumbs} aria-label={t("面包屑", "Breadcrumb")}>
            <Link href="/teams">{t("代表队", "Teams")}</Link>
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
                <StatusPill tone={tone[card.status]}>{t(card.statusLabel, statusEn[card.status])}</StatusPill>
                {card.demo && <DemoPill />}
              </p>
              <h1>{team.title}</h1>
              {card.summary && <p className={styles.summary}>{card.summary}</p>}
            </div>
          </div>
          <ul className={styles.stats} aria-label={t("队伍数据", "Team stats")}>
            <li>
              <strong>{card.counts.publicMembers}</strong>
              <span>{t("公开队员", "Public players")}</span>
            </li>
            <li>
              <strong>{card.counts.honors}</strong>
              <span>{t("已核验荣誉", "Verified honors")}</span>
            </li>
            <li>
              <strong>{detail.seasons.length}</strong>
              <span>{t("赛季档案", "Seasons")}</span>
            </li>
          </ul>
          <div className={styles.actions}>
            {open && (
              <ButtonLink href={open.href} tone="accent" icon="arrow">
                {t("报名选拔：", "Join tryout: ")}{open.title}
              </ButtonLink>
            )}
            {viewer?.canEditProfile && (
              <ButtonLink href={`/teams/profiles/${team.id}`} tone="stage" icon="edit">
                {t("编辑我的简介", "Edit my profile")}
              </ButtonLink>
            )}
            {viewer?.canSubmitHonor && (
              <ButtonLink href={`/teams/honors?view=mine&team=${team.id}`} tone="stage" icon="trophy">
                {t("投稿荣誉", "Submit an honor")}
              </ButtonLink>
            )}
            {viewer?.canManage && (
              <ButtonLink href={`/teams/manage/${team.id}`} tone="stage" icon="settings">
                {t("本队工作台", "Team workspace")}
              </ButtonLink>
            )}
          </div>
        </div>
      </header>
      <Wrap className={layout.pageBody}>
        {viewer?.membership && (
          <p className={styles.membership}>
            <Icon name="shield" size={18} />
            {viewer.membership.status === "active" ? t("你是本队现任队员", "You are a current player") : viewer.membership.status === "left" ? t("你曾是本队队员", "You are a former player") : t("你的成员关系已撤销", "Your membership was revoked")}
            {viewer.membership.joinedAt && t(` · ${formatDate(viewer.membership.joinedAt)} 入队`, ` · Joined ${formatDate(viewer.membership.joinedAt, locale)}`)}
            {viewer.membership.actions.leave && (
              <Link href="/teams/recruitment#my-team-memberships" className="text-link">
                {t("办理离队", "Leave team")}
              </Link>
            )}
          </p>
        )}
        <Section id="roster" title={t("队员", "Players")} count={detail.roster.length}>
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
            <EmptyState title={t(empty.roster.title, "No public player profiles yet")} icon="user" compact>
              {t(empty.roster.body, "Current players can edit their profile and choose to make it public.")}
            </EmptyState>
          )}
        </Section>
        <Section id="honors" title={t("荣誉", "Honors")} count={detail.honors.length} more={{ href: `/teams/honors?team=${team.id}`, label: t("荣誉墙", "Honor wall") }}>
          {detail.honors.length ? (
            <div className={layout.grid3}>
              {detail.honors.map((honor) => (
                <HonorTile key={honor.key} honor={honor} showTeam={false} />
              ))}
            </div>
          ) : (
            <EmptyState title={t(empty.honors.title, "No verified honors yet")} icon="trophy" compact>
              {t(empty.honors.body, "Current players can submit match honors; they appear after review.")}
            </EmptyState>
          )}
        </Section>
        {detail.recruitments.length > 0 && (
          <Section id="recruitment" title={t("选拔", "Tryouts")}>
            <div className={layout.grid2}>
              {detail.recruitments.map((call) => (
                <RecruitmentTile key={call.key} call={call} />
              ))}
            </div>
          </Section>
        )}
        {detail.positions.length > 0 && (
          <Section id="positions" title={t("位置与要求", "Positions & requirements")}>
            <div className={layout.grid2}>
              {detail.positions.map((position, index) => (
                <article key={`${position.name}-${index}`} className={`${layout.panel} ${styles.positionPanel}`}>
                  <h3>{position.name}</h3>
                  <dl className={styles.positionFacts}>
                    {position.duties && (
                      <div>
                        <dt>{t("职责", "Duties")}</dt>
                        <dd>{position.duties}</dd>
                      </div>
                    )}
                    {position.requirements && (
                      <div>
                        <dt>{t("要求", "Requirements")}</dt>
                        <dd>{position.requirements}</dd>
                      </div>
                    )}
                    {position.commitment && (
                      <div>
                        <dt>{t("投入", "Commitment")}</dt>
                        <dd>{position.commitment}</dd>
                      </div>
                    )}
                    {position.arrangement && (
                      <div>
                        <dt>{t("安排", "Schedule")}</dt>
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
          <Section id="events" title={t("相关活动", "Related events")}>
            <div className={styles.events}>
              {detail.events.slice(0, 6).map((event) => (
                <MatchCard key={event.key} event={event} />
              ))}
            </div>
          </Section>
        )}
        {detail.body != null && (
          <Section id="about" title={t("队伍介绍", "About the team")}>
            <RichText body={detail.body} />
          </Section>
        )}
        {detail.seasons.length > 0 && (
          <Section id="seasons" title={t("赛季档案", "Seasons")}>
            <ol className={styles.seasons}>
              {detail.seasons.map((season) => (
                <li key={season.id} id={`season-${season.id}`}>
                  <span className={styles.seasonDate}>{season.startAt ? formatDate(season.startAt, locale) : t("时间待补", "Date TBA")}</span>
                  <div>
                    <h3>{season.title}</h3>
                    {season.members.length > 0 ? (
                      <p>
                        {season.members.map((member) => (member.position ? t(`${member.displayName}（${member.position}）`, `${member.displayName} (${member.position})`) : member.displayName)).join(t("、", ", "))}
                      </p>
                    ) : (
                      <p className={styles.muted}>{t("本赛季阵容未公开。", "This season's lineup is not public.")}</p>
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
