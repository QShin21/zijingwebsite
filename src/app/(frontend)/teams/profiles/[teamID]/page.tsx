import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { profileTeam } from "@/lib/team-profiles";
import { teamProfileID } from "@/lib/team-profiles-model";
import { TeamProfilesPanel } from "@/components/team-profiles/TeamProfilesPanel";
import { PageHeading } from "@/components/PageHeading";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";

export const metadata = {
  title: "我的队内简介",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ teamID: string }>;
}) {
  let teamID: number;
  try {
    teamID = teamProfileID((await params).teamID);
  } catch {
    notFound();
  }
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!canParticipate(user)) redirect("/login");
  const team = await profileTeam(p, teamID).catch(() => notFound());
  return (
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title={team.title}
        eyebrow="我的队内简介"
        description="用公开昵称介绍自己，预览后确认是否在本队名单展示。"
        parent={{ href: `/teams/${team.slug}`, label: "返回代表队" }}
      />
      <TeamProfilesPanel teamID={teamID} startEditing />
      <Link className="text-link" href={`/teams/${team.slug}#team-members`}>
        返回代表队页面
      </Link>
    </ClubFrame>
  );
}
