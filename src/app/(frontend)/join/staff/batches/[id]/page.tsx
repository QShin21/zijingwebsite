import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { cms } from "@/lib/content";
import {
  ownStaffReceiptHeaders,
  publicStaffBatch,
} from "@/lib/staff-recruitment";
import { formatDate } from "@/lib/rules";
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
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>执行部 · 宣传部</p>
          <h1>{batch?.title ?? receipt!.batchTitle}</h1>
          <p>
            {batch
              ? batch.description ||
                "本批次招收执行部及宣传部骨干，具体安排以批次说明为准。"
              : "批次已撤下，仅可查看回执"}
          </p>
        </div>
      </header>
      <section className="member-shell">
        {batch && (
          <p>
            开始：{formatDate(batch.startAt)} · 截止：{formatDate(batch.endAt)}
          </p>
        )}
        <p>普通入社请选择现有游戏社群或申请组织新社群。</p>
        <Link href="/community">查看游戏社群</Link> ·{" "}
        <Link href="/community/apply">申请组织社群</Link>
        <p>
          <Link href="/join/staff">查看骨干批次与本人回执</Link>
        </p>
        <StaffApplication batch={batchID} />
      </section>
    </div>
  );
}
