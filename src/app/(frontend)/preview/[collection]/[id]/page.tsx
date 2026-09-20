import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { CollectionSlug } from "payload";
import { cms, type Content } from "@/lib/content";
import { Detail } from "@/components/Content";
import { hasRole } from "@/lib/rules";
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
  if (
    !hasRole(user, "admin", "publisher", "editor") &&
    (!hasRole(user, "leader") ||
      !["teams", "seasons", "honors"].includes(collection))
  )
    notFound();
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
      <div className="notice">鉴权草稿预览 · 不进入公开缓存</div>
      <Detail doc={doc as unknown as Content} collection={collection} />
    </>
  );
}
