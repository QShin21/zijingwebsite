import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { canParticipate, canReviewShowcase } from "@/lib/rules";
import { ShowcaseForm } from "@/components/ShowcaseForm";
import { CommunityPageHeader } from "@/components/community-pages/CommunityPages";
import { ClubFrame } from "../../../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

export default async function NewShowcase({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await bySlug("games", slug);
  if (!game) notFound();
  const { user } = await (await cms()).auth({ headers: await headers() });
  if (!canParticipate(user)) {
    redirect(
      `/login?returnTo=${encodeURIComponent(`/community/${slug}/showcase/new`)}`,
    );
  }
  const base = `/community/${slug}/showcase`;
  return (
    <ClubFrame className={`${styles.page} ${styles.body}`}>
      <CommunityPageHeader
        title="分享社群风采"
        description="记录共同经历，分享你有权发布的活动照片与视频。"
        action={
          <Link className="button light" href={base}>
            返回社群风采
          </Link>
        }
      />
      <div className={styles.contentWorkspace}>
        <ShowcaseForm
          game={game.id}
          slug={slug}
          manager={canReviewShowcase(user, game.id)}
        />
        <aside className={styles.publishAside}>
          <h2>记录{game.title}的共同经历</h2>
          <p>
            标题必填，文字、照片与视频按实际情况补充。提交后可在“我的投稿”查看记录与审核状态。
          </p>
          <Link href={`${base}?view=mine`}>查看我的投稿</Link>
        </aside>
      </div>
    </ClubFrame>
  );
}
