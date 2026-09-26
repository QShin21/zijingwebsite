import { SubmitButton } from "@/components/SubmitButton";
import { MemberLayout } from "@/components/MemberUI";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loginAction } from "../account/actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    registered?: string;
    reset?: string;
  }>;
}) {
  const query = await searchParams;
  return (
    <>
      <PageHeading
        title="登录"
        eyebrow="MEMBER ACCESS"
        description="使用昵称或已验证的清华邮箱登录。"
      />
      <MemberLayout
        title="再次相遇，一起上场。"
        description="登录后参与游戏社群、发表讨论，也可以管理自己的账号。"
        steps={[
          "使用昵称或清华邮箱登录",
          "进入感兴趣的游戏社群",
          "分享经验，找到一起玩的伙伴",
        ]}
      >
        <p role="status">
          {query.message ||
            (query.registered
              ? "注册成功，请登录。"
              : query.reset
                ? "密码已更新，请重新登录。"
                : "")}
        </p>
        <form className="member-form" action={loginAction}>
          <h2 className="form-heading">欢迎回来</h2>
          <label>
            昵称或邮箱
            <input name="identifier" required autoComplete="username" />
          </label>
          <label>
            密码
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <SubmitButton className="button light">登录</SubmitButton>
        </form>
        <div className="form-footer">
          <Link href="/register">还没有账号？前往注册</Link>
          <Link href="/account/reset">忘记密码</Link>
        </div>
      </MemberLayout>
    </>
  );
}
