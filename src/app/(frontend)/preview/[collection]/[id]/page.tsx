import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CollectionSlug } from "payload";
import { cms, type Content } from "@/lib/content";
import { Detail } from "@/components/Content";
import { canSubmitClubContent } from "@/lib/rules";
import { buttonClass } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "内容预览",
  robots: { index: false, follow: false },
};
export default async function Preview({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = await params;
  if (
    ![
      "events",
      "announcements",
      "teams",
      "seasons",
      "honors",
      "news",
      "albums",
      "recruitment",
      "pages",
      "games",
    ].includes(collection)
  )
    notFound();
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!user) notFound();
  if (!canSubmitClubContent(user)) notFound();
  const doc = await p
    .findByID({
      collection: collection as CollectionSlug,
      id,
      depth: 0,
      draft: true,
      overrideAccess: false,
      user,
    })
    .catch(() => null);
  if (!doc) notFound();
  return (
    <>
      <aside className={work.previewBanner} aria-label="预览状态">
        <span className={work.previewBadge}>DRAFT</span>
        <p>
          <strong>草稿预览 · 仅当前授权人员可见。</strong>
          此页面用于核对内容，不代表已发布；公开列表继续读取已发布内容。
        </p>
        <a className={buttonClass("ghost", "small")} href={`/admin/collections/${collection}/${id}`}>
          返回内容编辑
        </a>
      </aside>
      <Detail doc={doc as unknown as Content} collection={collection} />
    </>
  );
}
