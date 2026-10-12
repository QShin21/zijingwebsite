import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Answers, Question } from "@/lib/signup-schema";
import { cms } from "@/lib/content";
import { canManageStaffRecruitment, formatDate } from "@/lib/rules";
import { readStaffApplications } from "@/lib/staff-recruitment";
import { canReviewStaffTransition, staffDepartments, staffStatusLabels } from "@/lib/staff-recruitment-model";
import { formatAnswer } from "@/lib/questionnaire-model";
import { PageHeading } from "@/components/PageHeading";
import { StaffBatchEditor } from "@/components/StaffBatchEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { Pagination } from "@/components/Content";
import { reviewStaffApplicationAction } from "./actions";

export default async function Manage({ searchParams }: { searchParams: Promise<{ batch?: string; department?: string; status?: string; page?: string; message?: string }> }) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() }); if (!canManageStaffRecruitment(user)) notFound();
  const query = await searchParams, batches = await p.find({ collection: "staff-batches", user, overrideAccess: false, depth: 0, limit: 50, sort: "-createdAt" });
  const id = Number(query.batch) || batches.docs[0]?.id;
  const filters = new URLSearchParams(); for (const key of ["department", "status", "page"] as const) if (query[key]) filters.set(key, query[key]!);
  const data = id ? await readStaffApplications(p, user, id, filters) : null;
  return <><PageHeading title="骨干招新管理工作台" eyebrow="EXECUTION / PUBLICITY" description="社长/副社长管理批次与候选资料。人工结果、内部备注及公开反馈分开，录用后任命仍须另行操作。" />
    <section className="member-shell"><p role="status">{query.message}</p><StaffBatchEditor />
      {batches.docs.map(batch => <StaffBatchEditor key={batch.id} batch={batch} />)}
      <h2>候选申请</h2><form method="get" className="member-form">
        <label>批次<select name="batch" defaultValue={id ?? ""}>{batches.docs.map(batch => <option key={batch.id} value={batch.id}>{batch.title}</option>)}</select></label>
        <label>部门意向<select name="department" defaultValue={query.department ?? ""}><option value="">全部</option>{Object.entries(staffDepartments).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>申请状态<select name="status" defaultValue={query.status ?? ""}><option value="">全部</option>{Object.entries(staffStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="button">筛选申请</button>
      </form>
      {id && <Link className="button light" href={"/api/staff/batches/" + id + "/application?mode=export&" + filters}>导出当前筛选答卷 CSV</Link>}
      {!data?.result.docs.length && <p>此批次和筛选条件下暂无申请。</p>}
      <div className="community-list">{data?.result.docs.map(row => {
        const questions = row.questions as unknown as Question[], answers = row.answers as unknown as Answers;
        return <article className="panel" key={row.id} data-staff-application={row.id}><h3>{row.memberName} · {staffDepartments[row.department]} · {staffStatusLabels[row.status]}</h3>
          <p>编号 {row.id} · {formatDate(row.createdAt)} · <Link href={"/join/staff/batches/" + id}>查看批次说明</Link></p>
          <dl className="account-details">{questions.filter(question => question.type !== "description").map(question => <div key={question.id}><dt>{question.label}</dt><dd>{formatAnswer(answers[question.id], question) || "未填写"}</dd></div>)}</dl>
          <form action={reviewStaffApplicationAction} className="member-form">
            <input type="hidden" name="batch" value={id} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="revision" value={row.updatedAt} />
            <label>本人可见反馈（退回/未录用必填）<textarea name="feedback" rows={3} maxLength={1000} defaultValue={row.feedback ?? ""} /></label>
            <label>内部备注（仅管理层可见）<textarea name="reviewNotes" rows={3} maxLength={3000} defaultValue={row.reviewNotes ?? ""} /></label>
            {["accepted", "rejected"].includes(row.status) && <p>已有最终结果；补充资料或更改结果须填写本人可见反馈并先退回补充。</p>}
            <div className="reaction-bar">{[["reviewing", "进入选拔"], ["returned", "退回补充"], ["accepted", "录用"], ["rejected", "未录用"]] .map(([value, label]) =>
              <SubmitButton key={value} name="status" value={value} disabled={!canReviewStaffTransition(row.status, value)}>{label}</SubmitButton>)}</div>
          </form>
        </article>;
      })}</div>{data && <Pagination page={data.result.page ?? 1} total={data.result.totalPages} path="/staff/manage" query={{ batch: String(id), ...(query.department ? { department: query.department } : {}), ...(query.status ? { status: query.status } : {}) }} />}
    </section></>;
}
