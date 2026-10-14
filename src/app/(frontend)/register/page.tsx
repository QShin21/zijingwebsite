import { RegistrationForm } from "@/components/RegistrationForm";
import { AuthLayout } from "@/components/account-pages/AuthLayout";
import Link from "next/link";
import { safeReturnPath } from "@/components/account-pages/auth-return";
import styles from "@/components/account-pages/AccountPages.module.css";
export const metadata = { title: "注册社团账号" };
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; next?: string }>;
}) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.returnTo || query.next);
  const onward =
    returnTo === "/account" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <AuthLayout
      title="注册社团账号"
      description="填写账号资料后验证清华邮箱，即可完成注册。"
      mode="register"
      returnTo={returnTo}
    >
      <RegistrationForm returnTo={returnTo} />
      <div className={styles.formFooter}>
        <Link href={`/login${onward}`}>已有账号？前往登录</Link>
        <Link href="/privacy">隐私说明</Link>
      </div>
    </AuthLayout>
  );
}
