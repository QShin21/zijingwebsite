import { getFeed } from "@/lib/v2";
import { pageNumber, read, request, type Search } from "@/components/v2/data";
import { FeedView } from "@/components/v2/Feed";

export const metadata = { title: "公告", alternates: { canonical: "/announcements" } };

export default async function Announcements({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const { user } = await request();
  const page = pageNumber(search.page);
  const result = await read(getFeed, { kind: "announcements", page, limit: 18 }, "/announcements");
  return (
    <FeedView
      title="公告"
      description={user ? "社团公告与各社群通知。" : "社团公告与精选社群通知，确认后在这里发布。"}
      kind="announcements"
      result={result}
      signedIn={Boolean(user)}
      basePath="/announcements"
    />
  );
}
