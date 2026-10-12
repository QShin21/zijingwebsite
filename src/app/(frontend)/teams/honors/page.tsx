import { headers } from "next/headers";
import { cms } from "@/lib/content";
import { TeamHonorsPanel } from "@/components/TeamHonorsPanel";
import { PageHeading } from "@/components/PageHeading";
import { pageNumber } from "@/components/CommunityPager";
export const dynamic = "force-dynamic";
export default async function TeamHonors({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string; message?: string }>;
}) {
  const query = await searchParams,
    p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  return (
    <section className="community-page">
      <PageHeading
        title="代表队与荣誉"
        eyebrow="OUR TEAMS"
        description="队员投稿，由对应社群管理员审核；批准后实时汇总成队伍档案。"
      />
      <p role="status">{query.message}</p>
      <TeamHonorsPanel
        payload={p}
        user={user}
        view={
          query.view === "mine" || query.view === "review"
            ? query.view
            : "public"
        }
        page={pageNumber(query.page)}
      />
    </section>
  );
}
