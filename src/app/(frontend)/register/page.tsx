import { RegistrationForm } from "@/components/RegistrationForm";
import { MemberLayout } from "@/components/MemberUI";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
export default function Register() {
  return (
    <>
      <PageHeading
        title="注册社团账号"
        eyebrow="JOIN THE COMMUNITY"
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
        <RegistrationForm />
        <p>
          已有账户？<Link href="/login">前往登录</Link>
        </p>
      </MemberLayout>
    </>
  );
}
