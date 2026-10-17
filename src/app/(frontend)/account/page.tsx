import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Where } from "payload";
import { PageHeading } from "@/components/PageHeading";
import { Pagination } from "@/components/Content";
import { LogoutButton } from "@/components/account-pages/AuthForms";
import styles from "@/components/account-pages/AccountPages.module.css";
import { cms } from "@/lib/content";
import {
  canPublish,
  canManageStaffRecruitment,
  canReviewPromotion,
  canSubmitClubContent,
  canParticipate,
  communityIDs,
  hasCommunityOffice,
  formatDate,
  relationID,
} from "@/lib/rules";
import { applicationLabels } from "@/lib/community-status";
import { staffStatusLabels } from "@/lib/staff-recruitment-model";
import { teamApplicationLabels } from "@/lib/team-core";

export const metadata = {
  title: "我的紫荆",
  robots: { index: false, follow: false },
};
type AccountRecord = {
  key: string;
  title: string;
  category: string;
  status: string;
  updatedAt: string;
  href: string;
  next: string;
  tone?: string;
};
function RecordList({
  rows,
  attention = false,
}: {
  rows: AccountRecord[];
  attention?: boolean;
}) {
  return (
    <ul className={styles.records}>
      {rows.map((row) => (
        <li
          className={styles.record}
          key={row.key}
          data-attention={attention || undefined}
        >
          <div>
            <div className={styles.recordMeta}>
              <span>{row.category}</span>
              <span className={styles.status} data-tone={row.tone}>
                {row.status}
              </span>
            </div>
            <h3>
              <Link href={row.href}>{row.title}</Link>
            </h3>
            <p>{row.next}</p>
          </div>
          <div className={styles.recordEnd}>
            <time dateTime={row.updatedAt}>
              更新于 {formatDate(row.updatedAt)}
            </time>
            <Link
              className={styles.recordAction}
              href={row.href}
              aria-label={`${attention ? "继续处理" : "查看"}${row.title}`}
            >
              {attention ? "继续处理" : "查看记录"}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
const pageNumber = (value: unknown) =>
  typeof value === "string" && /^\d+$/.test(value)
    ? Math.min(10000, Math.max(1, Number(value)))
    : 1;
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canParticipate(user)) redirect("/login?returnTo=%2Faccount");
  const actor = user!;
  const query = await searchParams;
  const history = query.view === "history";
  const page = pageNumber(query.page);
  const ownApplications = (states: string[]): Where => ({
    and: [
      { applicant: { equals: actor.id } },
      ...(history ? [] : [{ status: { in: states } }]),
    ],
  });
  const [
    signups,
    staff,
    teamApplications,
    establishments,
    communityApplications,
    memberships,
  ] = await Promise.all([
    p.find({
      collection: "event-signups",
      overrideAccess: false,
      user: actor,
      depth: 0,
      limit: 8,
      page,
      sort: "-updatedAt",
      where: { member: { equals: actor.id } },
      select: {
        activityType: true,
        activityID: true,
        eventTitle: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    p.find({
      collection: "staff-applications",
      overrideAccess: false,
      user: actor,
      depth: 0,
      limit: 8,
      sort: "-updatedAt",
      where: ownApplications(["submitted", "reviewing", "returned"]),
      select: { batch: true, batchTitle: true, status: true, updatedAt: true },
    }),
    p.find({
      collection: "team-join-applications",
      overrideAccess: false,
      user: actor,
      depth: 0,
      limit: 8,
      sort: "-updatedAt",
      where: ownApplications(["draft", "pending", "returned"]),
      select: { title: true, recruitment: true, status: true, updatedAt: true },
    }),
    p.find({
      collection: "team-establishment-applications",
      overrideAccess: false,
      user: actor,
      depth: 0,
      limit: 8,
      sort: "-updatedAt",
      where: ownApplications(["pending", "returned"]),
      select: { title: true, status: true, updatedAt: true },
    }),
    p.find({
      collection: "community-applications",
      overrideAccess: false,
      user: actor,
      depth: 0,
      limit: 8,
      sort: "-updatedAt",
      where: ownApplications(["pending", "returned"]),
      select: { proposedGame: true, status: true, updatedAt: true },
    }),
    p.find({
      collection: "team-memberships",
      overrideAccess: false,
      user: actor,
      depth: 0,
      limit: 8,
      sort: "-updatedAt",
      where: { member: { equals: actor.id } },
      select: {
        title: true,
        team: true,
        status: true,
        leftAt: true,
        updatedAt: true,
      },
    }),
  ]);
  const rows: AccountRecord[] = [
    ...staff.docs.map((row) => ({
      key: `staff-${row.id}`,
      title: row.batchTitle,
      category: "骨干招新",
      status: staffStatusLabels[row.status],
      updatedAt: row.updatedAt,
      href: `/join/staff/batches/${relationID(row.batch)}`,
      next:
        row.status === "returned"
          ? "查看反馈，按要求补充后重新提交。"
          : row.status === "accepted"
            ? "已录用；平台角色与任职由负责人另行处理。"
            : "查看自己的申请、处理意见与回执。",
      tone:
        row.status === "returned"
          ? "warning"
          : row.status === "accepted"
            ? "success"
            : undefined,
    })),
    ...teamApplications.docs.map((row) => ({
      key: `team-${row.id}`,
      title: row.title,
      category: "入队申请",
      status: teamApplicationLabels[row.status],
      updatedAt: row.updatedAt,
      href: `/teams/recruitment/${relationID(row.recruitment)}`,
      next:
        row.status === "draft"
          ? "申请仍为草稿，核对后提交人工选拔。"
          : row.status === "returned"
            ? "查看审核意见，补充资料后重新提交。"
            : "录取结果与成员关系以实际回执为准。",
      tone: ["draft", "returned"].includes(row.status)
        ? "warning"
        : row.status === "approved"
          ? "success"
          : undefined,
    })),
    ...establishments.docs.map((row) => ({
      key: `establishment-${row.id}`,
      title: row.title,
      category: "建队申请",
      status: teamApplicationLabels[row.status],
      updatedAt: row.updatedAt,
      href: ["returned", "withdrawn"].includes(row.status)
        ? `/teams/apply?edit=${row.id}`
        : "/teams/apply#team-applications-title",
      next:
        row.status === "returned"
          ? "补充建队资料后重新提交。"
          : "查看建队申请与负责人处理意见。",
      tone: row.status === "returned" ? "warning" : undefined,
    })),
    ...communityApplications.docs.map((row) => ({
      key: `community-${row.id}`,
      title: row.proposedGame,
      category: "社群管理员申请",
      status: applicationLabels[row.status || "pending"],
      updatedAt: row.updatedAt,
      href: ["returned", "withdrawn"].includes(row.status || "")
        ? `/community/apply?edit=${row.id}`
        : "/community/apply#my-applications-title",
      next:
        row.status === "returned"
          ? "查看反馈，补充申请资料。"
          : "社群任职独立授权，微信建群与拉群由管理员人工完成。",
      tone: row.status === "returned" ? "warning" : undefined,
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const attentionRows = rows.filter((row) => row.tone === "warning");
  const progressRows = history
    ? rows
    : rows.filter((row) => row.tone !== "warning");
  const roleLabels: Record<string, string> = {
    president: "社长",
    vicePresident: "副社长",
    backbone: "骨干",
    communityAdmin: "普通用户（历史管理标记）",
    member: "普通用户",
  };
  const departments: Record<string, string> = {
    execution: "执行部",
    publicity: "宣传部",
  };
  const tools: { href: string; title: string; description: string }[] = [];
  if (canManageStaffRecruitment(actor))
    tools.push({
      href: "/staff/manage",
      title: "骨干招新管理",
      description: "管理执行、宣传批次和候选申请；任命另行处理。",
    });
  if (canPublish(actor) || communityIDs(actor, "handleJoins").length)
    tools.push({
      href: "/teams/manage",
      title: "代表队工作台",
      description: "按授权审核入队申请，管理代表队与招新。",
    });
  if (canReviewPromotion(actor) || communityIDs(actor, "publishContent").length)
    tools.push({
      href: canReviewPromotion(actor)
        ? "/community/promotions?view=review"
        : "/community/promotions",
      title: canReviewPromotion(actor) ? "审核社群升推" : "我的社群升推",
      description: "申请、审核及管理社团首页展示。",
    });
  if (canSubmitClubContent(actor))
    tools.push({
      href: "/admin",
      title: "内容管理后台",
      description: "编辑权限范围内的社团内容。",
    });
  if (canSubmitClubContent(actor) || communityIDs(actor, "viewSignups").length)
    tools.push({
      href: "/activities",
      title: "问卷工作台",
      description: "按授权编辑问卷，查看报名、统计及导出。",
    });
  if (canPublish(actor))
    tools.push({
      href: "/community/review",
      title: "审核社群管理员申请",
      description: "处理已有社群任职申请与新游戏建群请求。",
    });
  return (
    <>
      <PageHeading
        title="我的紫荆"
        eyebrow="我的事务"
        description={`${actor.name || "你好"}，先继续手上的申请，再查看报名回执与处理结果。`}
        action={
          <Link className={styles.secondary} href="/events">
            查看活动
          </Link>
        }
      />
      <nav className={styles.accountIndex} aria-label="我的事务栏目">
        <a href="#applications-title">申请进度</a>
        <a href="#signups-title">活动回执</a>
        <a href="#teams-title">代表队</a>
        <a href="#profile-title">账号资料</a>
        {tools.length > 0 && <a href="#work-title">管理工作台</a>}
      </nav>
      <div className={styles.accountLayout}>
        {!history && attentionRows.length > 0 && (
          <section
            className={styles.attentionSection}
            aria-labelledby="continue-title"
          >
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="continue-title">需要继续处理</h2>
                <p>未完成的草稿与退回的申请，补充后可继续提交。</p>
              </div>
              <span className={styles.queueCount}>
                当前展示 {attentionRows.length} 项
              </span>
            </div>
            <RecordList rows={attentionRows} attention />
          </section>
        )}
        <section
          className={styles.section}
          aria-labelledby="applications-title"
        >
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="applications-title">
                {history ? "申请记录" : "进行中的申请"}
              </h2>
              <p>
                {history
                  ? "查阅每类最近的申请、处理意见与结果。"
                  : "已提交的申请和处理进度在这里更新。"}
              </p>
            </div>
            <nav className={styles.viewSwitch} aria-label="申请记录视图">
              <Link
                href="/account#applications-title"
                aria-current={!history ? "page" : undefined}
              >
                进行中
              </Link>
              <Link
                href="/account?view=history#applications-title"
                aria-current={history ? "page" : undefined}
              >
                查看全部申请
              </Link>
            </nav>
          </div>
          {progressRows.length ? (
            <RecordList rows={progressRows} />
          ) : (
            <div className={styles.empty}>
              <h3>
                {history
                  ? "还没有申请记录"
                  : attentionRows.length
                    ? "待补充的申请见上方"
                    : "暂无进行中的申请"}
              </h3>
              <p>
                {history
                  ? "从游戏社群、代表队选拔或骨干工作中，选择适合自己的参与方式。"
                  : "已处理的结果保留在全部申请中；活动与招新页面会发布新的安排。"}
              </p>
              <Link href="/join">了解参与方式</Link>
            </div>
          )}
          {rows.length > 0 && (
            <p className={styles.listNote}>
              每类按更新时间展示最近 8 条，更多记录可进入对应申请页面查看。
            </p>
          )}
          <nav className={styles.applicationLinks} aria-label="全部申请入口">
            <Link href="/join/staff">骨干申请</Link>
            <Link href="/teams/recruitment">入队申请</Link>
            <Link href="/teams/apply">建队申请</Link>
            <Link href="/community/apply">社群管理员申请</Link>
          </nav>
        </section>
        <section className={styles.section} aria-labelledby="signups-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="signups-title">我的活动报名</h2>
              <p>提交后查看回执；能否修改以当前问卷状态为准。</p>
            </div>
            <span className={styles.queueCount}>
              {signups.totalDocs} 条本人回执
            </span>
          </div>
          {signups.docs.length ? (
            <ul className={styles.records}>
              {signups.docs.map((row) => (
                <li className={styles.record} key={row.id}>
                  <div>
                    <div className={styles.recordMeta}>
                      <span>
                        {row.activityType === "community-posts"
                          ? "社群活动"
                          : "社团活动"}
                      </span>
                      <span className={styles.status}>已提交</span>
                    </div>
                    <h3>{row.eventTitle}</h3>
                    <p>报名编号 {row.id}</p>
                  </div>
                  <div className={styles.recordEnd}>
                    <time dateTime={row.updatedAt}>
                      {formatDate(row.updatedAt)}
                    </time>
                    {["events", "community-posts"].includes(
                      row.activityType,
                    ) && (
                      <Link
                        className={styles.recordAction}
                        href={`/activities/${row.activityType}/${row.activityID}/fill`}
                      >
                        查看回执
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <h3>还没有活动报名</h3>
              <p>
                提交站内活动问卷后，回执会显示在这里。外部平台受理的报名请到原平台查看。
              </p>
              <Link href="/events">浏览社团活动</Link>
            </div>
          )}
          <Pagination
            page={page}
            total={signups.totalPages}
            path="/account"
            query={{
              ...(history ? { view: "history" } : {}),
            }}
          />
        </section>
        <div className={styles.accountDetails}>
          <section className={styles.section} aria-labelledby="teams-title">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="teams-title">我的代表队</h2>
                <p>成员记录与本人选择公开的队员简介。</p>
              </div>
              <Link href="/teams/recruitment">成员记录与入队申请</Link>
            </div>
            {memberships.docs.length ? (
              <RecordList
                rows={memberships.docs.map((row) => ({
                  key: `membership-${row.id}`,
                  title: row.title,
                  category: "成员关系",
                  status:
                    row.status === "active"
                      ? "在队"
                      : row.leftAt
                        ? "已离队"
                        : "已撤销",
                  updatedAt: row.updatedAt,
                  href:
                    row.status === "active"
                      ? `/teams/profiles/${relationID(row.team)}`
                      : "/teams/recruitment",
                  next:
                    row.status === "active"
                      ? "编辑本人队员简介，独立选择是否展示。"
                      : "历史成员记录保留，可前往成员页查看。",
                  tone: row.status === "active" ? "success" : undefined,
                }))}
              />
            ) : (
              <div className={styles.empty}>
                <p>
                  暂无代表队成员记录。入队申请由社群管理员人工选拔，录取不授予平台或社群管理权限。
                </p>
                <Link href="/teams/recruitment">了解代表队选拔</Link>
              </div>
            )}
          </section>
          <section className={styles.profile} aria-labelledby="profile-title">
            <div className={styles.sectionHeader}>
              <h2 id="profile-title">账号资料</h2>
              <span>{actor.name || "我的账号"}</span>
            </div>
            <dl>
              <div>
                <dt>已验证邮箱</dt>
                <dd>{actor.email}</dd>
              </div>
              <div>
                <dt>平台身份</dt>
                <dd>
                  {(actor.roles?.length ? actor.roles : ["member"])
                    .map((role) => roleLabels[role] || role)
                    .join("、")}
                  {actor.department
                    ? `（${departments[actor.department]}）`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>社群管理任职</dt>
                <dd>
                  {hasCommunityOffice(actor)
                    ? "已有独立社群任职，能力按社群授权"
                    : "暂无在任社群"}
                </dd>
              </div>
            </dl>
            <p className={styles.hint}>
              平台角色、社群任职与队伍成员关系分别维护。骨干或代表队录用结果不会自动授予管理角色。
            </p>
            <div className={styles.profileActions}>
              <Link className={styles.textLink} href="/account/reset">
                修改登录密码
              </Link>
              <Link className={styles.textLink} href="/privacy">
                隐私说明
              </Link>
              <LogoutButton />
            </div>
          </section>
        </div>
        {tools.length > 0 && (
          <section className={styles.section} aria-labelledby="work-title">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="work-title">管理工作台</h2>
                <p>
                  按当前授权显示，进入后继续按对象与所属社群判断可处理范围。
                </p>
              </div>
            </div>
            <ul className={styles.workspaceLinks}>
              {tools.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
