import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { User } from "@/payload-types";
import type { Answers, Question } from "@/lib/signup-schema";
import { cms } from "@/lib/content";
import { canManageStaffRecruitment, formatDate } from "@/lib/rules";
import { readStaffApplications } from "@/lib/staff-recruitment";
import { canReviewStaffTransition, staffDepartments, staffStatusLabels } from "@/lib/staff-recruitment-model";
import { formatAnswer } from "@/lib/questionnaire-model";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import { StaffBatchEditor } from "@/components/StaffBatchEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { ButtonLink, EmptyState, KeyValues, Pager, Section, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";
import { getT } from "@/lib/i18n/server";
import { localizeMessage } from "@/lib/i18n/messages";
import { formatDateTime, type Locale } from "@/lib/i18n/locale";
import { reviewStaffApplicationAction } from "./actions";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("骨干招新管理", "Staff recruitment management"), robots: { index: false, follow: false } };
}

type Props = {
  searchParams: Promise<{ batch?: string; department?: string; status?: string; page?: string; message?: string }>;
};

const statusTone: Record<string, Tone> = { submitted: "info", reviewing: "live", returned: "warning", accepted: "success", rejected: "danger", withdrawn: "neutral", draft: "neutral" };
const decisions = [
  ["reviewing", { zh: "进入选拔", en: "Move to tryout" }],
  ["returned", { zh: "退回补充", en: "Return for more info" }],
  ["accepted", { zh: "录用", en: "Accept" }],
  ["rejected", { zh: "未录用", en: "Decline" }],
] as const;
const departmentsEn: Record<string, string> = { execution: "Operations", publicity: "Publicity", both: "Either operations or publicity" };
const statusEn: Record<string, string> = { submitted: "Submitted", reviewing: "In tryout", returned: "Needs more info", accepted: "Accepted", rejected: "Declined", withdrawn: "Withdrawn" };
const localDate = (value: string | null | undefined, locale: Locale) => (locale === "en" ? formatDateTime(value, "en") || "TBA" : formatDate(value));

export default async function Manage({ searchParams }: Props) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  // Resolve access before streaming a fallback so denied requests retain 404.
  if (!canManageStaffRecruitment(user)) notFound();
  const { t } = await getT();
  return (
    <TaskFrame
      wide
      eyebrow={t("STAFF · 骨干招新管理", "STAFF · Recruitment management")}
      title={t("骨干招新管理", "Staff recruitment management")}
      description={t("查看候选资料，记录选拔进度与反馈。批次说明、开放时间和申请题目在批次配置中维护。", "Review candidates and record tryout progress and feedback. Batch notes, open dates and application questions are maintained in batch settings.")}
      back={{ href: "/account", label: t("我的", "Me") }}
      actions={
        <ButtonLink href="/join/staff" tone="stage">
          {t("查看招新入口", "View recruitment page")}
        </ButtonLink>
      }
      aside={
        <>
          <TaskNote title={t("管理范围", "Scope")}>
            <p>{t("骨干招新由社长／副社长处理。本人反馈可供申请者查看，内部备注仅管理层可见。", "Staff recruitment is handled by the president and vice presidents. Applicants can see feedback; internal notes are visible to management only.")}</p>
            <p>{t("普通成员录用后自动获得骨干身份；其他身份保持现有角色。", "Regular members become staff once accepted; other accounts keep their current role.")}</p>
          </TaskNote>
          <TaskNote title={t("工作区", "Workspace")} links={[{ href: "#staff-candidates", label: t("处理申请", "Review applications") }, { href: "#staff-batch-config", label: t("批次配置", "Batch settings") }]}>
            <p>{t("导出只在点击时生成，筛选和浏览不会预取私人答卷。", "Exports are generated only when clicked; filtering and browsing never prefetch private responses.")}</p>
          </TaskNote>
        </>
      }
    >
      <Suspense
        fallback={
          <div className={work.records} aria-busy="true">
            <p role="status">{t("正在读取候选申请，请稍候…", "Loading applications…")}</p>
          </div>
        }
      >
        <ManageWorkspace p={p} user={user} searchParams={searchParams} />
      </Suspense>
    </TaskFrame>
  );
}

async function ManageWorkspace({ p, user, searchParams }: Props & { p: Awaited<ReturnType<typeof cms>>; user: User | null }) {
  const { t, locale } = await getT();
  const query = await searchParams,
    batches = await p.find({ collection: "staff-batches", user, overrideAccess: false, depth: 0, limit: 50, sort: "-createdAt" });
  const id = Number(query.batch) || batches.docs[0]?.id;
  const filters = new URLSearchParams();
  for (const key of ["department", "status", "page"] as const) if (query[key]) filters.set(key, query[key]!);
  const data = id ? await readStaffApplications(p, user, id, filters) : null;
  const selectedBatch = batches.docs.find((batch) => batch.id === id);
  const total = data?.result.totalDocs ?? 0;
  return (
    <div className={work.flow}>
      {query.message && (
        <p className={work.status} role="status">
          {localizeMessage(query.message, locale)}
        </p>
      )}
      <ul className={work.stats} aria-label={t("招新概况", "Recruitment overview")}>
        <li data-hot={total > 0 || undefined}>
          <strong>{total}</strong>
          <span>{t("符合条件的申请", "Matching applications")}</span>
        </li>
        <li>
          <strong>{batches.totalDocs}</strong>
          <span>{t("招新批次", "Recruitment batches")}</span>
        </li>
      </ul>

      <Section id="staff-candidates" title={t("候选申请", "Applications")} description={selectedBatch?.title || t("选择批次查看申请", "Choose a batch to view applications")}>
        <form method="get" className={work.filter} aria-label={t("筛选骨干申请", "Filter staff applications")}>
          <label>
            {t("批次", "Batch")}
            <select name="batch" defaultValue={id ?? ""}>
              {batches.docs.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("部门意向", "Department")}
            <select name="department" defaultValue={query.department ?? ""}>
              <option value="">{t("全部", "All")}</option>
              {Object.entries(staffDepartments).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label, departmentsEn[value])}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("申请状态", "Status")}
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">{t("全部", "All")}</option>
              {Object.entries(staffStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label, statusEn[value])}
                </option>
              ))}
            </select>
          </label>
          <button className={buttonClass("primary", "small")}>{t("筛选申请", "Filter")}</button>
          <Link className={work.chipLink} href={id ? `/staff/manage?batch=${id}` : "/staff/manage"}>
            {t("清除筛选", "Clear filters")}
          </Link>
          {id && (
            <a className={buttonClass("ghost", "small")} href={"/api/staff/batches/" + id + "/application?mode=export&" + filters}>
              {t("导出当前筛选答卷 CSV", "Export filtered responses (CSV)")}
            </a>
          )}
        </form>

        <div className={work.records}>
          {data?.result.docs.length ? (
            data.result.docs.map((row) => {
              const questions = row.questions as unknown as Question[],
                answers = row.answers as unknown as Answers;
              return (
                <article className={work.record} key={row.id} data-staff-application={row.id} data-state={row.status}>
                  <header className={work.recordHead}>
                    <div>
                      <p className={work.meta}>{t(staffDepartments[row.department], departmentsEn[row.department])}</p>
                      <h3>{row.memberName}</h3>
                    </div>
                    <p className={work.meta}>
                      <StatusPill tone={statusTone[row.status] ?? "neutral"}>{t(staffStatusLabels[row.status], statusEn[row.status])}</StatusPill>
                      <span>{t(`申请编号 ${row.id}`, `Application #${row.id}`)}</span>
                      <time dateTime={row.createdAt}>{localDate(row.createdAt, locale)}</time>
                    </p>
                  </header>
                  <div className={work.split}>
                    <section className={work.submission} aria-label={t(`${row.memberName} 的申请资料`, `Application from ${row.memberName}`)}>
                      <h4>{t("申请资料", "Application")}</h4>
                      <KeyValues
                        items={questions
                          .filter((question) => question.type !== "description")
                          .map((question) => ({ label: question.label, value: formatAnswer(answers[question.id], question) || t("未填写", "Not answered") }))}
                      />
                      <Link className={work.chipLink} href={"/join/staff/batches/" + id}>
                        {t("查看批次说明", "View batch details")}
                      </Link>
                    </section>
                    <section className={work.decision} aria-label={t(`处理 ${row.memberName} 的申请`, `Review application from ${row.memberName}`)}>
                      <h4>{t("记录处理结果", "Record decision")}</h4>
                      <ActionForm action={reviewStaffApplicationAction} className="member-form">
                        <input type="hidden" name="batch" value={id} />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="revision" value={row.updatedAt} />
                        <label>
                          {t("本人可见反馈", "Feedback to applicant")}
                          <textarea name="feedback" rows={4} maxLength={1000} defaultValue={row.feedback ?? ""} />
                          <small>{t("退回补充或未录用时必填，请写明申请者接下来应做什么。", "Required when returning or declining; tell the applicant what to do next.")}</small>
                        </label>
                        <label>
                          {t("内部备注", "Internal notes")}
                          <textarea name="reviewNotes" rows={4} maxLength={3000} defaultValue={row.reviewNotes ?? ""} />
                          <small>{t("仅管理层可见，不会展示在本人回执中。", "Visible to management only; never shown on the applicant's receipt.")}</small>
                        </label>
                        {["accepted", "rejected"].includes(row.status) && <p>{t("已有最终结果；补充资料或更改结果须填写本人可见反馈并先退回补充。", "A final decision exists. To request more info or change it, add applicant feedback and return the application first.")}</p>}
                        <div className={work.actions}>
                          {decisions.map(([value, label]) => (
                            <SubmitButton key={value} name="status" value={value} disabled={!canReviewStaffTransition(row.status, value)}>
                              {t(label.zh, label.en)}
                            </SubmitButton>
                          ))}
                        </div>
                      </ActionForm>
                    </section>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              title={batches.docs.length ? t("暂无符合条件的申请", "No matching applications") : t("先建立本次招新", "Create a recruitment batch first")}
              icon="inbox"
              compact
              actions={
                !batches.docs.length ? (
                  <a className={buttonClass("primary", "small")} href="#staff-batch-config">
                    {t("创建批次", "Create batch")}
                  </a>
                ) : undefined
              }
            >
              {batches.docs.length ? t("可以调整申请状态、部门意向或所选批次。", "Try a different status, department or batch.") : t("配置批次说明、开放时间与申请问卷，发布后即可接收申请。", "Set up batch details, open dates and the application questionnaire; applications open once published.")}
            </EmptyState>
          )}
        </div>
        {data && (
          <Pager
            page={data.result.page ?? 1}
            totalPages={data.result.totalPages}
            path="/staff/manage"
            query={{ batch: String(id), ...(query.department ? { department: query.department } : {}), ...(query.status ? { status: query.status } : {}) }}
          />
        )}
      </Section>

      <Section id="staff-batch-config" title={t("批次配置", "Batch settings")} description={t("维护职责与条件说明、接收时间和申请问卷。所有公开入口指向同一个批次。", "Maintain role and eligibility notes, open dates and the application questionnaire. All public entries point to the same batch.")}>
        <div className={work.records}>
          <StaffBatchEditor />
          {batches.docs.map((batch) => (
            <StaffBatchEditor key={batch.id} batch={batch} />
          ))}
        </div>
      </Section>
    </div>
  );
}
