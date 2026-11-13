import { AuthLayout } from "@/components/account-pages/AuthLayout";
import Link from "next/link";
import { LoginForm } from "@/components/account-pages/AuthForms";
import { safeReturnPath } from "@/components/account-pages/auth-return";
import styles from "@/components/account-pages/AccountPages.module.css";
import { getT } from "@/lib/i18n/server";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("登录", "Sign in") };
}
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
  const { t } = await getT();
  const returnTo = safeReturnPath(query.returnTo || query.next);
  const onward =
    returnTo === "/account" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <AuthLayout
      title={t("登录", "Sign in")}
      description={t("使用昵称或已验证的邮箱登录。", "Sign in with your nickname or verified email.")}
      mode="login"
      returnTo={returnTo}
    >
      <LoginForm
        returnTo={returnTo}
        message={
          query.message ||
          (query.registered
            ? t("注册成功，请登录。", "Registered. Please sign in.")
            : query.reset
              ? t("密码已更新，请重新登录。", "Password updated. Please sign in again.")
              : "")
        }
        success={!query.message && Boolean(query.registered || query.reset)}
      />
      <div className={styles.formFooter}>
        <Link href={`/register${onward}`}>{t("还没有账号？前往注册", "No account? Register")}</Link>
        <Link href={`/account/reset${onward}`}>{t("忘记密码", "Forgot password")}</Link>
      </div>
      <p className={styles.authPrivacy}>
        {t("账号及报名资料的处理方式见", "How we handle account and sign-up data: ")}<Link href="/privacy">{t("隐私说明", "Privacy")}</Link>{t("。", ".")}
      </p>
    </AuthLayout>
  );
}
