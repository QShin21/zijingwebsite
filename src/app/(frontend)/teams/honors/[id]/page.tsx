import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
import { honorError, honorReviewerOf } from "@/lib/team-honor-web";
import { TeamHonorRecordCard } from "@/components/TeamHonorRecord";
import { TeamHonorEditor } from "@/components/TeamHonorEditor";
import { PageHeading } from "@/components/PageHeading";
export const dynamic = "force-dynamic";
export default async function HonorRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
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
    <section className="community-page">
      <Link href="/teams/honors?view=mine">← 代表队与荣誉</Link>
      <PageHeading
        title={record.title}
        eyebrow="TEAM HONOR"
        description={
          (team?.title || "已归档代表队") +
          " · " +
          (game?.title || "已归档游戏社群")
        }
      />
      <p role="status">{(await searchParams).message || error}</p>
      <TeamHonorRecordCard
        record={record}
        reviewer={honorReviewerOf(user, record)}
        owner={user?.id === Number(record.author)}
        editable={editable}
      />
      {editable && (
        <TeamHonorEditor
          key={record.id + ":" + record.revision}
          record={record}
          memberships={memberships}
        />
      )}
    </section>
  );
}
