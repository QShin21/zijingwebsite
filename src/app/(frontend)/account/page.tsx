import { Icon } from "@/components/Identity";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { cms } from "@/lib/content";
import { canPublish, hasRole } from "@/lib/rules";
import { logoutAction } from "./actions";
export default async function Account() {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const roles: Record<string, string> = {
    president: "社长",
    vicePresident: "副社长",
    communityAdmin: "社群管理员",
    member: "普通成员",
  };
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
            <dt>当前身份</dt>
            <dd>
              <span className="tag">{roles[user.roles?.[0] || "member"]}</span>
            </dd>
          </div>
        </dl>
        <div className="account-actions">
          <Link className="account-action" href="/community">
            <Icon name="team" />
            <strong>游戏社群与论坛</strong>
            <small>进入社群，继续你的讨论。</small>
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
          {(canPublish(user) || hasRole(user, "communityAdmin")) && (
            <Link className="account-action" href="/admin">
              <Icon name="layers" />
              <strong>内容管理后台</strong>
              <small>管理权限范围内的社团内容。</small>
            </Link>
          )}
          {(canPublish(user) || hasRole(user, "communityAdmin")) && (
            <Link className="account-action" href="/activities">
              <Icon name="layers" />
              <strong>问卷工作台</strong>
              <small>编辑问卷、预览、统计与导出。</small>
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
        <form action={logoutAction}>
          <SubmitButton>退出登录</SubmitButton>
        </form>
      </section>
    </>
  );
}
