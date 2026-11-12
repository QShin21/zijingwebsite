import { getFeed } from "@/lib/v2";
import { pageNumber, read, type Search } from "@/components/v2/data";
import { FeedView } from "@/components/v2/Feed";

export const metadata = { title: "影像", alternates: { canonical: "/gallery" } };

export default async function Gallery({ searchParams }: { searchParams: Search }) {
  const page = pageNumber((await searchParams).page);
  const result = await read(getFeed, { kind: "albums", page, limit: 18 }, "/gallery");
  return (
    <FeedView
      title="影像"
      description="社团活动与赛场瞬间的公开相册。"
      kind="albums"
      result={result}
      signedIn
      basePath="/gallery"
    />
  );
}
