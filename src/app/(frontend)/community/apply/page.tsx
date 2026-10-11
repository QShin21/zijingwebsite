import { CommunityApplicationForm } from "@/components/CommunityApplicationForm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { SubmitButton } from "@/components/SubmitButton";
import { cms, list } from "@/lib/content";
import { applicationLabels } from "@/lib/community-status";
import { relationID } from "@/lib/rules";
import { withdrawApplicationAction, updateCommunityCardAction } from "../actions";
export default async function Apply({ searchParams }: { searchParams: Promise<{ message?: string; submitted?: string; edit?: string }> }) {
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const games = await list("games", {}, 1, 100), query = await searchParams;
  const apps = await p.find({ collection: "community-applications", overrideAccess: false, user,
    where: { applicant: { equals: user.id } }, sort: "-createdAt", limit: 50, depth: 0,
    select: { proposedGame: true, status: true, createdAt: true, updatedAt: true, game: true, reviewNote: true, contactConsent: true } });
  const edit = query.edit ? await p.findByID({ collection: "community-applications", id: Number(query.edit), overrideAccess: false, user, depth: 0 }).catch(() => null) : null;
  const initial = edit && Number(relationID(edit.applicant)) === user.id && ["returned", "withdrawn"].includes(edit.status || "")
    ? { id: edit.id, updatedAt: edit.updatedAt, game: Number(relationID(edit.game)) || null, proposedGame: edit.proposedGame,
      realName: edit.realName, phone: edit.phone, reason: edit.reason, contactConsent: edit.contactConsent } : undefined;
  return <>
    <PageHeading title="申请成为社群管理员" eyebrow="BUILD A COMMUNITY" description="申请组织已有游戏社群或创建新群。批准后获得对应社群任职，保留原平台角色；微信群由管理员人工建立和拉群。" />
    <section className="member-shell"><p role="status">{query.message}</p>
      {query.submitted ? <div className="application-confirmation" role="status"><h2>申请已提交</h2>
        <p>请等待负责人审核，可在下方查看状态和处理意见。批准与网站初始化不代表已经创建或进入微信群。</p>
        <Link className="button light" href="/account">返回我的账号</Link> <Link href="/community/apply">继续填写新申请</Link>
      </div> : <CommunityApplicationForm key={initial?.id ?? "new"} games={games.docs.map(game => ({ id: game.id, title: game.title }))} initial={initial} />}
      <h2>我的申请</h2>
      {apps.docs.length ? apps.docs.map(app => <article className="panel" key={app.id}><h3>{app.proposedGame}</h3><p>{applicationLabels[app.status ?? "pending"]}</p>
        {app.reviewNote && <p className="preserve">处理意见：{app.reviewNote}</p>}
        {app.status === "approved" && <>
          <p>社群任职与平台角色分开。实际进群仍由微信管理员人工操作和确认。</p>
          <form action={updateCommunityCardAction} className="member-form"><input type="hidden" name="id" value={app.id} /><input type="hidden" name="revision" value={app.updatedAt} />
            <label>更新微信名片（不选保留原图）<input type="file" name="wechatQr" accept="image/png,image/jpeg,image/webp" /></label>
            <label className="check"><input type="checkbox" name="contactConsent" defaultChecked={app.contactConsent ?? false} />允许在任期间向登录成员展示微信名片</label>
            <SubmitButton>保存名片与展示设置</SubmitButton>
          </form>
        </>}
        {["returned", "withdrawn"].includes(app.status ?? "") && <Link href={`/community/apply?edit=${app.id}`}>修改并重新提交</Link>}
        {app.status === "pending" && <form action={withdrawApplicationAction}><input type="hidden" name="id" value={app.id} /><input type="hidden" name="revision" value={app.updatedAt} /><SubmitButton className="button light">撤回网站申请</SubmitButton></form>}
      </article>) : <p>暂无申请。</p>}
      <Link href="/community">返回游戏社群</Link>
    </section>
  </>;
}
