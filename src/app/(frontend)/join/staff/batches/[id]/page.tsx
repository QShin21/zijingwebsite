import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { cms } from "@/lib/content";
import {
  ownStaffReceiptHeaders,
  publicStaffBatch,
} from "@/lib/staff-recruitment";
import { formatDate } from "@/lib/rules";
import { staffWindow } from "@/lib/staff-recruitment-model";
import { StaffApplication } from "@/components/StaffApplication";
import styles from "@/components/activity-pages/ActivityPages.module.css";
export default async function Batch({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await cms(),
    batchID = Number(id);
  if (!Number.isSafeInteger(batchID) || batchID <= 0) notFound();
  const batch = await publicStaffBatch(p, batchID).catch(() => null);
  const { user } = await p.auth({ headers: await headers() });
  const receipt = !batch
    ? (await ownStaffReceiptHeaders(p, user, batchID).catch(() => null))
        ?.docs[0]
    : null;
  if (!batch && !receipt) notFound();
  return (
    <div className={`${styles.page} ${styles.staff}`}>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link href="/join/staff">骨干招新</Link>
        <span aria-hidden="true">/</span>
        <span>批次与本人申请</span>
      </nav>
      <header className={styles.readingHeader}>
        <div className={styles.meta}>
          <span>执行部／宣传部</span>
          {batch && (
            <span
              className={styles.status}
              data-open={staffWindow(batch) === "申请开放"}
            >
              {staffWindow(batch)}
            </span>
          )}
        </div>
        <h1>{batch?.title ?? receipt!.batchTitle}</h1>
        <p className={styles.lead}>
          {batch
            ? batch.description ||
              "本批次招收执行部及宣传部骨干，具体安排以批次说明为准。"
            : "批次已撤下，仅可查看回执"}
        </p>
      </header>
      {batch && (
        <section className={styles.batchBrief} aria-label="批次安排">
          <dl className={styles.eventFacts}>
            <div>
              <dt>开放</dt>
              <dd>{formatDate(batch.startAt)}</dd>
            </div>
            <div>
              <dt>截止</dt>
              <dd>{formatDate(batch.endAt)}</dd>
            </div>
          </dl>
          <p>开放期间可修改、撤回或重提；截止后保留本人回执。</p>
          <a className={styles.textAction} href="#staff-application">
            前往申请与本人回执
          </a>
        </section>
      )}
      <StaffApplication batch={batchID} />
      <footer className={styles.related}>
        <h2>其他参与方式</h2>
        <p>日常交流与活动可从游戏社群开始。</p>
        <div className="signup-tools">
          <Link href="/community">查看游戏社群</Link>
          <Link href="/community/apply">申请组织社群</Link>
          <Link href="/join/staff">返回骨干批次与本人回执</Link>
        </div>
      </footer>
    </div>
  );
}
