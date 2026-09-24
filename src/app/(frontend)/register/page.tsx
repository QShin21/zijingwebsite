import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { registerAction, sendCodeAction } from "../account/actions";
export default async function Register({ searchParams }: { searchParams: Promise<{ message?: string; sent?: string }> }) {
  const query = await searchParams;
  return <><PageHeading title="注册社团账号" eyebrow="JOIN THE COMMUNITY"
    description="仅接受清华师生与校友邮箱。验证码发送至填写的邮箱，10 分钟内有效。" />
    <section className="member-shell">
      <p role="status">{query.message || (query.sent ? "如邮件发送成功，请查收六位验证码。" : "")}</p>
      <form className="member-form" action={sendCodeAction}>
        <input type="hidden" name="purpose" value="register" />
        <label>清华邮箱<input name="email" type="email" required autoComplete="email" placeholder="name@mails.tsinghua.edu.cn" /></label>
        <button className="button" type="submit">发送六位验证码</button>
      </form>
      <form className="member-form" action={registerAction}>
        <label>清华邮箱<input name="email" type="email" required autoComplete="email" /></label>
        <label>验证码<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" /></label>
        <label>数字账户<input name="account" inputMode="numeric" pattern="[0-9]{6,20}" required autoComplete="username" /></label>
        <label>昵称<input name="name" minLength={2} maxLength={40} required autoComplete="nickname" /></label>
        <label>密码（至少 12 位，含字母和数字）<input name="password" type="password" minLength={12} required autoComplete="new-password" /></label>
        <label>确认密码<input name="confirm" type="password" minLength={12} required autoComplete="new-password" /></label>
        <button className="button light" type="submit">验证并注册</button>
      </form><p>已有账户？<Link href="/login">前往登录</Link></p>
    </section></>;
}
