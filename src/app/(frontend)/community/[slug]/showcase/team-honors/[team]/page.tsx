import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { bySlug, cms } from "@/lib/content";
import { teamHonorService } from "@/lib/team-honor-service";
import { TeamHonorArchiveContents } from "@/components/TeamHonorArchives";
import { PageHeading } from "@/components/PageHeading";
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
    <section className="community-page">
      <Link href={"/community/" + slug + "/showcase"}>← 社群风采</Link>
      <PageHeading
        title={archive.team.title + " · 荣誉档案"}
        eyebrow={game.title}
        description={archive.records.length + " 条已批准荣誉，按赛事日期汇总。"}
      />
      <TeamHonorArchiveContents archive={archive} user={user} />
    </section>
  );
}
