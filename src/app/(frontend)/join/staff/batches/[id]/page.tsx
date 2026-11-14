import { localizedBatchTexts } from "@/lib/content-translation/localize";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cms } from "@/lib/content";
import { ownStaffReceiptHeaders, publicStaffBatch } from "@/lib/staff-recruitment";
import { formatDate } from "@/lib/rules";
import { staffWindow } from "@/lib/staff-recruitment-model";
import { StaffApplication } from "@/components/StaffApplication";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { KeyValues, StatusPill } from "@/components/v2/ui";
import { deadlineText, formatDateTime as formatLocaleDateTime } from "@/components/v2/format";
import { getT } from "@/lib/i18n/server";
import { accountLabel } from "@/lib/i18n/labels-account";

export default async function Batch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getT();
  const date = (value?: string | null) => (locale === "en" ? formatLocaleDateTime(value, locale) : formatDate(value));
  const p = await cms(),
    batchID = Number(id);
  if (!Number.isSafeInteger(batchID) || batchID <= 0) notFound();
  const batch = await publicStaffBatch(p, batchID).catch(() => null);
  const { user } = await p.auth({ headers: await headers() });
  const receipt = !batch ? (await ownStaffReceiptHeaders(p, user, batchID).catch(() => null))?.docs[0] : null;
  if (!batch && !receipt) notFound();
  const batchState = batch ? staffWindow(batch) : null;
  // English: cached translation of the published batch title/notice (same row, same access).
  const shown = batch ? await localizedBatchTexts("staff-batches", batchID, { title: batch.title, description: batch.description || null }, locale) : null;
  return (
    <TaskFrame
      eyebrow={t("STAFF · 执行部／宣传部", "STAFF · Operations / Publicity")}
      title={shown?.title ?? receipt!.batchTitle}
      description={batch ? shown?.description || t("本批次招收执行部及宣传部骨干，具体安排以批次说明为准。", "This batch recruits Operations and Publicity staff; details follow the batch notes.") : t("批次已撤下，仅可查看回执", "This batch was taken down; only your receipt is available")}
      back={{ href: "/join/staff", label: t("骨干招新", "Staff recruitment") }}
      steps={[t("阅读批次", "Read batch"), t("填写申请", "Fill in"), t("核对提交", "Review & submit"), t("查看回执", "View receipt")]}
      aside={
        <>
          {batch && (
            <section aria-label={t("批次安排", "Batch schedule")}>
              <TaskNote title={t("批次安排", "Batch schedule")}>
                <p>
                  <StatusPill tone={batchState === "申请开放" ? "success" : "neutral"}>{batchState && accountLabel(batchState, locale)}</StatusPill>
                </p>
                <KeyValues
                  items={[
                    { label: t("开放", "Opens"), value: date(batch.startAt) },
                    { label: t("截止", "Closes"), value: date(batch.endAt) },
                    { label: t("剩余", "Remaining"), value: batchState === "申请开放" && batch.endAt ? deadlineText(batch.endAt, new Date(), locale) : null },
                  ]}
                />
                <p>{t("开放期间可修改、撤回或重提；截止后保留本人回执。", "While open you can edit, withdraw or resubmit; your receipt stays after the deadline.")}</p>
              </TaskNote>
            </section>
          )}
          <TaskNote
            title={t("其他参与方式", "Other ways to take part")}
            links={[
              { href: "/community", label: t("查看游戏社群", "Browse game communities") },
              { href: "/community/apply", label: t("申请组织社群", "Apply to start a community") },
              { href: "/join/staff", label: t("返回骨干批次与本人回执", "Back to batches and receipts") },
            ]}
          >
            <p>{t("日常交流与活动可从游戏社群开始。", "Day-to-day chat and events start in the game communities.")}</p>
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
