import Link from "next/link";
import { headers } from "next/headers";
import { cms, fixed, list } from "@/lib/content";
import { Prose, Cards } from "@/components/Content";
import { formatDate, relationID } from "@/lib/rules";
import { staffStatusLabels, staffWindow } from "@/lib/staff-recruitment-model";
import { ownStaffReceiptHeaders } from "@/lib/staff-recruitment";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { ButtonLink, EmptyState, Pager, Section, StatusPill } from "@/components/v2/ui";
import { deadlineText, formatDateTime as formatLocaleDateTime } from "@/components/v2/format";
import { getT } from "@/lib/i18n/server";
import { accountLabel, keyedLabel, staffStatusLabelsEn } from "@/lib/i18n/labels-account";
import layout from "@/components/v2/layout.module.css";
import styles from "./staff.module.css";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("骨干招新", "Staff recruitment") };
}

export default async function Staff({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { t, locale } = await getT();
  const date = (value?: string | null) => (locale === "en" ? formatLocaleDateTime(value, locale) : formatDate(value));
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
  const hasReceipts = Boolean(receipts && receipts.totalDocs > 0);
  return (
    <TaskFrame
      eyebrow={t("STAFF · 骨干招新", "STAFF")}
      title={t("一起把活动办起来", "Help us run the club")}
      description={t("执行部／宣传部骨干招新。参与活动执行与社团宣传，具体职责、条件和时间安排以每个批次的说明为准。", "Operations and Publicity staff recruitment. Help run events and promote the club; duties, requirements and timing follow each batch's notes.")}
      back={{ href: "/join", label: t("加入紫荆", "Join Zijing") }}
      steps={[t("阅读批次", "Read batch"), t("填写申请", "Fill in"), t("核对提交", "Review & submit"), t("查看回执", "View receipt")]}
      actions={
        <ButtonLink href={hasReceipts ? "#my-staff-receipts" : "#staff-batches"} tone="accent" icon="arrow">
          {hasReceipts ? t("查看本人申请", "View my application") : t("查看招新批次", "View batches")}
        </ButtonLink>
      }
      aside={
        <>
          <TaskNote title={t("如何参与选拔", "How selection works")}>
            <ol>
              <li>{t("阅读批次说明，核对职责和开放时间。", "Read the batch notes and check duties and dates.")}</li>
              <li>{t("填写申请，核对后提交同一份资料。", "Fill in the application, review and submit.")}</li>
              <li>{t("查看本人回执，按负责人反馈补充。", "Check your receipt and respond to feedback.")}</li>
            </ol>
            <p>{t("普通成员录用后自动获得骨干身份。", "Accepted members get the staff role automatically.")}</p>
          </TaskNote>
          <TaskNote title={t("还有其他参与方式", "Other ways to take part")} links={[{ href: "/community", label: t("加入现有游戏社群", "Join a game community") }, { href: "/community/apply", label: t("申请组织新社群", "Apply to start a community") }]}>
            <p>{t("社群、代表队与骨干工作分别申请、分别记录。", "Communities, teams and staff roles are applied for and recorded separately.")}</p>
          </TaskNote>
        </>
      }
    >
      {receipts && hasReceipts && (
        <section id="my-staff-receipts" className={styles.block} aria-labelledby="my-staff-title">
          <div className={styles.blockHead}>
            <h2 id="my-staff-title">{t("我的骨干申请", "My staff applications")}</h2>
            <p>{t("查看已提交的资料、处理反馈和结果。原批次撤下后，本人回执仍可从这里打开。", "See your answers, feedback and results. Receipts stay available here even after a batch is taken down.")}</p>
          </div>
          <ul className={styles.receipts}>
            {receipts.docs.map((receipt) => (
              <li key={receipt.id} className={styles.receipt} data-staff-receipt={receipt.id}>
                <div className={styles.receiptTop}>
                  <StatusPill tone="action">{keyedLabel(locale, receipt.status, staffStatusLabelsEn, staffStatusLabels[receipt.status])}</StatusPill>
                  <span className={styles.muted}>{t(`申请编号 ${receipt.id}`, `Application #${receipt.id}`)}</span>
                </div>
                <h3>
                  <Link href={"/join/staff/batches/" + relationID(receipt.batch)}>{receipt.batchTitle}</Link>
                </h3>
                <p className={styles.muted}>{t(`最近更新 ${formatDate(receipt.updatedAt)}`, `Updated ${date(receipt.updatedAt)}`)}</p>
                <Link className={styles.action} href={"/join/staff/batches/" + relationID(receipt.batch)}>
                  {t("查看本人回执 →", "View my receipt →")}
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={receipts.page ?? 1} totalPages={receipts.totalPages} path="/join/staff" />
        </section>
      )}
      <section id="staff-batches" className={styles.block} aria-labelledby="staff-batches-title">
        <div className={styles.blockHead}>
          <h2 id="staff-batches-title">{t("骨干招新批次", "Recruitment batches")}</h2>
        </div>
        {!batches.docs.length ? (
          <EmptyState
            title={t("暂无已发布的骨干批次", "No published batches")}
            icon="flag"
            actions={
              <ButtonLink href="/community" tone="ghost" size="small">
                {t("查看游戏社群", "Browse game communities")}
              </ButtonLink>
            }
          >
            {t("新的选拔安排发布后会在这里展示。你可以先加入游戏社群，参与社团活动。", "New batches will appear here. Meanwhile, join a game community and take part in club events.")}
          </EmptyState>
        ) : (
          <div className={layout.grid2}>
            {batches.docs.map((batch) => {
              const own = receipts?.docs.some((receipt) => String(relationID(receipt.batch)) === String(batch.id));
              const batchState = staffWindow(batch);
              const open = batchState === "申请开放";
              return (
                <article key={batch.id} className={styles.batch} data-open={open || undefined}>
                  <div className={styles.batchTop}>
                    <StatusPill tone={open ? "success" : "neutral"}>{accountLabel(batchState, locale)}</StatusPill>
                    {own && <StatusPill tone="action">{t("已有本人申请", "Applied")}</StatusPill>}
                  </div>
                  <h3>
                    <Link href={"/join/staff/batches/" + batch.id} className={styles.stretch}>
                      {batch.title}
                    </Link>
                  </h3>
                  {batch.description && <p className={`preserve ${styles.description}`}>{batch.description}</p>}
                  <p className={styles.deadline}>
                    <span>{t("截止", "Deadline")}</span>
                    {batch.endAt ? (open ? deadlineText(batch.endAt, new Date(), locale) : date(batch.endAt)) : t("以批次说明为准", "See batch notes")}
                  </p>
                  <span className={styles.action}>{own ? t("查看本人申请", "View my application") : t("查看批次与申请入口", "View batch and apply")} →</span>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {intro && (
        <Section id="staff-about" title={t("关于骨干工作", "About staff work")}>
          <div className={layout.panel}>
            <Prose doc={intro} />
          </div>
        </Section>
      )}
      {legacy.docs.length > 0 && (
        <Section id="staff-history" title={t("历史招新资料", "Past recruitment")} description={t("既有外部批次与历史资料，保留原报名详情入口。", "Earlier external batches and records, with their original sign-up pages.")}>
          <Cards docs={legacy.docs} collection="recruitment" />
        </Section>
      )}
    </TaskFrame>
  );
}
