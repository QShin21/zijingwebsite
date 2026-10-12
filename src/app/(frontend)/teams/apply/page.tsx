import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { TeamCorePagination, teamPage } from "@/components/TeamCorePagination";
import { PageHeading } from "@/components/PageHeading";
import {
  TeamCoreEstablishmentForm,
  TeamCoreOperation,
} from "@/components/TeamCoreControls";
import {
  canProposeTeam,
  currentTeamActor,
  positiveID,
} from "@/lib/team-memberships";
import { teamApplicationLabels } from "@/lib/team-core";
export const dynamic = "force-dynamic";
export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; page?: string }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const actor = await currentTeamActor(p, user),
    query = await searchParams;
  const games = await p.find({
    collection: "games",
    user: null,
    overrideAccess: false,
    draft: false,
    depth: 0,
    pagination: false,
    select: { title: true },
  });
  const allowed = games.docs.filter((game) => canProposeTeam(actor, game.id));
  const applications = await p.find({
    collection: "team-establishment-applications",
    user,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    page: teamPage(query.page),
    sort: "-updatedAt",
    where: { applicant: { equals: user.id } },
  });
  const candidate = positiveID(query.edit)
    ? await p
        .findByID({
          collection: "team-establishment-applications",
          id: positiveID(query.edit)!,
          user,
          overrideAccess: false,
          depth: 0,
        })
        .catch(() => null)
    : null;
  const edit =
    candidate &&
    positiveID(candidate.applicant) === user.id &&
    ["returned", "withdrawn"].includes(candidate.status)
      ? candidate
      : null;

  return (
    <>
      <PageHeading
        title="申请建立代表队"
        eyebrow="TEAM FORMATION"
        description="本社群管理员提交组织与训练计划，由现有高权限管理人员审核批准后成立。"
      />
      <section className="member-shell">
        <TeamCoreEstablishmentForm
          key={query.edit ?? "new"}
          games={allowed.map((g) => ({ id: g.id, title: g.title }))}
          initial={
            edit
              ? {
                  id: edit.id,
                  gameID: positiveID(edit.game)!,
                  title: edit.title,
                  reason: edit.reason,
                  revision: edit.updatedAt,
                }
              : undefined
          }
        />
        <h2>我的建队申请</h2>
        {applications.docs.length ? (
          applications.docs.map((doc) => (
            <article className="panel" key={doc.id}>
              <h3>{doc.title}</h3>
              <p>{teamApplicationLabels[doc.status]}</p>
              <p className="preserve">{doc.reviewNote}</p>
              {["returned", "withdrawn"].includes(doc.status) && (
                <Link href={`/teams/apply?edit=${doc.id}`}>修改并重新提交</Link>
              )}
              {["pending", "returned"].includes(doc.status) && (
                <TeamCoreOperation
                  operation="withdraw-establishment"
                  id={doc.id}
                  revision={doc.updatedAt}
                  label="撤回建队申请"
                />
              )}
              {doc.status === "approved" && (
                <Link href={`/teams/manage/${positiveID(doc.team)}`}>
                  进入代表队工作台
                </Link>
              )}
            </article>
          ))
        ) : (
          <p>暂无建队申请。</p>
        )}
        <TeamCorePagination
          page={teamPage(query.page)}
          total={applications.totalPages}
          path="/teams/apply"
          parameter="page"
          query={query}
          label="我的建队申请"
        />
        <Link href="/teams/manage">返回代表队工作台</Link>
      </section>
    </>
  );
}
