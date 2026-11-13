import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { TeamCoreOperation } from "@/components/TeamCoreControls";
import { positiveID } from "@/lib/team-memberships";
import { teamRecruitmentState } from "@/lib/team-core";
import { getT } from "@/lib/i18n/server";
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
import { applicationLabel, recruitmentStateLabel } from "../labels";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("选拔中心", "Tryout center") };
}

const applicationTone: Record<string, Tone> = { draft: "neutral", pending: "info", returned: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" };

export default async function Recruitment({ searchParams }: { searchParams: Promise<{ page?: string; ownPage?: string; membersPage?: string }> }) {
  const query = await searchParams;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect(teamLoginHref("/teams/recruitment", query));
  const { t } = await getT();
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
        eyebrow={t("TRYOUTS · 代表队选拔 · 骨干招新", "TRYOUTS · Team tryouts · Staff recruitment")}
        title={t("选拔中心", "Tryout center")}
        description={t("开放中的代表队选拔与骨干批次都在这里。提交后在本页查看本人回执与审核意见，由管理员人工选拔。", "Open team tryouts and staff batches are all here. After submitting, check your receipt and reviewer feedback on this page; admins select manually.")}
        actions={
          <ButtonLink href="#my-team-applications" tone="accent" icon="arrow">
            {t("我的入队申请", "My team applications")}
          </ButtonLink>
        }
        meta={
          <>
            <StatusPill tone="live">{t(`${openCalls.length} 个开放批次`, `${openCalls.length} open ${openCalls.length === 1 ? "batch" : "batches"}`)}</StatusPill>
            <StatusPill>{t(`${own.totalDocs} 份本人申请`, `${own.totalDocs} ${own.totalDocs === 1 ? "application" : "applications"}`)}</StatusPill>
            <StatusPill>{t(`${memberships.totalDocs} 条成员记录`, `${memberships.totalDocs} member ${memberships.totalDocs === 1 ? "record" : "records"}`)}</StatusPill>
          </>
        }
      />
      <Wrap className={layout.pageBody}>
        <TeamsNav current="recruitment" />
        <div className={layout.sidebarLayout}>
          <div>
            <Section id="open-calls" title={t("开放中的批次", "Open batches")} count={openCalls.length} more={{ href: "/join/staff", label: t("骨干招新", "Staff recruitment") }}>
              {openCalls.length ? (
                <div className={layout.grid3}>
                  {openCalls.map((call) => (
                    <RecruitmentTile key={call.key} call={call} />
                  ))}
                </div>
              ) : (
                <EmptyState title={t(empty.recruitment.title, "No open batches right now")} icon="flag" compact>
                  {t(empty.recruitment.body, "Browse past team and staff recruitment in the meantime.")}
                </EmptyState>
              )}
            </Section>

            {center?.mine && center.mine.length > 0 && (
              <Section id="mine" title={t("我的申请进度", "My application progress")}>
                <div className={layout.grid2}>
                  {center.mine.map((item) => (
                    <ApplicationCard key={item.key} item={item} />
                  ))}
                </div>
              </Section>
            )}

            <Section id="my-team-applications" title={t("我的入队申请", "My team applications")} description={t(`${own.totalDocs} 份记录。草稿只保存在本人回执中，提交后进入审核队列。`, `${own.totalDocs} ${own.totalDocs === 1 ? "record" : "records"}. Drafts stay on your receipt; submitted applications enter the review queue.`)}>
              <div className={work.records}>
                {own.docs.length ? (
                  own.docs.map((doc) => (
                    <article className={work.record} key={doc.id} data-state={doc.status}>
                      <div className={work.recordHead}>
                        <h3>{doc.title}</h3>
                        <StatusPill tone={applicationTone[doc.status] ?? "neutral"}>{applicationLabel(t, doc.status)}</StatusPill>
                      </div>
                      <p className={work.meta}>{t(`申请编号 ${doc.id}`, `Application #${doc.id}`)}</p>
                      {doc.reviewNote && (
                        <div className={work.submission}>
                          <h4>{t("处理意见", "Reviewer note")}</h4>
                          <p className="preserve">{doc.reviewNote}</p>
                        </div>
                      )}
                      <div className={work.actions}>
                        <Link className={buttonClass("primary", "small")} href={`/teams/recruitment/${positiveID(doc.recruitment)}`}>
                          {t("查看回执 / 继续修改", "View receipt / continue editing")}
                        </Link>
                        {["draft", "pending", "returned"].includes(doc.status) && (
                          <TeamCoreOperation operation="withdraw-join" id={doc.id} revision={doc.updatedAt} label={t("撤回申请", "Withdraw application")} />
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState title={t("还没有入队申请", "No team applications yet")} icon="ticket" compact>
                    {t("从下方招新批次开始，了解选拔要求；填写后可以先保存草稿。", "Start from a recruitment batch below to read the requirements; you can save a draft first.")}
                  </EmptyState>
                )}
              </div>
              <TeamCorePagination page={teamPage(query.ownPage)} total={own.totalPages} path="/teams/recruitment" parameter="ownPage" query={query} label={t("我的申请", "My applications")} />
            </Section>

            <Section id="team-recruitment-list" title={t("代表队招新批次", "Team recruitment batches")} description={t(`${batches.totalDocs} 个公开批次；开放中的批次见上方。`, `${batches.totalDocs} public ${batches.totalDocs === 1 ? "batch" : "batches"}; open ones are shown above.`)}>
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
                          <StatusPill tone={batch.status === "open" ? "live" : "neutral"}>{recruitmentStateLabel(t, teamRecruitmentState(batch, form))}</StatusPill>
                        </div>
                        {form.intro && <p className={work.meta}>{form.intro}</p>}
                        <div className={work.actions}>
                          <Link className={work.chipLink} href={`/teams/recruitment/${batch.id}`}>
                            {t("查看申请与选拔说明", "View application & tryout details")}
                          </Link>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <EmptyState title={batches.docs.length ? t("其余批次已在上方显示", "Remaining batches are shown above") : t("目前没有公开招新批次", "No public recruitment batches")} icon="flag" compact>
                    {batches.docs.length ? t("开放中的代表队选拔见“开放中的批次”。", "Open team tryouts are listed under “Open batches”.") : t("新的选拔安排确认后将在这里发布。", "New tryouts will be posted here once confirmed.")}
                  </EmptyState>
                )}
              </div>
              <TeamCorePagination page={page} total={batches.totalPages} path="/teams/recruitment" parameter="page" query={query} label={t("招新批次", "Recruitment batches")} />
            </Section>

            <Section
              id="my-team-memberships"
              title={t("我的代表队成员记录", "My team memberships")}
              description={t(`${memberships.totalDocs} 条记录。在队时可填写本人简介、投稿队伍荣誉；公开简介须由本人明确选择展示。`, `${memberships.totalDocs} ${memberships.totalDocs === 1 ? "record" : "records"}. While on a team you can edit your profile and submit team honors; public profiles require your explicit choice.`)}
            >
              <div className={work.records}>
                {memberships.docs.length ? (
                  memberships.docs.map((doc) => (
                    <article className={work.record} key={doc.id} data-state={doc.status}>
                      <div className={work.recordHead}>
                        <h3>{doc.title}</h3>
                        <StatusPill tone={doc.status === "active" ? "success" : "neutral"}>{doc.status === "active" ? t("在队", "Active") : doc.leftAt ? t("已离队", "Left") : t("已撤销", "Revoked")}</StatusPill>
                      </div>
                      <p className={work.meta}>{t(`成员关系编号 ${doc.id}`, `Membership #${doc.id}`)}</p>
                      {doc.status === "active" && positiveID(doc.team) && (
                        <nav className={work.actions} aria-label={t("本队成员操作", "Member actions")}>
                          <Link className={work.chipLink} href={`/teams/profiles/${positiveID(doc.team)}`}>
                            {t("填写或修改我的队内简介", "Edit my team profile")}
                          </Link>
                          <Link className={work.chipLink} href={`/teams/honors?view=mine&team=${positiveID(doc.team)}`}>
                            {t("本队荣誉与我的投稿", "Team honors & my submissions")}
                          </Link>
                        </nav>
                      )}
                      {doc.status === "active" && (
                        <details className={work.disclosure}>
                          <summary>{t("办理离队", "Leave team")}</summary>
                          <p>{t("离队后会停止仅现任队员可使用的编辑与投稿权限，历史记录继续保留。", "Leaving ends player-only editing and submission rights; history is kept.")}</p>
                          <TeamCoreOperation operation="leave" id={doc.id} revision={doc.updatedAt} label={t("办理本人离队", "Leave this team")} />
                        </details>
                      )}
                    </article>
                  ))
                ) : (
                  <EmptyState title={t("暂无成员关系记录", "No memberships yet")} icon="trophy" compact>
                    {t("人工录取通过后，可查看队内简介和荣誉投稿入口。", "Once accepted, you can access your team profile and honor submissions.")}
                  </EmptyState>
                )}
              </div>
              <TeamCorePagination page={teamPage(query.membersPage)} total={memberships.totalPages} path="/teams/recruitment" parameter="membersPage" query={query} label={t("我的成员记录", "My memberships")} />
            </Section>
          </div>
          <aside className={`${layout.panel} ${layout.sticky}`}>
            <TaskNote
              title={t("从招新到入队", "From recruitment to joining")}
              links={[
                { href: "/community", label: t("联系游戏社群", "Contact a game community") },
                { href: "/join/staff", label: t("了解骨干招新", "About staff recruitment") },
                { href: "/teams/manage", label: t("代表队工作台", "Team workspace") },
              ]}
            >
              <p>{t("先阅读批次要求与开放时间，填写后可保存草稿。提交后在本人回执查看审核意见。", "Read the batch requirements and dates first; you can save a draft. After submitting, see feedback on your receipt.")}</p>
              <p>{t("录取建立代表队成员关系，不授予平台或社群管理权限。", "Acceptance creates a team membership and grants no platform or community admin rights.")}</p>
            </TaskNote>
          </aside>
        </div>
      </Wrap>
    </>
  );
}
