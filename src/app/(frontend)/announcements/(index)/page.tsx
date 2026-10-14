import {
  PublicList,
  type Query,
} from "@/components/activity-pages/PublicPages";
export const metadata = {
  title: "通知",
  alternates: { canonical: "/announcements" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  return <PublicList collection="announcements" search={await searchParams} />;
}
