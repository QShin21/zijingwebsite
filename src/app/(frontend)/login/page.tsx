import { MemberLayout } from "@/components/MemberUI";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
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
    <>
      <PageHeading
        title="登录"
        eyebrow="我的紫荆 · 账号登录"
        description="使用昵称或已验证的清华邮箱登录。"
      />
      <MemberLayout
        title="再次相遇，一起上场。"
        description="登录后查看游戏社群、提交活动资料，也可以管理自己的账号。"
        steps={[
          "使用昵称或清华邮箱登录",
          "进入感兴趣的游戏社群",
          "查看本人回执，联系管理员加入微信群",
        ]}
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
          <Link href="/account/reset">忘记密码</Link>
        </div>
        <p className={styles.hint} style={{ marginTop: 20 }}>
          账号及报名资料的处理方式见<Link href="/privacy">隐私说明</Link>。
        </p>
      </MemberLayout>
    </>
  );
}
