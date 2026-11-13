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
import { getT } from "@/lib/i18n/server";
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
  const { t, locale } = await getT();
  return (
    <>
      <PageHero
        tone="stage"
        eyebrow={`${game.title} · TROPHY ROOM`}
        title={archive.team.title + t(" · 荣誉档案", " · Honors archive")}
        description={t(`${archive.records.length} 条已批准荣誉，按赛事日期汇总。现任队员可提交荣誉，经审核后收录至本档案。`, `${archive.records.length} approved honors, grouped by event date. Current members can submit honors, which are added after review.`)}
        back={{ href: "/community/" + slug + "/showcase", label: t("社群风采", "Showcase") }}
        actions={
          <>
            {canParticipate(user) && (
              <Link className={buttonClass("accent")} href={teamHonorSubmissionHref({ team: archive.team.id, game: game.id })}>
                {t("提交队伍荣誉", "Submit team honor")}
              </Link>
            )}
            <Link className={buttonClass("stage")} href={"/teams/honors?" + teamHonorQuery({ team: archive.team.id, game: game.id })}>
              {t("代表队与荣誉", "Teams and honors")}
            </Link>
          </>
        }
        meta={<StatusPill tone="success">{t(`${archive.records.length} 条已批准荣誉`, `${archive.records.length} approved honors`)}</StatusPill>}
      />
      <Wrap className={layout.pageBody}>
        <div className={styles.workspace}>
          <TeamHonorArchiveContents archive={archive} user={user} locale={locale} />
        </div>
      </Wrap>
    </>
  );
}
