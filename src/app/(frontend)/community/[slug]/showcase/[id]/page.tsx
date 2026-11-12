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
import { replaceShowcaseVideoResultAction } from "../../../actions";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import styles from "@/components/community-pages/CommunityPages.module.css";
import { PageHero, StatusPill, Wrap } from "@/components/v2/ui";
import layout from "@/components/v2/layout.module.css";
import work from "@/components/v2/work.module.css";

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
  const manager = canReviewShowcase(user, game.id);
  return (
    <>
      <PageHero
        tone="stage"
        hue={(game.id * 137) % 360}
        eyebrow={`${game.title} · 社群风采`}
        title={post.title}
        back={{ href: `/community/${slug}/showcase`, label: "社群风采" }}
        meta={
          <>
            <StatusPill tone="success">已发布的社群记录</StatusPill>
            {post.authorName && <StatusPill>{post.authorName}</StatusPill>}
          </>
        }
      />
      <Wrap width="reading" className={layout.pageBody}>
      <p className={work.status} role="status">{(await searchParams).message}</p>
      <div className={`${styles.article} ${work.flow}`}>
        <ShowcaseCard
          post={post}
          showTitle={false}
          manager={manager}
          promotionHref={
            managesGame(user, game.id) || canReviewPromotion(user)
              ? "/community/promotions?source=community-showcase&id=" + post.id
              : undefined
          }
        />
        {manager && (
          <details className={work.disclosure}>
            <summary>上传或替换本站视频</summary>
            <p>
              保留同一风采及原社群。保存新视频会撤下社团级展示，需重新申请复审；已有文件保留。
            </p>
            <ActionForm
              action={replaceShowcaseVideoResultAction}
              className="member-form"
            >
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
            </ActionForm>
          </details>
        )}
      </div>
      </Wrap>
    </>
  );
}
