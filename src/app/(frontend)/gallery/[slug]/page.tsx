import {
  PublicDetail,
  detailMetadata,
  type Query,
} from "@/components/activity-pages/PublicPages";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Query>;
};
export async function generateMetadata({ params }: Props) {
  return detailMetadata("albums", (await params).slug);
}
export default async function Page({ params, searchParams }: Props) {
  return (
    <PublicDetail
      collection="albums"
      slug={(await params).slug}
      search={await searchParams}
    />
  );
}
