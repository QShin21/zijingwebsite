import {
  PublicList,
  type Query,
} from "@/components/activity-pages/PublicPages";
export const metadata = { title: "活动", alternates: { canonical: "/events" } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  return <PublicList collection="events" search={await searchParams} />;
}
