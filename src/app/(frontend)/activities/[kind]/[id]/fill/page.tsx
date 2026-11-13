import { notFound } from "next/navigation";
import { ActivitySignup } from "@/components/ActivitySignup";
import { SeatReceiptPanel } from "@/components/activity-pages/SeatReceiptPanel";
import type { SeatingKind } from "@/lib/activity-seating-model";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";

export const metadata = { title: "活动报名" };

export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!["events", "community-posts"].includes(kind) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
  return (
    <TaskFrame
      eyebrow="SIGN UP · 活动报名"
      title="活动报名与本人回执"
      description="填写后核对提交，并在这里查看本人报名与选座回执。"
      back={{ href: "/events", label: "日程" }}
      steps={["填写资料", "核对提交", "查看回执"]}
      aside={
        <>
          <TaskNote title="报名须知" links={[{ href: "/account?view=signups", label: "我的全部报名" }, { href: "/privacy", label: "隐私说明" }]}>
            <ul>
              <li>每个账号保留一份报名记录，提交后生成本人回执。</li>
              <li>报名开放期间可按规则修改作答；截止后回执只读。</li>
              <li>答案仅供本人和有权限的活动管理者查看。</li>
            </ul>
          </TaskNote>
          <TaskNote title="结果未确认？">
            <p>网络中断时请先到「我的报名」核对，避免重复提交。</p>
          </TaskNote>
        </>
      }
    >
      <ActivitySignup kind={kind} id={Number(id)} />
      <SeatReceiptPanel kind={kind as SeatingKind} id={Number(id)} />
    </TaskFrame>
  );
}
