import { SubmitButton } from "@/components/SubmitButton";
import { MemberLayout, FormStep } from "@/components/MemberUI";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { registerAction, sendCodeAction } from "../account/actions";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; sent?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <PageHeading
        title="注册社团账号"
        eyebrow="JOIN THE COMMUNITY"
        description="仅接受清华师生与校友邮箱。验证码发送至填写的邮箱，10 分钟内有效。"
      />
      <MemberLayout
        title="从认识，到并肩。"
        description="注册属于你的社团账号。参与活动的具体条件与报名方式，请查看对应活动或招新页面。"
        steps={[
          "用清华师生或校友邮箱获取验证码",
          "填写验证码与个人账号信息",
          "完成注册后登录，开始交流",
        ]}
      >
        <p role="status">
          {query.message ||
            (query.sent ? "如邮件发送成功，请查收六位验证码。" : "")}
        </p>
        <form className="member-form" action={sendCodeAction}>
          <FormStep number="01" title="获取邮箱验证码" />
          <input type="hidden" name="purpose" value="register" />
          <label>
            清华邮箱
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@mails.tsinghua.edu.cn"
            />
          </label>
          <SubmitButton className="button">发送六位验证码</SubmitButton>
        </form>
        <form className="member-form" action={registerAction}>
          <FormStep number="02" title="验证并完善账号" />
          <label>
            清华邮箱
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            验证码
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
            />
          </label>
          <label>
            数字账户
            <input
              name="account"
              inputMode="numeric"
              pattern="[0-9]{6,20}"
              minLength={6}
              maxLength={20}
              required
              autoComplete="username"
              aria-describedby="account-hint"
            />
            <span id="account-hint" className="field-hint">
              设置 6–20 位数字，作为你的登录账户。
            </span>
          </label>
          <label>
            昵称
            <input
              name="name"
              minLength={2}
              maxLength={40}
              required
              autoComplete="nickname"
            />
            <span className="field-hint">
              2–40 个字符，将作为你的公开昵称。
            </span>
          </label>
          <label>
            密码（至少 12 位，含字母和数字）
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            确认密码
            <input
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <SubmitButton className="button light">验证并注册</SubmitButton>
        </form>
        <p>
          已有账户？<Link href="/login">前往登录</Link>
        </p>
      </MemberLayout>
    </>
  );
}
