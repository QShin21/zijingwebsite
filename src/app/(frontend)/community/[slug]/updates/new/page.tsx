import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { managesGame } from "@/lib/rules";
import { CommunityActivityComposer } from "@/components/CommunityActivityComposer";
import { CommunityPageHeader } from "@/components/community-pages/CommunityPages";
import { ClubFrame } from "../../../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

export default async function NewCommunityUpdate({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  if (!managesGame(user, game.id)) notFound();

  return (
    <ClubFrame className={`${styles.page} ${styles.body}`}>
      <CommunityPageHeader
        title="发布活动与通知"
        description="发布范围为当前游戏社群。活动可配置报名问卷，通知用于发布安排与说明。"
        action={
          <Link className="button light" href={`/community/${slug}/updates`}>
            返回活动与通知
          </Link>
        }
      />
      <div className={styles.contentWorkspace}>
        <CommunityActivityComposer game={game.id} />
        <aside className={styles.publishAside}>
          <h2>发布到{game.title}</h2>
          <p>
            选择活动或通知，填写标题与内容。发布后，同学可在社群的活动与通知页面查看。
          </p>
          <Link href={`/community/${slug}/updates`}>查看已发布内容</Link>
        </aside>
      </div>
    </ClubFrame>
  );
}
