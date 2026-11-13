import { AuthLayout } from "@/components/account-pages/AuthLayout";
import { PasswordResetForm } from "@/components/account-pages/AuthForms";
import { safeReturnPath } from "@/components/account-pages/auth-return";
import { getT } from "@/lib/i18n/server";
export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("重设密码", "Reset password") };
}
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    sent?: string;
    returnTo?: string;
    next?: string;
  }>;
}) {
  const query = await searchParams;
  const { t } = await getT();
  const returnTo = safeReturnPath(query.returnTo || query.next);
  return (
    <AuthLayout
      title={t("重设密码", "Reset password")}
      description={t("通过注册邮箱的六位验证码重设密码；更新后使用新密码登录。", "Reset your password with a 6-digit code sent to your registered email, then sign in with the new password.")}
      mode="reset"
      returnTo={returnTo}
    >
      <PasswordResetForm
        message={query.message}
        sent={Boolean(query.sent)}
        returnTo={returnTo}
      />
    </AuthLayout>
  );
}
