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
import { getT } from "@/lib/i18n/server";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";

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
  const { t, locale } = await getT();
  const message = (await searchParams).message;
  return (
    <>
      <PageHero
        tone="stage"
        hue={(game.id * 137) % 360}
        eyebrow={t(`${game.title} · 社群风采`, `${game.title} · Showcase`)}
        title={post.title}
        back={{ href: `/community/${slug}/showcase`, label: t("社群风采", "Showcase") }}
        meta={
          <>
            <StatusPill tone="success">{t("已发布的社群记录", "Published community record")}</StatusPill>
            {post.authorName && <StatusPill>{post.authorName}</StatusPill>}
          </>
        }
      />
      <Wrap width="workspace" className={layout.pageBody}>
      <p className={work.status} role="status">{message ? localizeAccountMessage(message, locale) : message}</p>
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
            <summary>{t("上传或替换本站视频", "Upload or replace site video")}</summary>
            <p>
              {t("保留同一风采及原社群。保存新视频后，已升推内容同步更新；已有文件保留。", "Keeps the same showcase and community. After saving, promoted content updates too; existing files are kept.")}
            </p>
            <ActionForm
              action={replaceShowcaseVideoResultAction}
              className="member-form"
            >
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="revision" value={post.updatedAt} />
              <label>
                {t("本站受控 MP4（10 MB 以内）", "Site-hosted MP4 (up to 10 MB)")}
                <input
                  name="video"
                  type="file"
                  accept="video/mp4,.mp4"
                  required
                />
              </label>
              <SubmitButton>{t("保存本站视频", "Save site video")}</SubmitButton>
            </ActionForm>
          </details>
        )}
      </div>
      </Wrap>
    </>
  );
}
