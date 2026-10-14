import Link from "next/link";
import styles from "./activity-pages/Workspace.module.css";
import { cms } from "@/lib/content";
import { currentStaffBatches } from "@/lib/staff-recruitment";
import { staffWindow } from "@/lib/staff-recruitment-model";
import { formatDate } from "@/lib/rules";
export async function StaffRecruitmentNotice({
  home = false,
}: {
  home?: boolean;
}) {
  const batches = await currentStaffBatches(await cms());
  if (!batches.length) return null;
  const batch = batches[0];
  return (
    <section
      className={`${home ? "home-section" : ""} ${styles.inlineNotice}`}
      data-staff-batch={batch.id}
    >
      <div className={styles.noticeTiming}>
        <span>骨干招新</span>
        <strong>{staffWindow(batch)}</strong>
        <span>截止 {formatDate(batch.endAt)}</span>
      </div>
      <div>
        <h2>{batch.title}</h2>
        {batch.description && (
          <p className={styles.noticeDescription}>{batch.description}</p>
        )}
        <p>
          执行部／宣传部选拔。各游戏社群共用本批次，已提交申请可直接查看本人回执。
        </p>
      </div>
      <Link className="button" href={"/join/staff/batches/" + batch.id}>
        查看招新与本人申请
      </Link>
    </section>
  );
}
