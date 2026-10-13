import { RegistrationForm } from "@/components/RegistrationForm";
import { MemberLayout } from "@/components/MemberUI";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
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
    <>
      <PageHeading
        title="注册社团账号"
        eyebrow="我的紫荆 · 邮箱验证"
        description="填写账号资料后验证清华邮箱，即可完成注册。"
      />
      <MemberLayout
        title="从认识，到并肩。"
        description="注册属于你的社团账号。参与活动的具体条件与报名方式，请查看对应活动或招新页面。"
        steps={[
          "填写邮箱、昵称与密码",
          "点击验证并注册，查收邮箱验证码",
          "在弹窗完成验证，再登录使用",
        ]}
      >
        <RegistrationForm returnTo={returnTo} />
        <div className={styles.formFooter}>
          <Link href={`/login${onward}`}>已有账号？前往登录</Link>
          <Link href="/privacy">隐私说明</Link>
        </div>
      </MemberLayout>
    </>
  );
}
