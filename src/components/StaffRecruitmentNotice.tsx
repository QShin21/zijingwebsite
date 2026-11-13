import Link from "next/link";
import styles from "./activity-pages/Workspace.module.css";
import { cms } from "@/lib/content";
import { currentStaffBatches } from "@/lib/staff-recruitment";
import { staffWindow } from "@/lib/staff-recruitment-model";
import { formatDate } from "@/lib/rules";
import { getT } from "@/lib/i18n/server";
import { accountLabel } from "@/lib/i18n/labels-account";
import { formatDateTime } from "@/components/v2/format";
export async function StaffRecruitmentNotice({
  home = false,
}: {
  home?: boolean;
}) {
  const batches = await currentStaffBatches(await cms());
  if (!batches.length) return null;
  const batch = batches[0];
  const { t, locale } = await getT();
  return (
    <section
      className={`${home ? "home-section" : ""} ${styles.inlineNotice}`}
      data-staff-batch={batch.id}
    >
      <div className={styles.noticeTiming}>
        <span>{t("骨干招新", "Staff recruitment")}</span>
        <strong>{accountLabel(staffWindow(batch), locale)}</strong>
        <span>{t(`截止 ${formatDate(batch.endAt)}`, `Closes ${formatDateTime(batch.endAt, locale)}`)}</span>
      </div>
      <div>
        <h2>{batch.title}</h2>
        {batch.description && (
          <p className={styles.noticeDescription}>{batch.description}</p>
        )}
        <p>
          {t("执行部／宣传部选拔。各游戏社群共用本批次，已提交申请可直接查看本人回执。", "Operations/Publicity selection, shared by all game communities. If you have applied, you can view your receipt directly.")}
        </p>
      </div>
      <Link className="button" href={"/join/staff/batches/" + batch.id}>
        {t("查看招新与本人申请", "View recruitment and my application")}
      </Link>
    </section>
  );
}
