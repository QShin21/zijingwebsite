import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { canHandleCommunityJoins } from "@/lib/rules";
import { cms, bySlug } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { CommunityJoin } from "@/components/CommunityJoin";
import { CommunityNav } from "@/components/CommunityNav";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "../../_club/ClubPages.module.css";
export default async function CommunityLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: ReactNode;
}) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  return (
    <>
      <ClubFrame className={styles.communityHeading}>
        <PageHeading
          title={game.title}
          eyebrow="GAME COMMUNITY / ZIJING"
          description={game.summary || "查看社群活动、通知与精彩记录。"}
          parent={{ href: "/community", label: "游戏社群" }}
          action={<CommunityJoin slug={slug} />}
        />
        <CommunityNav
          slug={slug}
          manageJoins={canHandleCommunityJoins(user, game.id)}
        />
      </ClubFrame>
      {children}
    </>
  );
}
