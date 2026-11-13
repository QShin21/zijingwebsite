import { RegistrationForm } from "@/components/RegistrationForm";
import { AuthLayout } from "@/components/account-pages/AuthLayout";
import Link from "next/link";
import { safeReturnPath } from "@/components/account-pages/auth-return";
import styles from "@/components/account-pages/AccountPages.module.css";
import { getT } from "@/lib/i18n/server";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("注册社团账号", "Register") };
}
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; next?: string }>;
}) {
  const query = await searchParams;
  const { t } = await getT();
  const returnTo = safeReturnPath(query.returnTo || query.next);
  const onward =
    returnTo === "/account" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <AuthLayout
      title={t("注册社团账号", "Create a club account")}
      description={t("填写账号资料并验证邮箱。平台按邮箱类型确定清华用户、友校学生或校外人士身份。", "Enter your details and verify your email. Your email domain determines whether you are a Tsinghua user, partner-school student or external user.")}
      mode="register"
      returnTo={returnTo}
    >
      <RegistrationForm returnTo={returnTo} />
      <div className={styles.formFooter}>
        <Link href={`/login${onward}`}>{t("已有账号？前往登录", "Have an account? Sign in")}</Link>
        <Link href="/privacy">{t("隐私说明", "Privacy")}</Link>
      </div>
    </AuthLayout>
  );
}
