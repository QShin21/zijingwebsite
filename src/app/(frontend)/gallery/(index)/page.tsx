import { getFeed } from "@/lib/v2";
import { pageNumber, read, type Search } from "@/components/v2/data";
import { FeedView } from "@/components/v2/Feed";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("影像", "Gallery"), alternates: { canonical: "/gallery" } };
}

export default async function Gallery({ searchParams }: { searchParams: Search }) {
  const { t } = await getT();
  const page = pageNumber((await searchParams).page);
  const result = await read(getFeed, { kind: "albums", page, limit: 18 }, "/gallery");
  return (
    <FeedView
      title={t("影像", "Gallery")}
      description={t("社团活动与赛场瞬间的公开相册。", "Public albums of club events and match moments.")}
      kind="albums"
      result={result}
      signedIn
      basePath="/gallery"
    />
  );
}
