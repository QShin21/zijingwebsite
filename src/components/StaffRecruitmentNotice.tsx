import Link from "next/link";
import { cms } from "@/lib/content";
import { currentStaffBatches } from "@/lib/staff-recruitment";
import { staffWindow } from "@/lib/staff-recruitment-model";
import { formatDate } from "@/lib/rules";

export async function StaffRecruitmentNotice({ home = false }: { home?: boolean }) {
  const batches = await currentStaffBatches(await cms());
  if (!batches.length) return null;
  const batch = batches[0];
  return <section className={home ? "home-section" : "panel"} data-staff-batch={batch.id}>
    <p className="eyebrow">STAFF / EXECUTION & PUBLICITY</p><h2>{home ? "社团通知 · 骨干招新" : "骨干招新"} · {batch.title}</h2>
    <p>{batch.description}</p><p>{staffWindow(batch)} · 截止：{formatDate(batch.endAt)}</p>
    <p>执行部/宣传部选拔，与普通入社分开；所有游戏社群共用同一批次及本人申请。</p>
    <Link className="button" href={"/join/staff/batches/" + batch.id}>查看骨干招新与本人申请</Link>
  </section>;
}
