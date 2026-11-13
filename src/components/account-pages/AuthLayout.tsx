import Link from "next/link";
import type { ReactNode } from "react";
import { safeReturnPath } from "./auth-return";
import { StageCanvas } from "../v2/StageCanvas";
import styles from "./AccountPages.module.css";

function returnLabel(path: string) {
  if (path.startsWith("/activities/")) return "活动报名与回执";
  if (path.startsWith("/community/")) return "刚才的社群事务";
  if (path.startsWith("/teams/")) return "刚才的代表队事务";
  if (path.startsWith("/join/staff")) return "骨干招新申请";
  return path === "/account" ? "我的事务" : "刚才访问的页面";
}

const benefits = ["报名活动、查看与修改回执", "联系社群管理员，人工拉群", "参加代表队选拔与骨干招新", "随时查看本人申请进度"];

/**
 * V2 split auth screen. The form card is first in DOM/focus order; on wide
 * screens the stage panel is placed to its left by CSS grid.
 */
export function AuthLayout({
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
  const destination = safeReturnPath(returnTo);
  const onward = destination === "/account" ? "" : `?returnTo=${encodeURIComponent(destination)}`;
  return (
    <div className={styles.authTask}>
      <div className={styles.authMain}>
        <div className={styles.authCard}>
          <nav className={styles.authNav} aria-label="账号入口">
            <Link href={`/login${onward}`} aria-current={mode === "login" ? "page" : undefined}>
              登录
            </Link>
            <Link href={`/register${onward}`} aria-current={mode === "register" ? "page" : undefined}>
              注册账号
            </Link>
            {mode === "reset" && <span aria-current="page">重设密码</span>}
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
        <p className={styles.authKicker}>紫荆赛场 · 账号</p>
        <div className={styles.returnTask}>
          <p>{mode === "reset" ? "重新登录后继续" : "登录后继续"}</p>
          <h2 id="auth-next-title">{returnLabel(destination)}</h2>
          <p>你的下一站已保留，完成账号验证后即可继续。</p>
        </div>
        <ul className={styles.benefits} aria-label="登录后可以">
          {benefits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {mode === "register" ? (
          <div className={styles.authGuidance}>
            <h2>验证邮箱后完成注册</h2>
            <ol>
              <li>填写邮箱、昵称与密码。</li>
              <li>选择“验证并注册”，查收六位验证码。</li>
              <li>在验证窗口完成注册，再登录继续。</li>
            </ol>
          </div>
        ) : mode === "reset" ? (
          <div className={styles.authGuidance}>
            <h2>收不到验证码</h2>
            <p>请核对注册邮箱，并检查垃圾邮件。验证码有效期为 10 分钟；发送后 60 秒可再次获取。</p>
          </div>
        ) : (
          <div className={styles.authGuidance}>
            <h2>第一次来到紫荆</h2>
            <p>先注册账号，便可查看自己的报名、申请与进群记录。</p>
            <Link href={`/register${onward}`}>创建社团账号 →</Link>
          </div>
        )}
        <div className={styles.authGuidance}>
          <h2>加入游戏社群</h2>
          <p>网站账号用于记录事务。加入微信群需联系社群管理员，由管理员人工邀请。</p>
          <Link href="/events">先浏览日程 →</Link>
        </div>
      </aside>
    </div>
  );
}
