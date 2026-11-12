import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cms } from "@/lib/content";
import { ownStaffReceiptHeaders, publicStaffBatch } from "@/lib/staff-recruitment";
import { formatDate } from "@/lib/rules";
import { staffWindow } from "@/lib/staff-recruitment-model";
import { StaffApplication } from "@/components/StaffApplication";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { KeyValues, StatusPill } from "@/components/v2/ui";
import { deadlineText } from "@/components/v2/format";

export default async function Batch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await cms(),
    batchID = Number(id);
  if (!Number.isSafeInteger(batchID) || batchID <= 0) notFound();
  const batch = await publicStaffBatch(p, batchID).catch(() => null);
  const { user } = await p.auth({ headers: await headers() });
  const receipt = !batch ? (await ownStaffReceiptHeaders(p, user, batchID).catch(() => null))?.docs[0] : null;
  if (!batch && !receipt) notFound();
  const batchState = batch ? staffWindow(batch) : null;
  return (
    <TaskFrame
      eyebrow="STAFF · 执行部／宣传部"
      title={batch?.title ?? receipt!.batchTitle}
      description={batch ? batch.description || "本批次招收执行部及宣传部骨干，具体安排以批次说明为准。" : "批次已撤下，仅可查看回执"}
      back={{ href: "/join/staff", label: "骨干招新" }}
      steps={["阅读批次", "填写申请", "核对提交", "查看回执"]}
      aside={
        <>
          {batch && (
            <section aria-label="批次安排">
              <TaskNote title="批次安排">
                <p>
                  <StatusPill tone={batchState === "申请开放" ? "success" : "neutral"}>{batchState}</StatusPill>
                </p>
                <KeyValues
                  items={[
                    { label: "开放", value: formatDate(batch.startAt) },
                    { label: "截止", value: formatDate(batch.endAt) },
                    { label: "剩余", value: batchState === "申请开放" && batch.endAt ? deadlineText(batch.endAt) : null },
                  ]}
                />
                <p>开放期间可修改、撤回或重提；截止后保留本人回执。</p>
              </TaskNote>
            </section>
          )}
          <TaskNote
            title="其他参与方式"
            links={[
              { href: "/community", label: "查看游戏社群" },
              { href: "/community/apply", label: "申请组织社群" },
              { href: "/join/staff", label: "返回骨干批次与本人回执" },
            ]}
          >
            <p>日常交流与活动可从游戏社群开始。</p>
          </TaskNote>
        </>
      }
    >
      <div id="staff-application">
        <StaffApplication batch={batchID} />
      </div>
    </TaskFrame>
  );
}
