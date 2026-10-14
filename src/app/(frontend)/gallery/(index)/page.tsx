import {
  PublicList,
  type Query,
} from "@/components/activity-pages/PublicPages";
export const metadata = {
  title: "影像",
  alternates: { canonical: "/gallery" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  return <PublicList collection="albums" search={await searchParams} />;
}
