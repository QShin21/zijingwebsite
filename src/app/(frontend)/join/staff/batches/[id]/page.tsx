import { notFound } from "next/navigation";
import Link from "next/link";
import { cms } from "@/lib/content";
import { publicStaffBatch } from "@/lib/staff-recruitment";
import { formatDate } from "@/lib/rules";
import { PageHeading } from "@/components/PageHeading";
import { StaffApplication } from "@/components/StaffApplication";

export default async function Batch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await publicStaffBatch(await cms(), Number(id)).catch(() => null); if (!batch) notFound();
  return <><PageHeading title={batch.title} eyebrow="EXECUTION / PUBLICITY" description={batch.description || "本批次招收执行部及宣传部骨干，具体安排以批次说明为准。"} />
    <section className="member-shell"><p>开始：{formatDate(batch.startAt)} · 截止：{formatDate(batch.endAt)}</p>
      <p>普通入社请选择现有游戏社群或申请组织新社群。</p><Link href="/community">查看游戏社群</Link> · <Link href="/community/apply">申请组织社群</Link>
      <StaffApplication batch={batch.id} />
    </section></>;
}
