import { notFound } from "next/navigation";
import { ActivitySignup } from "@/components/ActivitySignup";
import { SeatReceiptPanel } from "@/components/activity-pages/SeatReceiptPanel";
import type { SeatingKind } from "@/lib/activity-seating-model";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("活动报名", "Activity sign-up") };
}

export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!["events", "community-posts"].includes(kind) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
  const { t } = await getT();
  return (
    <TaskFrame
      eyebrow={t("SIGN UP · 活动报名", "SIGN UP")}
      title={t("活动报名与本人回执", "Sign-up and your receipt")}
      description={t("填写后核对提交，并在这里查看本人报名与选座回执。", "Fill in, review and submit, then see your sign-up and seat receipts here.")}
      back={{ href: "/events", label: t("日程", "Schedule") }}
      steps={[t("填写资料", "Fill in"), t("核对提交", "Review and submit"), t("查看回执", "View receipt")]}
      aside={
        <>
          <TaskNote title={t("报名须知", "Before you sign up")} links={[{ href: "/account?view=signups", label: t("我的全部报名", "All my sign-ups") }, { href: "/privacy", label: t("隐私说明", "Privacy notice") }]}>
            <ul>
              <li>{t("每个账号保留一份报名记录，提交后生成本人回执。", "Each account keeps one sign-up; submitting creates your receipt.")}</li>
              <li>{t("报名开放期间可按规则修改作答；截止后回执只读。", "While sign-up is open you can edit your answers as allowed; after the deadline the receipt is read-only.")}</li>
              <li>{t("答案仅供本人和有权限的活动管理者查看。", "Only you and authorized activity managers can see your answers.")}</li>
            </ul>
          </TaskNote>
          <TaskNote title={t("结果未确认？", "Result not confirmed?")}>
            <p>{t("网络中断时请先到「我的报名」核对，避免重复提交。", "If the connection dropped, check “My sign-ups” first to avoid submitting twice.")}</p>
          </TaskNote>
        </>
      }
    >
      <ActivitySignup kind={kind} id={Number(id)} />
      <SeatReceiptPanel kind={kind as SeatingKind} id={Number(id)} />
    </TaskFrame>
  );
}
