import styles from "./community-pages/CommunityPages.module.css";
import type { CommunityShowcase } from "@/payload-types";
import { formatDate } from "@/lib/rules";
import { CommunityVideo } from "./CommunityVideo";
import { SubmitButton } from "./SubmitButton";
import { ActionForm } from "./activity-pages/ActionForm";
import { reviewShowcaseResultAction } from "@/app/(frontend)/community/actions";
import Link from "next/link";
import { controlledVideoName } from "@/lib/showcase-videos";
const labels = {
  visible: "已发布",
  pending: "待审核",
  rejected: "已退回",
  hidden: "已隐藏",
};
export function ShowcaseCard({
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
    | "reviewNote"
  >;
  manager?: boolean;
  privateView?: boolean;
  promotionHref?: string;
  returnQuery?: string;
  href?: string;
  showTitle?: boolean;
}) {
  const review = (
    <ActionForm
      action={reviewShowcaseResultAction}
      className="member-form showcase-review"
    >
      <input type="hidden" name="id" value={post.id} />
      <input type="hidden" name="returnQuery" value={returnQuery} />
      <label>
        审核说明
        <input
          name="reviewNote"
          maxLength={500}
          defaultValue={post.reviewNote || ""}
        />
      </label>
      <div className="reaction-bar">
        {post.status !== "visible" && (
          <SubmitButton className="button" name="status" value="visible">
            批准发布
          </SubmitButton>
        )}
        {post.status === "pending" && (
          <SubmitButton className="button light" name="status" value="rejected">
            退回投稿
          </SubmitButton>
        )}
        {post.status === "visible" && (
          <SubmitButton className="button light" name="status" value="hidden">
            隐藏风采
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
            <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
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
                  alt={image.caption || `${post.title}，活动照片 ${index + 1}`}
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
      {href && <Link href={href}>查看完整记录</Link>}
      {privateView && post.reviewNote && (
        <div className={styles.note}>
          <h3>审核说明</h3>
          <p className="preserve">{post.reviewNote}</p>
        </div>
      )}
      {(promotionHref || manager) && (
        <section className={styles.showcaseManagement} aria-label="风采管理">
          {post.videoURL && !controlledVideoName(post.videoURL) && (
            <p className="field-hint">
              外链视频保留社群展示；升推前需由本社群风采管理员上传本站受控视频。
            </p>
          )}
          {promotionHref && (
            <Link className="button light" href={promotionHref}>
              申请社团级展示
            </Link>
          )}
          {manager &&
            (privateView ? (
              <section className={styles.decision}>
                <h3>处理这条投稿</h3>
                {review}
              </section>
            ) : (
              <details className={styles.disclosure}>
                <summary>管理这条风采</summary>
                <p>隐藏后将停止公开展示，已有投稿记录保留。</p>
                {review}
              </details>
            ))}
        </section>
      )}
    </article>
  );
}
