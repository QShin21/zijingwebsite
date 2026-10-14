import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
import { honorError, honorReviewerOf } from "@/lib/team-honor-web";
import { TeamHonorRecordCard } from "@/components/TeamHonorRecord";
import { TeamHonorEditor } from "@/components/TeamHonorEditor";
import { PageHeading } from "@/components/PageHeading";
import { pageNumber } from "@/components/CommunityPager";
import {
  teamHonorQuery,
  teamHonorScopeID,
} from "@/components/TeamHonorNavigation";
import styles from "@/components/team-pages/TeamPages.module.css";
import { ClubFrame } from "../../../_club/ClubPage";
export const dynamic = "force-dynamic";
export default async function HonorRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)
    notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const record = await p
    .findByID({
      collection: "team-honor-records",
      id: Number(id),
      user,
      overrideAccess: false,
      depth: 0,
    })
    .catch(() => null);
  if (!record) notFound();
  const query = await searchParams;
  const scopeTeam = query.team ? teamHonorScopeID(query.team) : undefined;
  const scopeGame = query.game ? teamHonorScopeID(query.game) : undefined;
  if (scopeTeam === null || scopeGame === null) notFound();
  const owner = user?.id === Number(record.author);
  const reviewer = honorReviewerOf(user, record);
  const returnQuery = teamHonorQuery({
    view: !owner && reviewer ? "review" : "mine",
    page: pageNumber(typeof query.page === "string" ? query.page : undefined),
    team: scopeTeam,
    game: scopeGame,
  });
  let memberships: Awaited<ReturnType<typeof teamHonorService.availableTeams>> =
      [],
    error = "";
  if (user?.id === Number(record.author))
    try {
      memberships = await teamHonorService.availableTeams(p, user);
    } catch (cause) {
      error = honorError(cause);
    }
  const editable = memberships.some(
    (membership) =>
      membership.id === record.membershipRef &&
      membership.team === Number(record.team),
  );
  const [team, game] = await Promise.all([
    p
      .findByID({
        collection: "teams",
        id: Number(record.team),
        user: null,
        overrideAccess: false,
        depth: 0,
        draft: false,
        select: { title: true },
      })
      .catch(() => null),
    p
      .findByID({
        collection: "games",
        id: Number(record.game),
        user: null,
        overrideAccess: false,
        depth: 0,
        draft: false,
        select: { title: true },
      })
      .catch(() => null),
  ]);
  return (
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title={record.title}
        eyebrow={!owner && reviewer ? "荣誉材料审核" : "本人荣誉回执"}
        parent={{
          href: "/teams/honors?" + returnQuery,
          label: !owner && reviewer ? "审核本社群荣誉" : "我的荣誉记录",
        }}
        description={
          (team?.title || "已归档代表队") +
          " · " +
          (game?.title || "已归档游戏社群")
        }
      />
      <p role="status">
        {typeof query.message === "string" ? query.message || error : error}
      </p>
      {editable && (
        <div className={styles.actions}>
          <Link href="#honor-editor">修改荣誉内容与材料</Link>
        </div>
      )}
      <TeamHonorRecordCard
        record={record}
        headingLevel="h2"
        reviewer={reviewer}
        owner={owner}
        editable={editable}
        returnQuery={returnQuery}
      />
      {editable && (
        <TeamHonorEditor
          key={record.id + ":" + record.revision}
          record={record}
          memberships={memberships}
          returnQuery={returnQuery}
        />
      )}
    </ClubFrame>
  );
}
