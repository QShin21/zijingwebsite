import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { profileTeam } from "@/lib/team-profiles";
import { teamProfileID } from "@/lib/team-profiles-model";
import { TeamProfilesPanel } from "@/components/team-profiles/TeamProfilesPanel";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { getT } from "@/lib/i18n/server";
import { teamLoginHref } from "../../auth-return";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("我的队内简介", "My team profile"), robots: { index: false, follow: false } };
}

export default async function Page({ params }: { params: Promise<{ teamID: string }> }) {
  let teamID: number;
  try {
    teamID = teamProfileID((await params).teamID);
  } catch {
    notFound();
  }
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!canParticipate(user)) redirect(teamLoginHref(`/teams/profiles/${teamID}`));
  const team = await profileTeam(p, teamID).catch(() => notFound());
  const { t } = await getT();
  return (
    <TaskFrame
      eyebrow={t("本人选择 · 队内展示", "Your choice · Team roster")}
      title={team.title}
      description={t("用公开昵称介绍自己，预览后确认是否在本队名单展示。", "Introduce yourself with your public nickname, preview it, then choose whether to appear on the team roster.")}
      back={{ href: `/teams/${team.slug}`, label: t("返回代表队", "Back to team") }}
      steps={[t("编辑简介", "Edit profile"), t("预览核对", "Preview"), t("确认展示", "Confirm display")]}
      aside={
        <TaskNote title={t("展示由你决定", "You decide what is shown")} links={[{ href: `/teams/${team.slug}#roster`, label: t("返回代表队页面", "Back to team page") }, { href: "/privacy", label: t("隐私说明", "Privacy") }]}>
          <ul>
            <li>{t("只填写愿意公开的内容，无需真实姓名、学号或联系方式。", "Share only what you want public; no real name, student ID or contact details needed.")}</li>
            <li>{t("取消展示后保存即可隐藏；离队后退出简介名单。", "Turn off display and save to hide your profile; leaving the team removes you from the roster.")}</li>
            <li>{t("头像保存时清除图片元数据。", "Image metadata is removed when your avatar is saved.")}</li>
          </ul>
        </TaskNote>
      }
    >
      <TeamProfilesPanel teamID={teamID} startEditing />
    </TaskFrame>
  );
}
