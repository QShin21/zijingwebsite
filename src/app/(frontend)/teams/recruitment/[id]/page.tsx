import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { TeamCoreApplicant } from "@/components/TeamCoreControls";
import { teamRecruitmentInfo, teamJoinReceipt } from "@/lib/team-core";
import { positiveID } from "@/lib/team-memberships";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { StatusPill } from "@/components/v2/ui";
import { teamLoginHref } from "../../auth-return";

export const dynamic = "force-dynamic";

export default async function Recruitment({ params }: { params: Promise<{ id: string }> }) {
  const id = positiveID((await params).id);
  if (!id) notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref(`/teams/recruitment/${id}`));
  const info = await teamRecruitmentInfo(p, user, id).catch(() => null);
  if (!info) notFound();
  return (
    <TaskFrame
      eyebrow="TRYOUTS · 代表队选拔"
      title={info.doc.title}
      description={info.form.intro || "填写游戏经历与训练安排，由本社群管理员人工选拔。"}
      back={{ href: "/teams/recruitment", label: "选拔中心" }}
      steps={["阅读要求", "填写申请", "核对提交", "人工选拔"]}
      aside={
        <>
          <TaskNote title="当前状态">
            <p>
              <StatusPill tone={info.readOnly ? "neutral" : "success"}>{String(info.state)}</StatusPill>
            </p>
            <p>可先保存草稿；提交后进入审核队列，结果与反馈显示在本人回执。</p>
          </TaskNote>
          <TaskNote title="资料用途" links={[{ href: "/teams/recruitment#my-team-applications", label: "我的入队申请" }, { href: "/privacy", label: "隐私说明" }]}>
            <p>申请资料仅供本人及当前有权限的管理者查看。录取不授予平台或社群任职，也不代替公开简介授权。</p>
          </TaskNote>
        </>
      }
    >
      <TeamCoreApplicant
        key={info.version}
        id={id}
        form={info.form}
        version={info.version}
        state={info.state}
        readOnly={info.readOnly}
        initial={teamJoinReceipt(info.own)}
      />
    </TaskFrame>
  );
}
