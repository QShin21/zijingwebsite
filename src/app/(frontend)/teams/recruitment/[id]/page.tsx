import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { TeamCoreApplicant } from "@/components/TeamCoreControls";
import { teamRecruitmentInfo, teamJoinReceipt } from "@/lib/team-core";
import { positiveID } from "@/lib/team-memberships";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { StatusPill } from "@/components/v2/ui";
import { getT } from "@/lib/i18n/server";
import { teamLoginHref } from "../../auth-return";
import { recruitmentStateLabel } from "../../labels";

export const dynamic = "force-dynamic";

export default async function Recruitment({ params }: { params: Promise<{ id: string }> }) {
  const id = positiveID((await params).id);
  if (!id) notFound();
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref(`/teams/recruitment/${id}`));
  const info = await teamRecruitmentInfo(p, user, id).catch(() => null);
  if (!info) notFound();
  const { t } = await getT();
  return (
    <TaskFrame
      eyebrow={t("TRYOUTS · 代表队选拔", "TRYOUTS · Team tryouts")}
      title={info.doc.title}
      description={info.form.intro || t("填写游戏经历与训练安排，由本社群管理员人工选拔。", "Describe your game experience and training availability; community admins select players manually.")}
      back={{ href: "/teams/recruitment", label: t("选拔中心", "Tryout center") }}
      steps={[t("阅读要求", "Read requirements"), t("填写申请", "Fill in"), t("核对提交", "Review & submit"), t("人工选拔", "Manual selection")]}
      aside={
        <>
          <TaskNote title={t("当前状态", "Status")}>
            <p>
              <StatusPill tone={info.readOnly ? "neutral" : "success"}>{recruitmentStateLabel(t, String(info.state))}</StatusPill>
            </p>
            <p>{t("可先保存草稿；提交后进入审核队列，结果与反馈显示在本人回执。", "You can save a draft first. Submitted applications enter the review queue; results and feedback appear on your receipt.")}</p>
          </TaskNote>
          <TaskNote title={t("资料用途", "How your data is used")} links={[{ href: "/teams/recruitment#my-team-applications", label: t("我的入队申请", "My team applications") }, { href: "/privacy", label: t("隐私说明", "Privacy") }]}>
            <p>{t("申请资料仅供本人及当前有权限的管理者查看。录取不授予平台或社群任职，也不代替公开简介授权。", "Applications are visible only to you and authorized managers. Acceptance grants no platform or community role and does not authorize a public profile.")}</p>
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
