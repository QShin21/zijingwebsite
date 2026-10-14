import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Answers, Question } from "@/lib/signup-schema";
import { cms } from "@/lib/content";
import { canManageStaffRecruitment, formatDate } from "@/lib/rules";
import { readStaffApplications } from "@/lib/staff-recruitment";
import {
  canReviewStaffTransition,
  staffDepartments,
  staffStatusLabels,
} from "@/lib/staff-recruitment-model";
import { formatAnswer } from "@/lib/questionnaire-model";
import pageStyles from "@/components/activity-pages/ActivityPages.module.css";
import styles from "@/components/activity-pages/Workspace.module.css";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import { StaffBatchEditor } from "@/components/StaffBatchEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { Pagination } from "@/components/Content";
import { reviewStaffApplicationAction } from "./actions";
export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{
    batch?: string;
    department?: string;
    status?: string;
    page?: string;
    message?: string;
  }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!canManageStaffRecruitment(user)) notFound();
  const query = await searchParams,
    batches = await p.find({
      collection: "staff-batches",
      user,
      overrideAccess: false,
      depth: 0,
      limit: 50,
      sort: "-createdAt",
    });
  const id = Number(query.batch) || batches.docs[0]?.id;
  const filters = new URLSearchParams();
  for (const key of ["department", "status", "page"] as const)
    if (query[key]) filters.set(key, query[key]!);
  const data = id ? await readStaffApplications(p, user, id, filters) : null;
  const selectedBatch = batches.docs.find((batch) => batch.id === id);
  return (
    <div className={`${pageStyles.page} ${styles.workspace}`}>
      <nav className={pageStyles.breadcrumbs} aria-label="管理导航">
        <Link href="/account">个人中心</Link>
        <span aria-hidden="true">/</span>
        <span>骨干招新管理</span>
      </nav>
      <header className={pageStyles.hero}>
        <div>
          <h1>骨干招新管理</h1>
          <p>
            查看候选资料，记录选拔进度与反馈。批次说明、开放时间和申请题目在批次配置中维护。
          </p>
        </div>
        <Link className={pageStyles.textAction} href="/join/staff">
          查看招新入口
        </Link>
      </header>
      <nav className={pageStyles.tabs} aria-label="招新工作区">
        <a href="#staff-candidates">处理申请</a>
        <a href="#staff-batch-config">批次配置</a>
      </nav>
      {query.message && (
        <p className={styles.feedback} role="status">
          {query.message}
        </p>
      )}
      <section id="staff-candidates" className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <h2>候选申请</h2>
            <p>{selectedBatch?.title || "选择批次查看申请"}</p>
          </div>
          {data && <span>{data.result.totalDocs} 份符合条件的申请</span>}
        </header>
        <form method="get" className={styles.toolbar} aria-label="筛选骨干申请">
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
          <button className="button">筛选申请</button>
          <Link href={id ? `/staff/manage?batch=${id}` : "/staff/manage"}>
            清除筛选
          </Link>
        </form>
        <div className={styles.objectBar}>
          <p>
            管理范围：骨干招新，社长／副社长。本人反馈可供申请者查看，内部备注仅管理层可见。
          </p>
          {id && (
            <Link
              className="button light"
              href={
                "/api/staff/batches/" +
                id +
                "/application?mode=export&" +
                filters
              }
            >
              导出当前筛选答卷 CSV
            </Link>
          )}
        </div>
        {!data?.result.docs.length && (
          <div className={pageStyles.empty}>
            <h3>
              {batches.docs.length ? "暂无符合条件的申请" : "先建立本次招新"}
            </h3>
            <p>
              {batches.docs.length
                ? "可以调整申请状态、部门意向或所选批次。"
                : "配置批次说明、开放时间与申请问卷，发布后即可接收申请。"}
            </p>
            {!batches.docs.length && (
              <a className="button" href="#staff-batch-config">
                创建批次
              </a>
            )}
          </div>
        )}
        <div className={styles.records}>
          {data?.result.docs.map((row) => {
            const questions = row.questions as unknown as Question[],
              answers = row.answers as unknown as Answers;
            return (
              <article
                className={styles.reviewRecord}
                key={row.id}
                data-staff-application={row.id}
              >
                <header className={styles.reviewHeader}>
                  <div>
                    <p>{staffDepartments[row.department]}</p>
                    <h3>{row.memberName}</h3>
                  </div>
                  <div className={pageStyles.meta}>
                    <span className={pageStyles.status}>
                      {staffStatusLabels[row.status]}
                    </span>
                    <span>申请编号 {row.id}</span>
                    <time dateTime={row.createdAt}>
                      {formatDate(row.createdAt)}
                    </time>
                  </div>
                </header>
                <div className={styles.reviewLayout}>
                  <section className={styles.reviewContent}>
                    <h4>申请资料</h4>
                    <p className={styles.supportText}>
                      以下是本次申请提交的题目与答案。
                      <Link href={"/join/staff/batches/" + id}>
                        查看批次说明
                      </Link>
                    </p>
                    <dl className={styles.receipt}>
                      {questions
                        .filter((question) => question.type !== "description")
                        .map((question) => (
                          <div key={question.id}>
                            <dt>{question.label}</dt>
                            <dd>
                              {formatAnswer(answers[question.id], question) ||
                                "未填写"}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </section>
                  <section className={styles.reviewAction}>
                    <h4>记录处理结果</h4>
                    <p className={styles.supportText}>
                      录用记录不改变账号角色。后续任命通过独立授权流程处理。
                    </p>
                    <ActionForm
                      action={reviewStaffApplicationAction}
                      className="member-form"
                    >
                      <input type="hidden" name="batch" value={id} />
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        type="hidden"
                        name="revision"
                        value={row.updatedAt}
                      />
                      <label>
                        本人可见反馈
                        <textarea
                          name="feedback"
                          rows={4}
                          maxLength={1000}
                          defaultValue={row.feedback ?? ""}
                        />
                        <small>
                          退回补充或未录用时必填，请写明申请者接下来应做什么。
                        </small>
                      </label>
                      <label>
                        内部备注
                        <textarea
                          name="reviewNotes"
                          rows={4}
                          maxLength={3000}
                          defaultValue={row.reviewNotes ?? ""}
                        />
                        <small>仅管理层可见，不会展示在本人回执中。</small>
                      </label>
                      {["accepted", "rejected"].includes(row.status) && (
                        <p className={styles.scope}>
                          已有最终结果；补充资料或更改结果须填写本人可见反馈并先退回补充。
                        </p>
                      )}
                      <div className="reaction-bar">
                        {[
                          ["reviewing", "进入选拔"],
                          ["returned", "退回补充"],
                          ["accepted", "录用"],
                          ["rejected", "未录用"],
                        ].map(([value, label]) => (
                          <SubmitButton
                            key={value}
                            name="status"
                            value={value}
                            disabled={
                              !canReviewStaffTransition(row.status, value)
                            }
                          >
                            {label}
                          </SubmitButton>
                        ))}
                      </div>
                    </ActionForm>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
        {data && (
          <Pagination
            page={data.result.page ?? 1}
            total={data.result.totalPages}
            path="/staff/manage"
            query={{
              batch: String(id),
              ...(query.department ? { department: query.department } : {}),
              ...(query.status ? { status: query.status } : {}),
            }}
          />
        )}
      </section>
      <section id="staff-batch-config" className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <h2>批次配置</h2>
            <p>
              维护职责与条件说明、接收时间和申请问卷。所有公开入口指向同一个批次。
            </p>
          </div>
        </header>
        <StaffBatchEditor />
        {batches.docs.map((batch) => (
          <StaffBatchEditor key={batch.id} batch={batch} />
        ))}
      </section>
    </div>
  );
}
