import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms } from "@/lib/content";
import { TeamHonorsPanel } from "@/components/TeamHonorsPanel";
import { PageHeading } from "@/components/PageHeading";
import { pageNumber } from "@/components/CommunityPager";
import { teamHonorScopeID } from "@/components/TeamHonorNavigation";
import styles from "@/components/team-pages/TeamPages.module.css";
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
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title={
          query.view === "review"
            ? "队伍荣誉审核"
            : query.view === "mine"
              ? "我的荣誉投稿"
              : "代表队与荣誉"
        }
        eyebrow={
          query.view === "review"
            ? "审核工作台"
            : query.view === "mine"
              ? "队员投稿"
              : "代表队档案"
        }
        description={
          query.view === "review"
            ? "核验赛事与成果材料，为投稿人留下明确的处理意见。"
            : query.view === "mine"
              ? "记录队伍的比赛与成绩，继续草稿，查看审核进度。"
              : "从队伍与赛事出发，读一份持续积累的社团成果档案。"
        }
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
    </ClubFrame>
  );
}
