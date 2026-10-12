import type { CommunityShowcase } from "@/payload-types";
import { formatDate } from "@/lib/rules";
import { CommunityVideo } from "./CommunityVideo";
import { SubmitButton } from "./SubmitButton";
import { reviewShowcaseAction } from "@/app/(frontend)/community/actions";
import Link from "next/link";
import { controlledVideoName } from "@/lib/showcase-videos";
const labels = { visible: "已发布", pending: "待审核", rejected: "已退回", hidden: "已隐藏" };
export function ShowcaseCard({ post, manager = false, privateView = false, promotionHref }: { post: Pick<CommunityShowcase, "id" | "title" | "body" | "images" | "videoURL" | "status" | "authorName" | "createdAt" | "reviewNote">; manager?: boolean; privateView?: boolean; promotionHref?: string }) {
  return <article className="panel showcase-card" id={"showcase-" + post.id}><small>{post.authorName} · {formatDate(post.createdAt)}{privateView && ` · ${labels[post.status || "pending"]}`}</small>
    <h3>{post.title}</h3>{post.body && <p className="preserve">{post.body}</p>}
    <div className="showcase-images">{post.images?.map((image, index) => <figure key={image.id || index}><a href={image.source} target="_blank" rel="noopener noreferrer"><img src={image.source} alt={image.caption || `${post.title} · 活动照片 ${index + 1}`} loading="lazy" width={800} height={600} /></a>{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}</div>
    {post.videoURL && <CommunityVideo url={post.videoURL} />}
    {post.videoURL && !controlledVideoName(post.videoURL) && <p>外链视频保留社群展示；升推前需由本社群风采管理员上传本站受控视频。</p>}
    {promotionHref && <Link className="button light" href={promotionHref}>申请社团级展示</Link>}
    {privateView && post.reviewNote && <p>审核说明：{post.reviewNote}</p>}
    {manager && <form action={reviewShowcaseAction} className="showcase-review"><input type="hidden" name="id" value={post.id} />
      <label>审核说明<input name="reviewNote" maxLength={500} defaultValue={post.reviewNote || ""} /></label>
      <div className="reaction-bar">{post.status !== "visible" && <SubmitButton className="button" name="status" value="visible">批准发布</SubmitButton>}
        {post.status === "pending" && <SubmitButton className="button light" name="status" value="rejected">退回投稿</SubmitButton>}
        {post.status === "visible" && <SubmitButton className="moderate-button" name="status" value="hidden">隐藏风采</SubmitButton>}</div>
    </form>}
  </article>;
}
