import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms, bySlug } from "@/lib/content";
import { communityContacts } from "@/lib/community-contacts";
import { CommunityJoinFlow } from "@/components/CommunityJoinFlow";
import { canParticipate } from "@/lib/rules";
import { ClubFrame, ClubSteps } from "../../../_club/ClubPage";
import styles from "../../../_club/ClubPages.module.css";
export default async function Join({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const game = await bySlug("games", slug);
  if (!game || !canParticipate(user)) notFound();
  const receipt =
    (
      await p.find({
        collection: "community-joins",
        overrideAccess: false,
        user,
        depth: 0,
        limit: 1,
        where: {
          and: [
            { game: { equals: game.id } },
            { member: { equals: user!.id } },
          ],
        },
        select: {
          status: true,
          updatedAt: true,
          note: true,
          confirmedAt: true,
        },
      })
    ).docs[0] ?? null;
  return (
    <ClubFrame className={styles.communityBody}>
      <ClubSteps
        label="人工进群流程"
        steps={[
          {
            title: "联系在任管理员",
            description: "查看微信名片，记录网站加入意向。",
          },
          {
            title: "在微信中加好友",
            description: "备注昵称和社群，等待管理员回复。",
          },
          {
            title: "人工拉群与确认",
            description: "由管理员操作并更新网站进度。",
          },
        ]}
      />
      <CommunityJoinFlow
        game={game.id}
        contacts={(await communityContacts(slug)) ?? []}
        receipt={receipt}
      />
    </ClubFrame>
  );
}
