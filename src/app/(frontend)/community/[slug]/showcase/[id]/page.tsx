import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms, bySlug } from "@/lib/content";
import {
  canReviewPromotion,
  canReviewShowcase,
  managesGame,
  relationID,
} from "@/lib/rules";
import { ShowcaseCard } from "@/components/ShowcaseCard";
import { SubmitButton } from "@/components/SubmitButton";
import { replaceShowcaseVideoAction } from "../../../actions";
import styles from "@/components/activity-pages/ActivityPages.module.css";

export default async function ShowcaseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { slug, id } = await params,
    game = await bySlug("games", slug);
  if (
    !game ||
    !/^\d+$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  )
    notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const post = await p
    .findByID({
      collection: "community-showcase",
      id: Number(id),
      user: null,
      overrideAccess: false,
      depth: 0,
      select: {
        title: true,
        body: true,
        game: true,
        status: true,
        authorName: true,
        createdAt: true,
        updatedAt: true,
        images: true,
        videoURL: true,
      },
    })
    .catch(() => null);
  if (
    !post ||
    post.status !== "visible" ||
    Number(relationID(post.game)) !== game.id
  )
    notFound();
  return (
    <section
      className={`community-page ${styles.page} ${styles.community} ${styles.detail}`}
    >
      <Link href={"/community/" + slug + "/showcase"}>← 社群风采</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{game.title} / MOMENTS</p>
          <h2>{post.title}</h2>
          <p>来自社群的风采记录。</p>
        </div>
      </header>
      <p role="status">{(await searchParams).message}</p>
      <ShowcaseCard
        post={post}
        manager={canReviewShowcase(user, game.id)}
        promotionHref={
          managesGame(user, game.id) || canReviewPromotion(user)
            ? "/community/promotions?source=community-showcase&id=" + post.id
            : undefined
        }
      />
      {canReviewShowcase(user, game.id) && (
        <details className="panel">
          <summary>上传或替换本站视频</summary>
          <p>
            保留同一风采及原社群。保存新视频会撤下社团级展示，需重新申请复审；已有文件保留。
          </p>
          <form action={replaceShowcaseVideoAction} className="member-form">
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="revision" value={post.updatedAt} />
            <label>
              本站受控 MP4（10 MB 以内）
              <input
                name="video"
                type="file"
                accept="video/mp4,.mp4"
                required
              />
            </label>
            <SubmitButton>保存本站视频</SubmitButton>
          </form>
        </details>
      )}
    </section>
  );
}
