import styles from "./community-pages/CommunityPages.module.css";
import type { CommunityShowcase } from "@/payload-types";
import { formatDate } from "@/lib/rules";
import { CommunityVideo } from "./CommunityVideo";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { reviewShowcaseResultAction } from "@/app/(frontend)/community/actions";
import Link from "next/link";
import { controlledVideoName } from "@/lib/showcase-videos";
import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/components/v2/format";
import type { Translate } from "@/lib/i18n/locale";
const labelsFor = (t: Translate) => ({
  visible: t("已发布", "Published"),
  pending: t("待审核", "Pending review"),
  rejected: t("已退回", "Returned"),
  hidden: t("已隐藏", "Hidden"),
});
export async function ShowcaseCard({
  post,
  manager = false,
  privateView = false,
  promotionHref,
  returnQuery = "",
  href,
  showTitle = true,
}: {
  post: Pick<
    CommunityShowcase,
    | "id"
    | "title"
    | "body"
    | "images"
    | "videoURL"
    | "status"
    | "authorName"
    | "createdAt"
    | "updatedAt"
    | "reviewNote"
  >;
  manager?: boolean;
  privateView?: boolean;
  promotionHref?: string;
  returnQuery?: string;
  href?: string;
  showTitle?: boolean;
}) {
  const { t, locale } = await getT();
  const labels = labelsFor(t);
  const review = (
    <ActionForm
      action={reviewShowcaseResultAction}
      className="member-form showcase-review"
    >
      <input type="hidden" name="id" value={post.id} />
      <input type="hidden" name="revision" value={post.updatedAt} />
      <input type="hidden" name="returnQuery" value={returnQuery} />
      <label>
        {t("审核说明", "Review note")}
        <input
          name="reviewNote"
          maxLength={500}
          defaultValue={post.reviewNote || ""}
        />
      </label>
      <div className="reaction-bar">
        {post.status !== "visible" && (
          <SubmitButton className="button" name="status" value="visible">
            {t("批准发布", "Approve")}
          </SubmitButton>
        )}
        {post.status === "pending" && (
          <SubmitButton className="button light" name="status" value="rejected">
            {t("退回投稿", "Return submission")}
          </SubmitButton>
        )}
        {post.status === "visible" && (
          <SubmitButton className="button light" name="status" value="hidden">
            {t("隐藏风采", "Hide showcase")}
          </SubmitButton>
        )}
      </div>
    </ActionForm>
  );
  return (
    <article
      className={`showcase-card ${styles.showcase}`}
      id={"showcase-" + post.id}
    >
      <header className={styles.showcaseHeader}>
        <div>
          <small>
            {post.authorName}{" "}
            <time dateTime={post.createdAt}>{locale === "en" ? formatDateTime(post.createdAt, locale) : formatDate(post.createdAt)}</time>
          </small>
          {showTitle && (
            <h2>{href ? <Link href={href}>{post.title}</Link> : post.title}</h2>
          )}
        </div>
        {privateView && (
          <span className={styles.status} data-state={post.status ?? "pending"}>
            {labels[post.status || "pending"]}
          </span>
        )}
      </header>
      {post.body && <p className={styles.showcaseText}>{post.body}</p>}
      {Boolean(post.images?.length) && (
        <div className={styles.gallery}>
          {post.images?.map((image, index) => (
            <figure key={image.id || index}>
              <a href={image.source} target="_blank" rel="noopener noreferrer">
                <img
                  src={image.source}
                  alt={image.caption || t(`${post.title}，活动照片 ${index + 1}`, `${post.title}, photo ${index + 1}`)}
                  loading="lazy"
                  width={800}
                  height={600}
                />
              </a>
              {image.caption && <figcaption>{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {post.videoURL && <CommunityVideo url={post.videoURL} />}
      {href && <Link href={href}>{t("查看完整记录", "View full record")}</Link>}
      {privateView && post.reviewNote && (
        <div className={styles.note}>
          <h3>{t("审核说明", "Review note")}</h3>
          <p className="preserve">{post.reviewNote}</p>
        </div>
      )}
      {(promotionHref || manager) && (
        <section className={styles.showcaseManagement} aria-label={t("风采管理", "Showcase management")}>
          {post.videoURL && !controlledVideoName(post.videoURL) && (
            <p className="field-hint">
              {t("外链视频保留社群展示；升推前需由本社群风采管理员上传本站受控视频。", "External videos stay in the community display. Before promotion, a showcase admin must upload a site-hosted video.")}
            </p>
          )}
          {promotionHref && (
            <Link className="button light" href={promotionHref}>
              {t("申请社团级展示", "Request club-level display")}
            </Link>
          )}
          {manager &&
            (privateView ? (
              <section className={styles.decision}>
                <h3>{t("处理这条投稿", "Handle this submission")}</h3>
                {review}
              </section>
            ) : (
              <details className={styles.disclosure}>
                <summary>{t("管理这条风采", "Manage this showcase")}</summary>
                <p>{t("隐藏后将停止公开展示，已有投稿记录保留。", "Hiding stops public display; the submission record is kept.")}</p>
                {review}
              </details>
            ))}
        </section>
      )}
    </article>
  );
}
