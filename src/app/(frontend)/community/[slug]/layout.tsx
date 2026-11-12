import type { ReactNode } from "react";
import Link from "next/link";
import { getCommunityHeader } from "@/lib/v2";
import { read } from "@/components/v2/data";
import { CommunityJoin } from "@/components/CommunityJoin";
import { CommunityNav } from "@/components/CommunityNav";
import { CommunityGameIcon } from "@/components/CommunityGameIcon";
import { DemoPill } from "@/components/v2/ui";
import { hueStyle } from "@/components/v2/format";
import styles from "@/components/v2/community.module.css";

/**
 * Community hue band shared by every community section page. Uses the lightweight
 * V2 header projection (card + viewer): no body, contacts or activity lists.
 */
export default async function CommunityLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  const { card, viewer } = await read(getCommunityHeader, { slug }, `/community/${slug}`, { redirects: true });
  const { community, counts } = card;
  return (
    <>
      <header className={styles.band} style={hueStyle(community.hue)}>
        <div className={styles.bandInner}>
          <nav className={styles.crumbs} aria-label="所属社群">
            <Link href="/community">游戏社群</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/community/${community.slug}`}>{community.title}</Link>
          </nav>
          <div className={styles.identity}>
            <span className={styles.crest} aria-hidden="true">
              <CommunityGameIcon image={card.cover} />
            </span>
            <div className={styles.titleBlock}>
              <p className={styles.stats}>
                <span>游戏社群</span>
                {card.viewer?.isOfficer && <span>我在任管理员</span>}
                {counts.upcomingEvents > 0 && <span>即将活动 {counts.upcomingEvents}</span>}
                {counts.teams > 0 && <span>队伍 {counts.teams}</span>}
                {counts.showcase > 0 && <span>风采 {counts.showcase}</span>}
                {viewer.canReviewShowcase && viewer.pendingShowcase ? <span>待审风采 {viewer.pendingShowcase}</span> : null}
                {card.demo && <DemoPill />}
              </p>
              {/* Each section page renders its own h1; the band title is presentational. */}
              <p className={styles.bandTitle}>{community.title}</p>
              {card.summary && <p>{card.summary}</p>}
            </div>
            <div className={styles.actions}>
              <CommunityJoin slug={community.slug} />
              {card.viewer?.canManageIcon && <Link className={styles.editIcon} href={`/community/${community.slug}/appearance`}>修改社群图标</Link>}
            </div>
          </div>
          <CommunityNav slug={community.slug} />
        </div>
      </header>
      {children}
    </>
  );
}
