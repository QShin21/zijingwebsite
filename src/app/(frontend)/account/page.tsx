import { Icon } from "@/components/Identity";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { cms } from "@/lib/content";
import { canPublish, canReviewPromotion, canSubmitClubContent, communityIDs, hasCommunityOffice } from "@/lib/rules";
import { joinLabels } from "@/lib/community-status";
import { logoutAction } from "./actions";
export default async function Account() {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const roles: Record<string, string> = {
    president: "社长",
    vicePresident: "副社长",
    backbone: "骨干",
    communityAdmin: "普通用户（历史管理标记）",
    member: "普通用户",
  };
  const joins = await p.find({ collection: "community-joins", overrideAccess: false, user, depth: 0, limit: 50, sort: "-updatedAt", where: { member: { equals: user.id } } });
  const games = await p.find({ collection: "games", overrideAccess: false, user: null, draft: false, depth: 0, pagination: false, select: { title: true, slug: true } });
  const gameByID = new Map(games.docs.map(game => [game.id, game]));
  const departments: Record<string, string> = { execution: "执行部", publicity: "宣传部" };
  return (
    <>
      <PageHeading
        title={user.name || "我的账号"}
        eyebrow="YOUR SPACE"
        description={`可使用昵称或已验证邮箱登录 · ${roles[user.roles?.[0] || "member"]}`}
      />
      <section className="member-shell">
        <h2 className="form-heading">账号概览</h2>
        <dl className="account-details">
          <div>
            <dt>已验证邮箱</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>平台身份</dt>
            <dd>
              <span className="tag">{roles[user.roles?.[0] || "member"]}{user.department ? ` · ${departments[user.department]}` : ""}</span>
            </dd>
          </div>
          <div><dt>网站入社记录</dt><dd>{joins.docs.some(row => row.status === "joined") ? "已有管理员人工确认进群" : "尚未人工确认进群"}</dd></div>
          <div><dt>社群管理任职</dt><dd>{hasCommunityOffice(user) ? "已获独立社群任职，能力按社群授权" : "暂无在任社群"}</dd></div>
        </dl>
        <div className="account-actions">
          {(canReviewPromotion(user) || communityIDs(user, "publishContent").length > 0) && <Link className="account-action" href={canReviewPromotion(user) ? "/community/promotions?view=review" : "/community/promotions"}>
            <Icon name="layers" /><strong>{canReviewPromotion(user) ? "审核社群升推" : "我的社群升推"}</strong><small>申请、审核及管理社团首页展示。</small>
          </Link>}
          <Link className="account-action" href="/community">
            <Icon name="team" />
            <strong>游戏社群</strong>
            <small>查看社群活动并联系管理员加入微信群。</small>
          </Link>
          <Link className="account-action" href="/community/apply">
            <Icon name="plus" />
            <strong>申请成为社群管理员</strong>
            <small>组织已有社群，或发起新游戏项目。</small>
          </Link>
          <Link className="account-action" href="/account/reset">
            <Icon name="mail" />
            <strong>修改登录密码</strong>
            <small>通过已验证邮箱找回或更新密码。</small>
          </Link>
          {canSubmitClubContent(user) && (
            <Link className="account-action" href="/admin">
              <Icon name="layers" />
              <strong>内容管理后台</strong>
              <small>管理权限范围内的社团内容。</small>
            </Link>
          )}
          {(canSubmitClubContent(user) || communityIDs(user, "viewSignups").length > 0) && (
            <Link className="account-action" href="/activities">
              <Icon name="layers" />
              <strong>问卷工作台</strong>
              <small>按授权编辑问卷，或查看报名、统计与导出。</small>
            </Link>
          )}
          {canPublish(user) && (
            <Link className="account-action" href="/community/review">
              <Icon name="target" />
              <strong>审核社群管理员申请</strong>
              <small>查看待处理申请与建群请求。</small>
            </Link>
          )}
        </div>
        <h2>我的进群记录</h2>
        {joins.docs.length ? <ul className="community-list">{joins.docs.map(row => { const game = gameByID.get(typeof row.game === "object" ? row.game.id : row.game); return <li key={row.id}>{game ? <Link href={`/community/${game.slug}/join`}>{game.title}</Link> : <span>历史社群</span>}<span>{joinLabels[row.status]}</span></li>; })}</ul> : <p>暂无记录。网站注册、扫码和申请批准均不等于已进入微信群。</p>}
        <form action={logoutAction}>
          <SubmitButton>退出登录</SubmitButton>
        </form>
      </section>
    </>
  );
}
