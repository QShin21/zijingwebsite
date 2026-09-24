import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { cms } from "@/lib/content";
import { canPublish } from "@/lib/rules";
import { decideAction } from "../actions";
export default async function Review({ searchParams }: { searchParams: Promise<{ message?: string; done?: string }> }) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canPublish(user)) notFound();
  const apps = await p.find({ collection: "community-applications", overrideAccess: false, user,
    where: { status: { equals: "pending" } }, sort: "createdAt", limit: 50, depth: 0 });
  const query = await searchParams;
  return <><PageHeading title="社群管理员申请审核" eyebrow="REVIEW QUEUE"
    description="审核通过已有游戏的申请，或创建新游戏社群并授予对应管理权限。" />
    <section className="member-shell"><p role="status">{query.message || (query.done ? "审核结果已保存。" : "")}</p>
      {apps.docs.length ? apps.docs.map((app) => <article className="panel" key={app.id}>
        <h2>{app.proposedGame}</h2><p>申请人编号：{typeof app.applicant === "object" ? app.applicant.id : app.applicant}</p>
        <p className="preserve">{app.reason}</p><p>{app.game ? "加入已有社群" : "通过后建立新社群"}</p>
        <div className="review-actions">
          <form action={decideAction}><input type="hidden" name="id" value={app.id} />
            <button className="button light" name="decision" value="approved">批准</button></form>
          <form action={decideAction}><input type="hidden" name="id" value={app.id} />
            <button className="button" name="decision" value="rejected">退回</button></form>
        </div>
      </article>) : <p>目前没有待审核申请。</p>}
    </section></>;
}
