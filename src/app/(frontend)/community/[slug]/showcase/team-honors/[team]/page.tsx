import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { teamHonorService } from "@/lib/team-honor-service";
import { TeamHonorArchiveContents } from "@/components/TeamHonorArchives";
import {
  teamHonorQuery,
  teamHonorSubmissionHref,
} from "@/components/TeamHonorNavigation";
import styles from "@/components/team-pages/TeamPages.module.css";
import { PageHero, StatusPill, Wrap, buttonClass } from "@/components/v2/ui";
import layout from "@/components/v2/layout.module.css";
export const dynamic = "force-dynamic";
export default async function TeamHonorArchive({
  params,
}: {
  params: Promise<{ slug: string; team: string }>;
}) {
  const { slug, team } = await params,
    game = await bySlug("games", slug);
  if (
    !game ||
    !/^\d+$/.test(team) ||
    !Number.isSafeInteger(Number(team)) ||
    Number(team) <= 0
  )
    notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const archive = (
    await teamHonorService.archives(p, {
      game: game.id,
      team: Number(team),
    })
  )[0];
  if (!archive) notFound();
  return (
    <>
      <PageHero
        tone="stage"
        eyebrow={`${game.title} · TROPHY ROOM`}
        title={archive.team.title + " · 荣誉档案"}
        description={`${archive.records.length} 条已批准荣誉，按赛事日期汇总。现任队员可提交荣誉，经审核后收录至本档案。`}
        back={{ href: "/community/" + slug + "/showcase", label: "社群风采" }}
        actions={
          <>
            {canParticipate(user) && (
              <Link className={buttonClass("accent")} href={teamHonorSubmissionHref({ team: archive.team.id, game: game.id })}>
                提交队伍荣誉
              </Link>
            )}
            <Link className={buttonClass("stage")} href={"/teams/honors?" + teamHonorQuery({ team: archive.team.id, game: game.id })}>
              代表队与荣誉
            </Link>
          </>
        }
        meta={<StatusPill tone="success">{archive.records.length} 条已批准荣誉</StatusPill>}
      />
      <Wrap className={layout.pageBody}>
        <div className={styles.workspace}>
          <TeamHonorArchiveContents archive={archive} user={user} />
        </div>
      </Wrap>
    </>
  );
}
