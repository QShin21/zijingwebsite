import { AuthLayout } from "@/components/account-pages/AuthLayout";
import Link from "next/link";
import { LoginForm } from "@/components/account-pages/AuthForms";
import { safeReturnPath } from "@/components/account-pages/auth-return";
import styles from "@/components/account-pages/AccountPages.module.css";
export const metadata = { title: "登录" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    registered?: string;
    reset?: string;
    returnTo?: string;
    next?: string;
  }>;
}) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.returnTo || query.next);
  const onward =
    returnTo === "/account" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <AuthLayout
      title="登录"
      description="使用昵称或已验证的邮箱登录。"
      mode="login"
      returnTo={returnTo}
    >
      <LoginForm
        returnTo={returnTo}
        message={
          query.message ||
          (query.registered
            ? "注册成功，请登录。"
            : query.reset
              ? "密码已更新，请重新登录。"
              : "")
        }
        success={!query.message && Boolean(query.registered || query.reset)}
      />
      <div className={styles.formFooter}>
        <Link href={`/register${onward}`}>还没有账号？前往注册</Link>
        <Link href={`/account/reset${onward}`}>忘记密码</Link>
      </div>
      <p className={styles.authPrivacy}>
        账号及报名资料的处理方式见<Link href="/privacy">隐私说明</Link>。
      </p>
    </AuthLayout>
  );
}
