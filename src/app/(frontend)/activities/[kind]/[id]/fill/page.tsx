import { ActivitySignup } from "@/components/ActivitySignup";
import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "@/components/activity-pages/ActivityPages.module.css";
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (
    !["events", "community-posts"].includes(kind) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  )
    notFound();
  return (
    <div className={`${styles.page} ${styles.staff} ${styles.taskPage}`}>
      <nav className={styles.breadcrumbs} aria-label="报名页面导航">
        <Link href="/events">浏览活动</Link>
        <span aria-hidden="true">/</span>
        <span>填写问卷</span>
      </nav>
      <header className={styles.hero}>
        <div>
          <h1>活动报名与本人回执</h1>
          <p>填写后核对提交，已报名同学可在这里查看记录并按开放规则修改。</p>
        </div>
      </header>
      <ActivitySignup kind={kind} id={Number(id)} />
    </div>
  );
}
