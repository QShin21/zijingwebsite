import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { canParticipate } from "@/lib/rules";
import { profileTeam } from "@/lib/team-profiles";
import { teamProfileID } from "@/lib/team-profiles-model";
import { TeamProfilesPanel } from "@/components/team-profiles/TeamProfilesPanel";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";

export const metadata = { title: "我的队内简介", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ teamID: string }> }) {
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
    <TaskFrame
      eyebrow="本人选择 · 队内展示"
      title={team.title}
      description="用公开昵称介绍自己，预览后确认是否在本队名单展示。"
      back={{ href: `/teams/${team.slug}`, label: "返回代表队" }}
      steps={["编辑简介", "预览核对", "确认展示"]}
      aside={
        <TaskNote title="展示由你决定" links={[{ href: `/teams/${team.slug}#roster`, label: "返回代表队页面" }, { href: "/privacy", label: "隐私说明" }]}>
          <ul>
            <li>只填写愿意公开的内容，无需真实姓名、学号或联系方式。</li>
            <li>取消展示后保存即可隐藏；离队后退出简介名单。</li>
            <li>头像保存时清除图片元数据。</li>
          </ul>
        </TaskNote>
      }
    >
      <TeamProfilesPanel teamID={teamID} startEditing />
    </TaskFrame>
  );
}
