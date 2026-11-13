import { getFeed } from "@/lib/v2";
import { pageNumber, read, request, type Search } from "@/components/v2/data";
import { FeedView } from "@/components/v2/Feed";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("公告", "Notices"), alternates: { canonical: "/announcements" } };
}

export default async function Announcements({ searchParams }: { searchParams: Search }) {
  const { t } = await getT();
  const search = await searchParams;
  const { user } = await request();
  const page = pageNumber(search.page);
  const result = await read(getFeed, { kind: "announcements", page, limit: 18 }, "/announcements");
  return (
    <FeedView
      title={t("公告", "Notices")}
      description={
        user
          ? t("社团公告与各社群通知。", "Club notices and community announcements.")
          : t("社团公告与精选社群通知，确认后在这里发布。", "Club notices and featured community announcements are posted here once confirmed.")
      }
      kind="announcements"
      result={result}
      signedIn={Boolean(user)}
      basePath="/announcements"
    />
  );
}
