import { MemberLayout } from "@/components/MemberUI";
import { PageHeading } from "@/components/PageHeading";
import { PasswordResetForm } from "@/components/account-pages/AuthForms";
export const metadata = { title: "重设密码" };
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
        eyebrow="我的紫荆 · 账号恢复"
        description="通过注册邮箱的六位验证码重设密码；更新后使用新密码登录。"
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
        <PasswordResetForm message={query.message} sent={Boolean(query.sent)} />
      </MemberLayout>
    </>
  );
}
