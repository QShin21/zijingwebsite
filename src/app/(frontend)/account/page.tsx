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
  const roles: Record<string, string> = { president: "社长", vicePresident: "副社长",
    communityAdmin: "社群管理员", member: "普通成员" };
  return <><PageHeading title={user.name || "我的账号"} eyebrow="YOUR SPACE"
    description={`数字账户 ${user.account || "未设置"} · ${roles[user.roles?.[0] || "member"]}`} />
    <section className="member-shell">
      <p>已验证邮箱：{user.email}</p><p><Link href="/account/reset">通过邮箱修改密码</Link></p>
      <p><Link href="/community">进入游戏社群与论坛</Link> · <Link href="/community/apply">申请成为社群管理员</Link></p>
      {(canPublish(user) || hasRole(user, "communityAdmin")) && <p><Link href="/admin">进入内容管理后台</Link></p>}
      {canPublish(user) && <p><Link href="/community/review">审核社群管理员申请</Link></p>}
      <form action={logoutAction}><button className="button">退出登录</button></form>
    </section></>;
}
