import Link from "next/link";
import { headers } from "next/headers";
import { cms, fixed, list } from "@/lib/content";
import { Prose, Cards, Pagination } from "@/components/Content";
import { EmptyState } from "@/components/activity-pages/PublicPages";
import styles from "@/components/activity-pages/ActivityPages.module.css";
import { formatDate, relationID } from "@/lib/rules";
import { staffStatusLabels, staffWindow } from "@/lib/staff-recruitment-model";
import { ownStaffReceiptHeaders } from "@/lib/staff-recruitment";
export default async function Staff({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await cms(),
    intro = await fixed("join-staff"),
    legacy = await list("recruitment", { kind: { equals: "staff" } });
  const { user } = await p.auth({ headers: await headers() }),
    query = await searchParams;
  const receipts = await ownStaffReceiptHeaders(
    p,
    user,
    undefined,
    Math.max(1, Math.min(10000, Number(query.page) || 1)),
  );
  const batches = await p.find({
    collection: "staff-batches",
    user: null,
    overrideAccess: false,
    depth: 0,
    limit: 20,
    sort: "-createdAt",
    select: {
      title: true,
      description: true,
      state: true,
      startAt: true,
      endAt: true,
      signupForm: true,
    },
  });
  return (
    <div className={`${styles.page} ${styles.staff}`}>
      <nav className={styles.breadcrumbs} aria-label="面包屑">
        <Link href="/join">参与紫荆</Link>
        <span aria-hidden="true">/</span>
        <span>骨干招新</span>
      </nav>
      <header className={styles.hero}>
        <div>
          <h1>一起把活动办起来</h1>
          <p>
            执行部／宣传部骨干招新。参与活动执行与社团宣传，具体职责、条件和时间安排以每个批次的说明为准。
          </p>
        </div>
        <a
          className={styles.primary}
          href={
            receipts && receipts.totalDocs > 0
              ? "#my-staff-receipts"
              : "#staff-batches"
          }
        >
          {receipts && receipts.totalDocs > 0 ? "查看本人申请" : "查看招新批次"}
        </a>
      </header>
      <div className={styles.staffLayout}>
        <div className={styles.staffMain}>
          {receipts && receipts.totalDocs > 0 && (
            <section id="my-staff-receipts" className={styles.staffSection}>
              <h2>我的骨干申请</h2>
              <p className={styles.supportText}>
                查看已提交的资料、处理反馈和结果。原批次撤下后，本人回执仍可从这里打开。
              </p>
              <div className={styles.staffRecords}>
                {receipts.docs.map((receipt) => (
                  <article
                    className={styles.staffRecord}
                    key={receipt.id}
                    data-staff-receipt={receipt.id}
                  >
                    <div>
                      <div className={styles.meta}>
                        <span className={styles.status}>
                          {staffStatusLabels[receipt.status]}
                        </span>
                        <span>申请编号 {receipt.id}</span>
                      </div>
                      <h3>
                        <Link
                          href={
                            "/join/staff/batches/" + relationID(receipt.batch)
                          }
                        >
                          {receipt.batchTitle}
                        </Link>
                      </h3>
                      <p>最近更新 {formatDate(receipt.updatedAt)}</p>
                    </div>
                    <Link
                      className={styles.textAction}
                      href={"/join/staff/batches/" + relationID(receipt.batch)}
                    >
                      查看本人回执
                    </Link>
                  </article>
                ))}
              </div>
              <Pagination
                page={receipts.page ?? 1}
                total={receipts.totalPages}
                path="/join/staff"
              />
            </section>
          )}
          <section id="staff-batches" className={styles.staffSection}>
            <h2>骨干招新批次</h2>
            {!batches.docs.length && (
              <EmptyState title="暂无已发布的骨干批次">
                <p>
                  新的选拔安排发布后会在这里展示。你可以先加入游戏社群，参与社团活动。
                </p>
                <Link className="button" href="/community">
                  查看游戏社群
                </Link>
              </EmptyState>
            )}
            <div className={styles.staffRecords}>
              {batches.docs.map((batch) => {
                const own = receipts?.docs.some(
                  (receipt) =>
                    String(relationID(receipt.batch)) === String(batch.id),
                );
                return (
                  <article className={styles.staffRecord} key={batch.id}>
                    <div>
                      <div className={styles.meta}>
                        <span
                          className={styles.status}
                          data-open={staffWindow(batch) === "申请开放"}
                        >
                          {staffWindow(batch)}
                        </span>
                        <span>截止 {formatDate(batch.endAt)}</span>
                      </div>
                      <h3>
                        <Link href={"/join/staff/batches/" + batch.id}>
                          {batch.title}
                        </Link>
                      </h3>
                      {batch.description && (
                        <p className="preserve">{batch.description}</p>
                      )}
                    </div>
                    <Link
                      className={styles.textAction}
                      href={"/join/staff/batches/" + batch.id}
                    >
                      {own ? "查看本人申请" : "查看批次与申请入口"}
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
          {intro && (
            <section className={styles.staffSection}>
              <h2>关于骨干工作</h2>
              <Prose doc={intro} />
            </section>
          )}
          {legacy.docs.length > 0 && (
            <section className={styles.staffSection}>
              <h2>历史招新资料</h2>
              <p className={styles.supportText}>
                既有外部批次与历史资料，保留原报名详情入口。
              </p>
              <Cards docs={legacy.docs} collection="recruitment" />
            </section>
          )}
        </div>
        <aside className={styles.staffAside} aria-label="申请流程与参与方式">
          <section className={styles.factPanel}>
            <h2>如何参与选拔</h2>
            <ol>
              <li>阅读批次说明，核对职责和开放时间。</li>
              <li>填写申请，核对后提交同一份资料。</li>
              <li>查看本人回执，按负责人反馈补充。</li>
            </ol>
            <p className={styles.supportText}>
              录用结果与账号角色任命分别处理。
            </p>
          </section>
          <section>
            <h2 className={styles.sectionTitle}>还有其他参与方式</h2>
            <p>
              <Link href="/community">加入现有游戏社群</Link>
            </p>
            <p>
              <Link href="/community/apply">申请组织新社群</Link>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
