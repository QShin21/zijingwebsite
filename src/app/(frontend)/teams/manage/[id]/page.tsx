import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import {
  TeamCoreRecruitmentEditor,
  TeamCoreOperation,
  TeamCoreDecision,
  TeamCoreAnswers,
} from "@/components/TeamCoreControls";
import {
  canManageTeam,
  positiveID,
  isEstablishedTeam,
} from "@/lib/team-memberships";
import {
  defaultTeamForm,
  teamApplicationLabels,
  teamLifecycleLabels,
  teamRecruitmentLabels,
  teamRecruitmentState,
} from "@/lib/team-core";
import { normalizeSignup, type Answers } from "@/lib/signup-schema";
import { formatDate } from "@/lib/rules";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "@/components/team-pages/TeamPages.module.css";
import {
  TeamTaskNav,
  TeamSectionHeading,
  TeamEmpty,
} from "@/components/team-pages/TeamPageParts";
export const dynamic = "force-dynamic";
export default async function ManageTeam({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    edit?: string;
    create?: string;
    page?: string;
    status?: string;
    membersPage?: string;
    batchesPage?: string;
  }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const id = positiveID((await params).id);
  if (!id || !(await canManageTeam(p, user, id))) notFound();
  const query = await searchParams,
    page = teamPage(query.page);
  const team = await p.findByID({
    collection: "teams",
    id,
    user: null,
    overrideAccess: false,
    draft: false,
    depth: 0,
  });
  const established = await isEstablishedTeam(p, id);
  const batches = await p.find({
    collection: "team-recruitments",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.batchesPage),
    sort: "-createdAt",
    where: { team: { equals: id } },
  });
  const status = [
    "pending",
    "returned",
    "approved",
    "rejected",
    "withdrawn",
  ].includes(query.status ?? "")
    ? query.status!
    : "pending";
  const applications = await p.find({
    collection: "team-join-applications",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page,
    sort: "createdAt",
    where: { and: [{ team: { equals: id } }, { status: { equals: status } }] },
  });
  const members = await p.find({
    collection: "team-memberships",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.membersPage),
    sort: "-joinedAt",
    where: { team: { equals: id } },
  });
  const candidate = positiveID(query.edit)
    ? await p
        .findByID({
          collection: "team-recruitments",
          id: positiveID(query.edit)!,
          user,
          overrideAccess: false,
          depth: 0,
        })
        .catch(() => null)
    : null;
  const edit =
    candidate && positiveID(candidate.team) === id ? candidate : null;
  return (
    <ClubFrame className={styles.workspace}>
      <PageHeading
        title={team.title}
        eyebrow="队伍工作台"
        description="安排本队招新，处理入队申请，维护成员记录。"
        parent={{ href: "/teams/manage", label: "代表队工作台" }}
      />
      <div className={styles.summary}>
        <dl className={styles.summaryMeta}>
          <div>
            <dt>队伍状态</dt>
            <dd>
              <span className={styles.status} data-state={team.teamStatus}>
                {teamLifecycleLabels[team.teamStatus ?? "unestablished"]}
              </span>
            </dd>
          </div>
          <div>
            <dt>招新批次</dt>
            <dd>{batches.totalDocs}</dd>
          </div>
          <div>
            <dt>{teamApplicationLabels[status]}申请</dt>
            <dd>{applications.totalDocs}</dd>
          </div>
        </dl>
        <Link href={`/teams/${team.slug}`}>查看队伍档案</Link>
      </div>
      <TeamTaskNav
        label="本队管理"
        items={[
          { href: "#team-recruitments", label: "招新批次" },
          { href: "#team-applications", label: "入队审核" },
          { href: "#team-members", label: "成员记录" },
          {
            href: `/teams/honors?view=review&team=${id}`,
            label: "审核队伍荣誉",
          },
        ]}
      />
      <div className={styles.workspaceGrid}>
        <aside className={styles.taskAside}>
          <h2>本队管理范围</h2>
          <p>这里处理本队选拔与成员关系。公开简介由队员本人选择展示。</p>
          {team.establishmentApplication && (
            <details className={styles.lifecycle}>
              <summary>调整队伍状态</summary>
              <p>
                休整期间保留队伍档案；归档后停止新的入队申请。成员与任职记录分别保留。
              </p>
              {["active", "resting", "archived"]
                .filter((state) => state !== team.teamStatus)
                .map((state) => (
                  <TeamCoreOperation
                    key={state}
                    operation="lifecycle"
                    id={id}
                    revision={team.updatedAt}
                    status={state}
                    label={`设为${teamLifecycleLabels[state]}`}
                  />
                ))}
            </details>
          )}
          <p>入队录取建立成员关系，社群与平台管理任职仍按各自流程处理。</p>
        </aside>
        <div>
          <section
            id="team-recruitments"
            className={styles.section}
            aria-labelledby="team-recruitments-title"
          >
            <TeamSectionHeading id="team-recruitments-title" title="招新批次">
              {batches.totalDocs} 个批次
            </TeamSectionHeading>
            {established ? (
              <div className={styles.actions}>
                <Link
                  className="button"
                  href={`/teams/manage/${id}?create=1#team-recruitment-editor`}
                >
                  建立新招新批次
                </Link>
              </div>
            ) : (
              <div className={styles.note}>
                <p>
                  代表队尚未完成建队审核或已归档。请先由有权限的负责人处理建队或恢复状态。
                </p>
              </div>
            )}
            {established && (query.create || edit) && (
              <TeamCoreRecruitmentEditor
                key={edit?.updatedAt ?? "new"}
                teamID={id}
                defaultForm={defaultTeamForm}
                initial={
                  edit
                    ? {
                        id: edit.id,
                        title: edit.title,
                        status: edit.status,
                        revision: edit.updatedAt,
                        form: normalizeSignup(edit.signupForm),
                      }
                    : undefined
                }
              />
            )}
            <div className={styles.records}>
              {batches.docs.length ? (
                batches.docs.map((batch) => (
                  <article className={styles.record} key={batch.id}>
                    <div className={styles.recordHead}>
                      <h3>{batch.title}</h3>
                      <span className={styles.status} data-state={batch.status}>
                        {teamRecruitmentLabels[batch.status]}
                      </span>
                    </div>
                    <p className={styles.recordDate}>
                      {teamRecruitmentState(
                        batch,
                        normalizeSignup(batch.signupForm),
                      )}
                      ；更新于{" "}
                      <time dateTime={batch.updatedAt}>
                        {formatDate(batch.updatedAt)}
                      </time>
                    </p>
                    <div className={styles.actions}>
                      <Link href={`/teams/recruitment/${batch.id}`}>
                        查看申请入口
                      </Link>
                      {established && batch.status !== "archived" && (
                        <Link
                          href={`/teams/manage/${id}?edit=${batch.id}#team-recruitment-editor`}
                        >
                          编辑表单与窗口
                        </Link>
                      )}
                    </div>
                    {batch.status !== "archived" && (
                      <details className={styles.disclosure}>
                        <summary>结束或归档本批次</summary>
                        <p className={styles.muted}>
                          关闭后停止接收新申请；归档后保留本批次记录。
                        </p>
                        <div className={styles.actions}>
                          {batch.status === "open" && (
                            <TeamCoreOperation
                              operation="close-recruitment"
                              id={batch.id}
                              revision={batch.updatedAt}
                              status="closed"
                              label="关闭本轮招新"
                            />
                          )}
                          <TeamCoreOperation
                            operation="close-recruitment"
                            id={batch.id}
                            revision={batch.updatedAt}
                            status="archived"
                            label="归档本批次"
                          />
                        </div>
                      </details>
                    )}
                  </article>
                ))
              ) : (
                <TeamEmpty title="暂无招新批次">
                  {established
                    ? "建立一个批次，准备选拔题目与申请截止时间后开放招新。"
                    : "建队获批并恢复开放后，可在这里建立招新批次。"}
                </TeamEmpty>
              )}
            </div>
            <TeamCorePagination
              page={teamPage(query.batchesPage)}
              total={batches.totalPages}
              path={`/teams/manage/${id}`}
              parameter="batchesPage"
              query={query}
              label="招新批次"
            />
          </section>
          <section
            id="team-applications"
            className={styles.section}
            aria-labelledby="team-applications-title"
          >
            <TeamSectionHeading id="team-applications-title" title="入队审核">
              {applications.totalDocs} 份{teamApplicationLabels[status]}申请
            </TeamSectionHeading>
            <form
              className="filters"
              method="get"
              action={`/teams/manage/${id}#team-applications`}
            >
              <label>
                审核状态
                <select name="status" defaultValue={status}>
                  {[
                    "pending",
                    "returned",
                    "approved",
                    "rejected",
                    "withdrawn",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {teamApplicationLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button">筛选申请</button>
            </form>
            <div className={styles.records}>
              {applications.docs.length ? (
                applications.docs.map((doc) => (
                  <article className={styles.record} key={doc.id}>
                    <div className={styles.recordHead}>
                      <h3>{doc.title}</h3>
                      <span className={styles.status} data-state={doc.status}>
                        {teamApplicationLabels[doc.status]}
                      </span>
                    </div>
                    <p className={styles.recordDate}>
                      申请编号 {doc.id}，更新于{" "}
                      <time dateTime={doc.updatedAt}>
                        {formatDate(doc.updatedAt)}
                      </time>
                    </p>
                    <div
                      className={
                        doc.status === "pending" ? styles.reviewGrid : undefined
                      }
                    >
                      <div className={styles.reviewContent}>
                        <details
                          className={styles.disclosure}
                          open={doc.status === "pending"}
                        >
                          <summary>申请内容</summary>
                          <TeamCoreAnswers
                            form={normalizeSignup(doc.formSnapshot)}
                            answers={doc.answers as Answers}
                          />
                        </details>
                        {doc.reviewNote && (
                          <div className={styles.note}>
                            <h4>处理意见</h4>
                            <p className="preserve">{doc.reviewNote}</p>
                          </div>
                        )}
                      </div>
                      {doc.status === "pending" && (
                        <div className={styles.reviewAction}>
                          <h4>处理这份申请</h4>
                          <p>核对申请内容后，选择录取、退回补充或未通过。</p>
                          <TeamCoreDecision
                            kind="join"
                            id={doc.id}
                            revision={doc.updatedAt}
                          />
                        </div>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <TeamEmpty title="此状态暂无申请">
                  可以切换状态查看已处理记录。申请人保存的草稿不进入审核队列。
                </TeamEmpty>
              )}
            </div>
            <TeamCorePagination
              page={page}
              total={applications.totalPages}
              path={`/teams/manage/${id}`}
              parameter="page"
              query={{ ...query, status }}
              label="申请"
            />
          </section>
          <section
            id="team-members"
            className={styles.section}
            aria-labelledby="team-members-title"
          >
            <TeamSectionHeading id="team-members-title" title="成员记录">
              {members.totalDocs} 条记录，包含历史成员
            </TeamSectionHeading>
            <p className={styles.muted}>
              保留入队与离队经历。撤销成员关系后，仅现任队员可使用的功能随之停止。
            </p>
            <div className={styles.records}>
              {members.docs.length ? (
                members.docs.map((doc) => (
                  <article className={styles.record} key={doc.id}>
                    <div className={styles.recordHead}>
                      <h3>{doc.title}</h3>
                      <span className={styles.status} data-state={doc.status}>
                        {doc.status === "active"
                          ? "在队"
                          : doc.leftAt
                            ? "已离队"
                            : "已撤销"}
                      </span>
                    </div>
                    <dl className={styles.facts}>
                      <div>
                        <dt>记录编号</dt>
                        <dd>{doc.id}</dd>
                      </div>
                      <div>
                        <dt>入队时间</dt>
                        <dd>
                          <time dateTime={doc.joinedAt}>
                            {formatDate(doc.joinedAt)}
                          </time>
                        </dd>
                      </div>
                      {doc.leftAt && (
                        <div>
                          <dt>离队时间</dt>
                          <dd>
                            <time dateTime={doc.leftAt}>
                              {formatDate(doc.leftAt)}
                            </time>
                          </dd>
                        </div>
                      )}
                    </dl>
                    {doc.status === "active" && (
                      <details className={styles.disclosure}>
                        <summary>管理成员关系</summary>
                        <TeamCoreOperation
                          operation="revoke"
                          id={doc.id}
                          revision={doc.updatedAt}
                          label="撤销本队成员关系"
                          noteRequired
                        />
                      </details>
                    )}
                  </article>
                ))
              ) : (
                <TeamEmpty title="尚无入队成员记录">
                  入队申请获批后，成员记录会出现在这里。
                </TeamEmpty>
              )}
            </div>
            <TeamCorePagination
              page={teamPage(query.membersPage)}
              total={members.totalPages}
              path={`/teams/manage/${id}`}
              parameter="membersPage"
              query={{ ...query, status }}
              label="成员关系"
            />
          </section>
        </div>
      </div>
    </ClubFrame>
  );
}
