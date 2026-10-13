import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
import { TeamHonorArchiveContents } from "@/components/TeamHonorArchives";
import { teamHonorQuery } from "@/components/TeamHonorNavigation";
import { ClubFrame } from "../../../../../_club/ClubPage";
import styles from "../../../../../_club/ClubPages.module.css";
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
    <ClubFrame className={styles.communityBody}>
      <section className="community-page">
        <nav className="signup-tools" aria-label="档案返回">
          <Link href={"/community/" + slug + "/showcase"}>← 社群风采</Link>
          <Link
            href={
              "/teams/honors?" +
              teamHonorQuery({ team: archive.team.id, game: game.id })
            }
          >
            代表队与荣誉
          </Link>
        </nav>
        <header className={styles.archiveHeading}>
          <p className={styles.kicker}>{game.title} / HONOR ARCHIVE</p>
          <h2>{archive.team.title + " · 荣誉档案"}</h2>
          <p>{archive.records.length} 条已批准荣誉，按赛事日期汇总。</p>
        </header>
        <TeamHonorArchiveContents archive={archive} user={user} />
      </section>
    </ClubFrame>
  );
}
