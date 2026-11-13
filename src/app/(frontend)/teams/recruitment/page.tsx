import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreOperation } from "@/components/TeamCoreControls";
import { positiveID } from "@/lib/team-memberships";
import { teamApplicationLabels, teamRecruitmentState } from "@/lib/team-core";
import { normalizeSignup } from "@/lib/signup-schema";
import { getRecruitmentCenter } from "@/lib/v2";
import { readOptional } from "@/components/v2/data";
import { ButtonLink, EmptyState, PageHero, Section, StatusPill, Wrap, buttonClass, type Tone } from "@/components/v2/ui";
import { ApplicationCard, RecruitmentTile } from "@/components/v2/cards";
import { TeamsNav } from "@/components/v2/TeamsNav";
import { TaskNote } from "@/components/v2/TaskFrame";
import { empty } from "@/components/v2/copy";
import layout from "@/components/v2/layout.module.css";
import work from "@/components/v2/work.module.css";
import { teamLoginHref } from "../auth-return";

export const dynamic = "force-dynamic";
export const metadata = { title: "选拔中心" };

const applicationTone: Record<string, Tone> = { draft: "neutral", pending: "info", returned: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" };

export default async function Recruitment({ searchParams }: { searchParams: Promise<{ page?: string; ownPage?: string; membersPage?: string }> }) {
  const query = await searchParams;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref("/teams/recruitment", query));
  const page = teamPage(query.page);
  const batches = await p.find({
    collection: "team-recruitments",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page,
    sort: "-createdAt",
    where: { status: { in: ["open", "closed", "archived"] } },
  });
  const own = await p.find({
    collection: "team-join-applications",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.ownPage),
    sort: "-updatedAt",
    where: { applicant: { equals: user.id } },
  });
  const memberships = await p.find({
    collection: "team-memberships",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.membersPage),
    sort: "-updatedAt",
    where: { member: { equals: user.id } },
  });
  const center = await readOptional(getRecruitmentCenter, {});
  const openCalls = center ? [...center.staff, ...(center.teams?.docs ?? [])].filter((call) => call.state !== "closed") : [];
  // Batches already shown as open tiles are not repeated in the list (one link per batch title).
  const tiled = new Set(openCalls.flatMap(({ ref }) => (ref.type === "teamRecruitment" ? [String(ref.id)] : [])));
  const listed = batches.docs.filter((batch) => !tiled.has(String(batch.id)));

  return (
    <>
      <PageHero
        tone="stage"
        eyebrow="TRYOUTS · 代表队选拔 · 骨干招新"
        title="选拔中心"
        description="开放中的代表队选拔与骨干批次都在这里。提交后在本页查看本人回执与审核意见，由管理员人工选拔。"
        actions={
          <ButtonLink href="#my-team-applications" tone="accent" icon="arrow">
            我的入队申请
          </ButtonLink>
        }
        meta={
          <>
            <StatusPill tone="live">{openCalls.length} 个开放批次</StatusPill>
            <StatusPill>{own.totalDocs} 份本人申请</StatusPill>
            <StatusPill>{memberships.totalDocs} 条成员记录</StatusPill>
          </>
        }
      />
      <Wrap className={layout.pageBody}>
        <TeamsNav current="recruitment" />
        <div className={layout.sidebarLayout}>
          <div>
            <Section id="open-calls" title="开放中的批次" count={openCalls.length} more={{ href: "/join/staff", label: "骨干招新" }}>
              {openCalls.length ? (
                <div className={layout.grid3}>
                  {openCalls.map((call) => (
                    <RecruitmentTile key={call.key} call={call} />
                  ))}
                </div>
              ) : (
                <EmptyState title={empty.recruitment.title} icon="flag" compact>
                  {empty.recruitment.body}
                </EmptyState>
              )}
            </Section>

            {center?.mine && center.mine.length > 0 && (
              <Section id="mine" title="我的申请进度">
                <div className={layout.grid2}>
                  {center.mine.map((item) => (
                    <ApplicationCard key={item.key} item={item} />
                  ))}
                </div>
              </Section>
            )}

            <Section id="my-team-applications" title="我的入队申请" description={`${own.totalDocs} 份记录。草稿只保存在本人回执中，提交后进入审核队列。`}>
              <div className={work.records}>
                {own.docs.length ? (
                  own.docs.map((doc) => (
                    <article className={work.record} key={doc.id} data-state={doc.status}>
                      <div className={work.recordHead}>
                        <h3>{doc.title}</h3>
                        <StatusPill tone={applicationTone[doc.status] ?? "neutral"}>{teamApplicationLabels[doc.status]}</StatusPill>
                      </div>
                      <p className={work.meta}>申请编号 {doc.id}</p>
                      {doc.reviewNote && (
                        <div className={work.submission}>
                          <h4>处理意见</h4>
                          <p className="preserve">{doc.reviewNote}</p>
                        </div>
                      )}
                      <div className={work.actions}>
                        <Link className={buttonClass("primary", "small")} href={`/teams/recruitment/${positiveID(doc.recruitment)}`}>
                          查看回执 / 继续修改
                        </Link>
                        {["draft", "pending", "returned"].includes(doc.status) && (
                          <TeamCoreOperation operation="withdraw-join" id={doc.id} revision={doc.updatedAt} label="撤回申请" />
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState title="还没有入队申请" icon="ticket" compact>
                    从下方招新批次开始，了解选拔要求；填写后可以先保存草稿。
                  </EmptyState>
                )}
              </div>
              <TeamCorePagination page={teamPage(query.ownPage)} total={own.totalPages} path="/teams/recruitment" parameter="ownPage" query={query} label="我的申请" />
            </Section>

            <Section id="team-recruitment-list" title="代表队招新批次" description={`${batches.totalDocs} 个公开批次；开放中的批次见上方。`}>
              <div className={work.records}>
                {listed.length ? (
                  listed.map((batch) => {
                    const form = normalizeSignup(batch.signupForm);
                    return (
                      <article className={work.record} key={batch.id} data-state={batch.status}>
                        <div className={work.recordHead}>
                          <h3>
                            <Link href={`/teams/recruitment/${batch.id}`}>{batch.title}</Link>
                          </h3>
                          <StatusPill tone={batch.status === "open" ? "live" : "neutral"}>{teamRecruitmentState(batch, form)}</StatusPill>
                        </div>
                        {form.intro && <p className={work.meta}>{form.intro}</p>}
                        <div className={work.actions}>
                          <Link className={work.chipLink} href={`/teams/recruitment/${batch.id}`}>
                            查看申请与选拔说明
                          </Link>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <EmptyState title={batches.docs.length ? "其余批次已在上方显示" : "目前没有公开招新批次"} icon="flag" compact>
                    {batches.docs.length ? "开放中的代表队选拔见“开放中的批次”。" : "新的选拔安排确认后将在这里发布。"}
                  </EmptyState>
                )}
              </div>
              <TeamCorePagination page={page} total={batches.totalPages} path="/teams/recruitment" parameter="page" query={query} label="招新批次" />
            </Section>

            <Section
              id="my-team-memberships"
              title="我的代表队成员记录"
              description={`${memberships.totalDocs} 条记录。在队时可填写本人简介、投稿队伍荣誉；公开简介须由本人明确选择展示。`}
            >
              <div className={work.records}>
                {memberships.docs.length ? (
                  memberships.docs.map((doc) => (
                    <article className={work.record} key={doc.id} data-state={doc.status}>
                      <div className={work.recordHead}>
                        <h3>{doc.title}</h3>
                        <StatusPill tone={doc.status === "active" ? "success" : "neutral"}>{doc.status === "active" ? "在队" : doc.leftAt ? "已离队" : "已撤销"}</StatusPill>
                      </div>
                      <p className={work.meta}>成员关系编号 {doc.id}</p>
                      {doc.status === "active" && positiveID(doc.team) && (
                        <nav className={work.actions} aria-label="本队成员操作">
                          <Link className={work.chipLink} href={`/teams/profiles/${positiveID(doc.team)}`}>
                            填写或修改我的队内简介
                          </Link>
                          <Link className={work.chipLink} href={`/teams/honors?view=mine&team=${positiveID(doc.team)}`}>
                            本队荣誉与我的投稿
                          </Link>
                        </nav>
                      )}
                      {doc.status === "active" && (
                        <details className={work.disclosure}>
                          <summary>办理离队</summary>
                          <p>离队后会停止仅现任队员可使用的编辑与投稿权限，历史记录继续保留。</p>
                          <TeamCoreOperation operation="leave" id={doc.id} revision={doc.updatedAt} label="办理本人离队" />
                        </details>
                      )}
                    </article>
                  ))
                ) : (
                  <EmptyState title="暂无成员关系记录" icon="trophy" compact>
                    人工录取通过后，可查看队内简介和荣誉投稿入口。
                  </EmptyState>
                )}
              </div>
              <TeamCorePagination page={teamPage(query.membersPage)} total={memberships.totalPages} path="/teams/recruitment" parameter="membersPage" query={query} label="我的成员记录" />
            </Section>
          </div>
          <aside className={`${layout.panel} ${layout.sticky}`}>
            <TaskNote
              title="从招新到入队"
              links={[
                { href: "/community", label: "联系游戏社群" },
                { href: "/join/staff", label: "了解骨干招新" },
                { href: "/teams/manage", label: "代表队工作台" },
              ]}
            >
              <p>先阅读批次要求与开放时间，填写后可保存草稿。提交后在本人回执查看审核意见。</p>
              <p>录取建立代表队成员关系，不授予平台或社群管理权限。</p>
            </TaskNote>
          </aside>
        </div>
      </Wrap>
    </>
  );
}
