import { AuthLayout } from "@/components/account-pages/AuthLayout";
import { PasswordResetForm } from "@/components/account-pages/AuthForms";
import { safeReturnPath } from "@/components/account-pages/auth-return";
export const metadata = { title: "重设密码" };
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
  const returnTo = safeReturnPath(query.returnTo || query.next);
  return (
    <AuthLayout
      title="重设密码"
      description="通过注册邮箱的六位验证码重设密码；更新后使用新密码登录。"
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
