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
import { ClubFrame } from "../../../../../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";
import { PageHeading } from "@/components/PageHeading";
import { TeamTaskNav } from "@/components/team-pages/TeamPageParts";
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
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title={archive.team.title + " · 荣誉档案"}
        eyebrow={game.title}
        description={`${archive.records.length} 条已批准荣誉，按赛事日期汇总。现任队员可提交荣誉，经审核后收录至本档案。`}
        parent={{ href: "/community/" + slug + "/showcase", label: "社群风采" }}
        action={
          canParticipate(user) && (
            <Link
              className="button"
              href={teamHonorSubmissionHref({
                team: archive.team.id,
                game: game.id,
              })}
            >
              提交队伍荣誉
            </Link>
          )
        }
      />
      <TeamTaskNav
        label="档案导航"
        items={[
          { href: "/community/" + slug + "/showcase", label: "返回社群风采" },
          {
            href:
              "/teams/honors?" +
              teamHonorQuery({ team: archive.team.id, game: game.id }),
            label: "代表队与荣誉",
          },
        ]}
      />
      <TeamHonorArchiveContents archive={archive} user={user} />
    </ClubFrame>
  );
}
