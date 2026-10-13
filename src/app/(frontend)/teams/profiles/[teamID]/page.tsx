import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { profileTeam } from "@/lib/team-profiles";
import { teamProfileID } from "@/lib/team-profiles-model";
import { TeamProfilesPanel } from "@/components/team-profiles/TeamProfilesPanel";
import { PageHeading } from "@/components/PageHeading";
import { ClubFrame, ClubSteps } from "../../../_club/ClubPage";
import styles from "../../../_club/ClubPages.module.css";

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
    <ClubFrame className={styles.profileScope}>
      <PageHeading
        title={team.title}
        eyebrow="TEAM / PROFILE"
        description="我的队内简介"
        parent={{ href: `/teams/${team.slug}`, label: "返回代表队" }}
      />
      <ClubSteps
        label="队内简介编辑流程"
        steps={[
          {
            title: "填写公开资料",
            description: "使用公开昵称，介绍你的游戏角色。",
          },
          {
            title: "预览展示内容",
            description: "确认头像与简介，以及是否选择展示。",
          },
          {
            title: "保存或隐藏",
            description: "保存后生效；可取消展示并再次保存。",
          },
        ]}
      />
      <TeamProfilesPanel teamID={teamID} startEditing />
      <Link className="text-link" href={`/teams/${team.slug}#team-members`}>
        返回代表队页面
      </Link>
    </ClubFrame>
  );
}
