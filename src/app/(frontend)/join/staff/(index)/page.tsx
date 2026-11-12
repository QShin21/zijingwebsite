import Link from "next/link";
import { headers } from "next/headers";
import { cms, fixed, list } from "@/lib/content";
import { Prose, Cards } from "@/components/Content";
import { formatDate, relationID } from "@/lib/rules";
import { staffStatusLabels, staffWindow } from "@/lib/staff-recruitment-model";
import { ownStaffBatchIDs, ownStaffReceiptHeaders } from "@/lib/staff-recruitment";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { ButtonLink, EmptyState, Pager, Section, StatusPill } from "@/components/v2/ui";
import { deadlineText } from "@/components/v2/format";
import layout from "@/components/v2/layout.module.css";
import styles from "./staff.module.css";

export const metadata = { title: "骨干招新" };

export default async function Staff({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const p = await cms(),
    intro = await fixed("join-staff"),
    legacy = await list("recruitment", { kind: { equals: "staff" } });
  const { user } = await p.auth({ headers: await headers() }),
    query = await searchParams;
  const receipts = await ownStaffReceiptHeaders(p, user, undefined, Math.max(1, Math.min(10000, Number(query.page) || 1)));
  const batches = await p.find({
    collection: "staff-batches",
    user: null,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    sort: "-createdAt",
    select: { title: true, description: true, state: true, startAt: true, endAt: true, signupForm: true },
  });
  const ownBatches = await ownStaffBatchIDs(p, user, batches.docs.map(batch => batch.id));
  const hasReceipts = Boolean(receipts && receipts.totalDocs > 0);
  return (
    <TaskFrame
      title="骨干招新"
      description="执行部与宣传部招新，职责和申请条件见各批次说明"
      back={{ href: "/join", label: "加入紫荆" }}
      steps={["阅读批次", "填写申请", "核对提交", "查看回执"]}
      actions={
        <ButtonLink href={hasReceipts ? "#my-staff-receipts" : "#staff-batches"} tone="accent" icon="arrow">
          {hasReceipts ? "查看本人申请" : "查看招新批次"}
        </ButtonLink>
      }
      aside={
        <>
          <TaskNote title="如何参与选拔">
            <p>提交前核对职责和开放时间，提交后可在本人回执查看反馈。</p>
            <p>普通成员录用后自动获得骨干身份。</p>
          </TaskNote>
          <TaskNote title="还有其他参与方式" links={[{ href: "/community", label: "加入现有游戏社群" }, { href: "/community/apply", label: "申请组织新社群" }]}>
            <p>社群、代表队与骨干工作分别申请、分别记录。</p>
          </TaskNote>
        </>
      }
    >
      {receipts && hasReceipts && (
        <section id="my-staff-receipts" className={styles.block} aria-labelledby="my-staff-title">
          <div className={styles.blockHead}>
            <h2 id="my-staff-title">我的骨干申请</h2>
            <p>批次撤下后仍可查看本人回执。</p>
          </div>
          <ul className={styles.receipts}>
            {receipts.docs.map((receipt) => (
              <li key={receipt.id} className={styles.receipt} data-staff-receipt={receipt.id}>
                <div className={styles.receiptTop}>
                  <StatusPill tone="action">{staffStatusLabels[receipt.status]}</StatusPill>
                  <span className={styles.muted}>申请编号 {receipt.id}</span>
                </div>
                <h3>
                  <Link href={"/join/staff/batches/" + relationID(receipt.batch)}>{receipt.batchTitle}</Link>
                </h3>
                <p className={styles.muted}>最近更新 {formatDate(receipt.updatedAt)}</p>
                <Link className={styles.action} href={"/join/staff/batches/" + relationID(receipt.batch)}>
                  查看本人回执 →
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={receipts.page ?? 1} totalPages={receipts.totalPages} path="/join/staff" />
        </section>
      )}
      <section id="staff-batches" className={styles.block} aria-labelledby="staff-batches-title">
        <div className={styles.blockHead}>
          <h2 id="staff-batches-title">骨干招新批次</h2>
        </div>
        {!batches.docs.length ? (
          <EmptyState
            title="暂无已发布的骨干批次"
            icon="flag"
            actions={
              <ButtonLink href="/community" tone="ghost" size="small">
                查看游戏社群
              </ButtonLink>
            }
          >
            可先加入游戏社群，参与活动。
          </EmptyState>
        ) : (
          <div className={layout.grid2}>
            {batches.docs.map((batch) => {
              const own = ownBatches.has(String(batch.id));
              const batchState = staffWindow(batch);
              const open = batchState === "申请开放";
              return (
                <article key={batch.id} className={styles.batch} data-open={open || undefined}>
                  <div className={styles.batchTop}>
                    <StatusPill tone={open ? "success" : "neutral"}>{batchState}</StatusPill>
                    {own && <StatusPill tone="action">已有本人申请</StatusPill>}
                  </div>
                  <h3>
                    <Link href={"/join/staff/batches/" + batch.id} className={styles.stretch}>
                      {batch.title}
                    </Link>
                  </h3>
                  {batch.description && <p className={`preserve ${styles.description}`}>{batch.description}</p>}
                  <p className={styles.deadline}>
                    <span>截止</span>
                    {batch.endAt ? (open ? deadlineText(batch.endAt) : formatDate(batch.endAt)) : "以批次说明为准"}
                  </p>
                  <span className={styles.action}>{own ? "查看本人申请" : "查看批次与申请入口"} →</span>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {intro && (
        <Section id="staff-about" title="关于骨干工作">
          <div className={layout.panel}>
            <Prose doc={intro} />
          </div>
        </Section>
      )}
      {legacy.docs.length > 0 && (
        <Section id="staff-history" title="历史招新资料">
          <Cards docs={legacy.docs} collection="recruitment" />
        </Section>
      )}
    </TaskFrame>
  );
}
