import Link from "next/link";
import type { ReactNode } from "react";
import { safeReturnPath } from "./auth-return";
import { StageCanvas } from "../v2/StageCanvas";
import styles from "./AccountPages.module.css";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/locale";

function returnLabel(path: string, t: Translate) {
  if (path.startsWith("/activities/")) return t("活动报名与回执", "Event sign-up and receipt");
  if (path.startsWith("/community/")) return t("刚才的社群事务", "Your community task");
  if (path.startsWith("/teams/")) return t("刚才的代表队事务", "Your team task");
  if (path.startsWith("/join/staff")) return t("骨干招新申请", "Staff application");
  return path === "/account" ? t("我的事务", "My tasks") : t("刚才访问的页面", "The page you were on");
}

const benefitsFor = (t: Translate) => [
  t("报名活动、查看与修改回执", "Sign up for events, view and edit receipts"),
  t("联系社群管理员，人工拉群", "Contact community admins to be added to groups"),
  t("参加代表队选拔与骨干招新", "Try out for teams and apply as staff"),
  t("随时查看本人申请进度", "Track your applications anytime"),
];

/**
 * V2 split auth screen. The form card is first in DOM/focus order; on wide
 * screens the stage panel is placed to its left by CSS grid.
 */
export async function AuthLayout({
  title,
  description,
  mode,
  returnTo = "/account",
  children,
}: {
  title: string;
  description: string;
  mode: "login" | "register" | "reset";
  returnTo?: string;
  children: ReactNode;
}) {
  const { t } = await getT();
  const benefits = benefitsFor(t);
  const destination = safeReturnPath(returnTo);
  const onward = destination === "/account" ? "" : `?returnTo=${encodeURIComponent(destination)}`;
  return (
    <div className={styles.authTask}>
      <div className={styles.authMain}>
        <div className={styles.authCard}>
          <nav className={styles.authNav} aria-label={t("账号入口", "Account")}>
            <Link href={`/login${onward}`} aria-current={mode === "login" ? "page" : undefined}>
              {t("登录", "Sign in")}
            </Link>
            <Link href={`/register${onward}`} aria-current={mode === "register" ? "page" : undefined}>
              {t("注册账号", "Register")}
            </Link>
            {mode === "reset" && <span aria-current="page">{t("重设密码", "Reset password")}</span>}
          </nav>
          <header className={styles.authHeading}>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          <div className={styles.authFormArea}>{children}</div>
        </div>
      </div>
      <aside className={styles.authContext} aria-labelledby="auth-next-title">
        <StageCanvas className={styles.authCanvas} density={0.7} />
        <p className={styles.authKicker}>{t("紫荆赛场 · 账号", "Zijing Arena · Account")}</p>
        <div className={styles.returnTask}>
          <p>{mode === "reset" ? t("重新登录后继续", "Continue after signing in again") : t("登录后继续", "Continue after signing in")}</p>
          <h2 id="auth-next-title">{returnLabel(destination, t)}</h2>
          <p>{t("你的下一站已保留，完成账号验证后即可继续。", "Your next step is saved. Continue once your account is verified.")}</p>
        </div>
        <ul className={styles.benefits} aria-label={t("登录后可以", "After signing in you can")}>
          {benefits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {mode === "register" ? (
          <div className={styles.authGuidance}>
            <h2>{t("验证邮箱后完成注册", "Verify your email to register")}</h2>
            <ol>
              <li>{t("填写邮箱、昵称与密码。", "Enter your email, nickname and password.")}</li>
              <li>{t("选择“验证并注册”，查收六位验证码。", "Choose “Verify and register” and check for the 6-digit code.")}</li>
              <li>{t("在验证窗口完成注册，再登录继续。", "Finish registering in the verification window, then sign in.")}</li>
            </ol>
          </div>
        ) : mode === "reset" ? (
          <div className={styles.authGuidance}>
            <h2>{t("收不到验证码", "No code received?")}</h2>
            <p>{t("请核对注册邮箱，并检查垃圾邮件。验证码有效期为 10 分钟；发送后 60 秒可再次获取。", "Check your registered email and spam folder. Codes are valid for 10 minutes; you can request another after 60 seconds.")}</p>
          </div>
        ) : (
          <div className={styles.authGuidance}>
            <h2>{t("第一次来到紫荆", "New to Zijing?")}</h2>
            <p>{t("先注册账号，便可查看自己的报名、申请与进群记录。", "Register to see your sign-ups, applications and group records.")}</p>
            <Link href={`/register${onward}`}>{t("创建社团账号 →", "Create an account →")}</Link>
          </div>
        )}
        <div className={styles.authGuidance}>
          <h2>{t("加入游戏社群", "Join a game community")}</h2>
          <p>{t("网站账号用于记录事务。加入微信群需联系社群管理员，由管理员人工邀请。", "Your account records your activity. To join a WeChat group, contact a community admin, who adds you by hand.")}</p>
          <Link href="/events">{t("先浏览日程 →", "Browse the schedule →")}</Link>
        </div>
      </aside>
    </div>
  );
}
