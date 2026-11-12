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
import { reviewStaffApplicationAction } from "./actions";

export const metadata = { title: "骨干招新管理", robots: { index: false, follow: false } };

type Props = {
  searchParams: Promise<{ batch?: string; department?: string; status?: string; page?: string; message?: string }>;
};

const statusTone: Record<string, Tone> = { submitted: "info", reviewing: "live", returned: "warning", accepted: "success", rejected: "danger", withdrawn: "neutral", draft: "neutral" };
const decisions = [
  ["reviewing", "进入选拔"],
  ["returned", "退回补充"],
  ["accepted", "录用"],
  ["rejected", "未录用"],
] as const;

export default async function Manage({ searchParams }: Props) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  // Resolve access before streaming a fallback so denied requests retain 404.
  if (!canManageStaffRecruitment(user)) notFound();
  return (
    <TaskFrame
      wide
      eyebrow="STAFF · 骨干招新管理"
      title="骨干招新管理"
      description="查看候选资料，记录选拔进度与反馈。批次说明、开放时间和申请题目在批次配置中维护。"
      back={{ href: "/account", label: "我的" }}
      actions={
        <ButtonLink href="/join/staff" tone="stage">
          查看招新入口
        </ButtonLink>
      }
      aside={
        <>
          <TaskNote title="管理范围">
            <p>骨干招新由社长／副社长处理。本人反馈可供申请者查看，内部备注仅管理层可见。</p>
            <p>录用记录不改变账号角色，后续任命通过独立授权流程处理。</p>
          </TaskNote>
          <TaskNote title="工作区" links={[{ href: "#staff-candidates", label: "处理申请" }, { href: "#staff-batch-config", label: "批次配置" }]}>
            <p>导出只在点击时生成，筛选和浏览不会预取私人答卷。</p>
          </TaskNote>
        </>
      }
    >
      <Suspense
        fallback={
          <div className={work.records} aria-busy="true">
            <p role="status">正在读取候选申请，请稍候…</p>
          </div>
        }
      >
        <ManageWorkspace p={p} user={user} searchParams={searchParams} />
      </Suspense>
    </TaskFrame>
  );
}

async function ManageWorkspace({ p, user, searchParams }: Props & { p: Awaited<ReturnType<typeof cms>>; user: User | null }) {
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
          {query.message}
        </p>
      )}
      <ul className={work.stats} aria-label="招新概况">
        <li data-hot={total > 0 || undefined}>
          <strong>{total}</strong>
          <span>符合条件的申请</span>
        </li>
        <li>
          <strong>{batches.totalDocs}</strong>
          <span>招新批次</span>
        </li>
      </ul>

      <Section id="staff-candidates" title="候选申请" description={selectedBatch?.title || "选择批次查看申请"}>
        <form method="get" className={work.filter} aria-label="筛选骨干申请">
          <label>
            批次
            <select name="batch" defaultValue={id ?? ""}>
              {batches.docs.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            部门意向
            <select name="department" defaultValue={query.department ?? ""}>
              <option value="">全部</option>
              {Object.entries(staffDepartments).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            申请状态
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">全部</option>
              {Object.entries(staffStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={buttonClass("primary", "small")}>筛选申请</button>
          <Link className={work.chipLink} href={id ? `/staff/manage?batch=${id}` : "/staff/manage"}>
            清除筛选
          </Link>
          {id && (
            <a className={buttonClass("ghost", "small")} href={"/api/staff/batches/" + id + "/application?mode=export&" + filters}>
              导出当前筛选答卷 CSV
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
                      <p className={work.meta}>{staffDepartments[row.department]}</p>
                      <h3>{row.memberName}</h3>
                    </div>
                    <p className={work.meta}>
                      <StatusPill tone={statusTone[row.status] ?? "neutral"}>{staffStatusLabels[row.status]}</StatusPill>
                      <span>申请编号 {row.id}</span>
                      <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
                    </p>
                  </header>
                  <div className={work.split}>
                    <section className={work.submission} aria-label={`${row.memberName} 的申请资料`}>
                      <h4>申请资料</h4>
                      <KeyValues
                        items={questions
                          .filter((question) => question.type !== "description")
                          .map((question) => ({ label: question.label, value: formatAnswer(answers[question.id], question) || "未填写" }))}
                      />
                      <Link className={work.chipLink} href={"/join/staff/batches/" + id}>
                        查看批次说明
                      </Link>
                    </section>
                    <section className={work.decision} aria-label={`处理 ${row.memberName} 的申请`}>
                      <h4>记录处理结果</h4>
                      <ActionForm action={reviewStaffApplicationAction} className="member-form">
                        <input type="hidden" name="batch" value={id} />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="revision" value={row.updatedAt} />
                        <label>
                          本人可见反馈
                          <textarea name="feedback" rows={4} maxLength={1000} defaultValue={row.feedback ?? ""} />
                          <small>退回补充或未录用时必填，请写明申请者接下来应做什么。</small>
                        </label>
                        <label>
                          内部备注
                          <textarea name="reviewNotes" rows={4} maxLength={3000} defaultValue={row.reviewNotes ?? ""} />
                          <small>仅管理层可见，不会展示在本人回执中。</small>
                        </label>
                        {["accepted", "rejected"].includes(row.status) && <p>已有最终结果；补充资料或更改结果须填写本人可见反馈并先退回补充。</p>}
                        <div className={work.actions}>
                          {decisions.map(([value, label]) => (
                            <SubmitButton key={value} name="status" value={value} disabled={!canReviewStaffTransition(row.status, value)}>
                              {label}
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
              title={batches.docs.length ? "暂无符合条件的申请" : "先建立本次招新"}
              icon="inbox"
              compact
              actions={
                !batches.docs.length ? (
                  <a className={buttonClass("primary", "small")} href="#staff-batch-config">
                    创建批次
                  </a>
                ) : undefined
              }
            >
              {batches.docs.length ? "可以调整申请状态、部门意向或所选批次。" : "配置批次说明、开放时间与申请问卷，发布后即可接收申请。"}
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

      <Section id="staff-batch-config" title="批次配置" description="维护职责与条件说明、接收时间和申请问卷。所有公开入口指向同一个批次。">
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
