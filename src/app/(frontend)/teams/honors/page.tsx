import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms } from "@/lib/content";
import { TeamHonorsPanel } from "@/components/TeamHonorsPanel";
import { PageHeading } from "@/components/PageHeading";
import { pageNumber } from "@/components/CommunityPager";
import { teamHonorScopeID } from "@/components/TeamHonorNavigation";
import { ClubFrame } from "../../_club/ClubPage";
export const dynamic = "force-dynamic";
export default async function TeamHonors({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams,
    p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const team = query.team ? teamHonorScopeID(query.team) : undefined;
  const game = query.game ? teamHonorScopeID(query.game) : undefined;
  if (team === null || game === null) notFound();
  return (
    <ClubFrame>
      <section className="community-page">
        <PageHeading
          title="代表队与荣誉"
          eyebrow="OUR TEAMS"
          description="队员投稿，由对应社群管理员审核；批准后实时汇总成队伍档案。"
        />
        <p role="status">
          {typeof query.message === "string" ? query.message : ""}
        </p>
        <TeamHonorsPanel
          payload={p}
          user={user}
          view={
            query.view === "mine" || query.view === "review"
              ? query.view
              : "public"
          }
          page={pageNumber(
            typeof query.page === "string" ? query.page : undefined,
          )}
          team={team}
          game={game}
        />
      </section>
    </ClubFrame>
  );
}
