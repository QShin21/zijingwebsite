import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, getEventDetail } from "@/lib/v2";
import { CommunityPostImageEditor } from "@/components/CommunityPostImageEditor";
import { CommunityArticleEditor } from "@/components/CommunityArticleEditor";
import { updateCommunityAudienceAction } from "../../../actions";
import { audiences, audienceLabels } from "@/lib/content-audience";
import { publicationBlocks } from "@/lib/publication-content";
import { publicationImages } from "@/lib/publication-images";
import { bySlug } from "@/lib/content";
import { canReviewPromotion, managesGame } from "@/lib/rules";
import { read, request, single, type Search } from "@/components/v2/data";
import { EventDetailView } from "@/components/v2/EventDetail";
import { ArticleView } from "@/components/v2/Feed";
import { Notice, buttonClass } from "@/components/v2/ui";
import layout from "@/components/v2/layout.module.css";
import { getT } from "@/lib/i18n/server";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";
import { audienceLabelsEn, keyedLabel } from "@/lib/i18n/labels-account";

/** Community event (A4 community) or community notice (A6) under the historic share path. */
export default async function Update({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Search }) {
  const { slug, id } = await params;
  const { t, locale } = await getT();
  if (!/^\d+$/.test(id)) notFound();
  const path = `/community/${slug}/updates/${id}`;
  const [game, { payload, user }, search] = await Promise.all([bySlug("games", slug), request(), searchParams]);
  if (!game) notFound();
  // Use the viewer's audience before resolving the detail and any editing controls.
  const post = await payload
    .findByID({
      collection: "community-posts",
      id: Number(id),
      overrideAccess: false,
      user,
      depth: 0,
      select: { game: true, category: true, audience: true, status: true, postImages: true, contentMode: true, contentBlocks: true, updatedAt: true },
    })
    .catch(() => null);
  if (!post || post.status !== "visible" || Number(post.game) !== game.id) notFound();
  const message = single(search.message);
  const notice = message ? <Notice>{localizeAccountMessage(message, locale)}</Notice> : undefined;
  const canEdit = managesGame(user, game.id);
  const images = publicationImages(post.postImages);
  const editor = canEdit ? (
    <>
    <form action={updateCommunityAudienceAction} className={layout.panel}>
      <input name="id" type="hidden" value={post.id} />
      <input name="game" type="hidden" value={game.id} />
      <label>
        {t("可见范围", "Visibility")}
        <select name="audience" defaultValue={post.audience ?? "campus"}>
          {audiences.map(value => <option key={value} value={value}>{keyedLabel(locale, value, audienceLabelsEn, audienceLabels[value])}</option>)}
        </select>
      </label>
      <button type="submit" className={buttonClass("ghost", "small")}>{t("保存范围", "Save visibility")}</button>
    </form>
    <section className={layout.panel} aria-label={post.contentMode === "article" ? t("编辑文章", "Edit article") : t("编辑配图", "Edit images")}>
      {post.contentMode === "article" ? <CommunityArticleEditor key={post.updatedAt} id={post.id} game={game.id} images={images} blocks={publicationBlocks(post.contentBlocks, images.length)} revision={post.updatedAt} />
        : <CommunityPostImageEditor key={post.id} id={post.id} game={game.id} images={images} revision={post.updatedAt} />}
    </section>
    </>
  ) : null;
  if (post.category === "event") {
    const detail = await read(getEventDetail, { source: "community", idOrSlug: id }, path);
    return <EventDetailView detail={detail} kind="community-posts" extra={editor} notice={notice} />;
  }
  const detail = await read(getArticle, { kind: "communityNotice", idOrSlug: id }, path);
  return (
    <ArticleView
      detail={detail}
      notice={notice}
      extra={
        <>
          {editor}
          {(canEdit || canReviewPromotion(user)) && (
            <section className={layout.panel}>
              <h2 className={layout.panelTitle}>{t("管理展示范围", "Manage display scope")}</h2>
              <p>{t("将当前通知申请展示到社团主页与公告。", "Request this notice be shown on the club front page and Notices.")}</p>
              <p style={{ marginTop: 12 }}>
                <Link className={buttonClass("ghost", "small")} href={`/community/promotions?source=community-posts&id=${post.id}`}>
                  {t("申请社团级展示", "Request club-level display")}
                </Link>
              </p>
            </section>
          )}
        </>
      }
    />
  );
}
