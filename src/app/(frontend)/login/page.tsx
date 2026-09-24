import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loginAction } from "../account/actions";
export default async function Login({ searchParams }: { searchParams: Promise<{ message?: string; registered?: string; reset?: string }> }) {
  const query = await searchParams;
  return <><PageHeading title="登录" eyebrow="MEMBER ACCESS" description="使用数字账户或已验证的清华邮箱登录。" />
    <section className="member-shell"><p role="status">{query.message || (query.registered ? "注册成功，请登录。" : query.reset ? "密码已更新，请重新登录。" : "")}</p>
      <form className="member-form" action={loginAction}>
        <label>数字账户或邮箱<input name="identifier" required autoComplete="username" /></label>
        <label>密码<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="button light">登录</button>
      </form><p><Link href="/register">注册账号</Link> · <Link href="/account/reset">忘记密码</Link></p>
    </section></>;
}
