import { SubmitButton } from "@/components/SubmitButton";
import { MemberLayout, FormStep } from "@/components/MemberUI";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { resetAction, sendCodeAction } from "../actions";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; sent?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <PageHeading
        title="重设密码"
        eyebrow="ACCOUNT RECOVERY"
        description="通过注册邮箱的六位验证码重设密码；重设后请重新登录。"
      />
      <MemberLayout
        title="找回账号，继续热爱。"
        description="使用注册时的清华邮箱验证身份，设置新的登录密码。"
        steps={[
          "获取发送到注册邮箱的验证码",
          "填写六位验证码与新密码",
          "保存后使用新密码重新登录",
        ]}
      >
        <p role="status">
          {query.message || (query.sent ? "如果账户存在，验证码已发送。" : "")}
        </p>
        <form className="member-form" action={sendCodeAction}>
          <FormStep number="01" title="获取邮箱验证码" />
          <input type="hidden" name="purpose" value="password" />
          <label>
            注册邮箱
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <SubmitButton className="button">获取验证码</SubmitButton>
        </form>
        <form className="member-form" action={resetAction}>
          <FormStep number="02" title="验证并设置新密码" />
          <label>
            注册邮箱
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            六位验证码
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
            新密码（至少 12 位，含字母和数字）
            <input
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            确认新密码
            <input
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <SubmitButton className="button light">更新密码</SubmitButton>
        </form>
        <Link href="/login">返回登录</Link>
      </MemberLayout>
    </>
  );
}
