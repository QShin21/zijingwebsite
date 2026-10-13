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
    <div className={`${styles.page} ${styles.staff}`}>
      <nav className={styles.breadcrumbs} aria-label="报名页面导航">
        <Link href="/events">浏览活动</Link>
        <span aria-hidden="true">/</span>
        <span>填写问卷</span>
      </nav>
      <p className={styles.eyebrow}>TAKE PART / ZIJING</p>
      <h1>填写问卷</h1>
      <ActivitySignup kind={kind} id={Number(id)} />
    </div>
  );
}
