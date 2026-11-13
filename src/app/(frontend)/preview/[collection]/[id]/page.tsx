import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CollectionSlug } from "payload";
import { cms, type Content } from "@/lib/content";
import { Detail } from "@/components/Content";
import { canSubmitClubContent } from "@/lib/rules";
import { buttonClass } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
import { getT } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("内容预览", "Content preview"), robots: { index: false, follow: false } };
}
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
  const { t } = await getT();
  return (
    <>
      <aside className={work.previewBanner} aria-label={t("预览状态", "Preview status")}>
        <span className={work.previewBadge}>DRAFT</span>
        <p>
          <strong>{t("草稿预览 · 仅当前授权人员可见。", "Draft preview · visible to authorized staff only.")}</strong>
          {t(
            "此页面用于核对内容，不代表已发布；公开列表继续读取已发布内容。",
            "This page is for checking content and is not published; public lists still show published content.",
          )}
        </p>
        <a className={buttonClass("ghost", "small")} href={`/admin/collections/${collection}/${id}`}>
          {t("返回内容编辑", "Back to editor")}
        </a>
      </aside>
      <Detail doc={doc as unknown as Content} collection={collection} />
    </>
  );
}
