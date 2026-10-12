import Link from "next/link";
import { headers } from "next/headers";
import { cms, fixed, list } from "@/lib/content";
import { Prose, Cards, Pagination } from "@/components/Content";
import { PageHeading } from "@/components/PageHeading";
import { formatDate, relationID } from "@/lib/rules";
import { staffStatusLabels, staffWindow } from "@/lib/staff-recruitment-model";
import { ownStaffReceiptHeaders } from "@/lib/staff-recruitment";

export default async function Staff({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const p = await cms(), intro = await fixed("join-staff"), legacy = await list("recruitment", { kind: { equals: "staff" } });
  const { user } = await p.auth({ headers: await headers() }), query = await searchParams;
  const receipts = await ownStaffReceiptHeaders(p, user, undefined, Math.max(1, Math.min(10000, Number(query.page) || 1)));
  const batches = await p.find({ collection: "staff-batches", user: null, overrideAccess: false, depth: 0, limit: 20, sort: "-createdAt",
    select: { title: true, description: true, state: true, startAt: true, endAt: true, signupForm: true } });
  return <><PageHeading title="执行部 / 宣传部骨干招新" eyebrow="STAFF RECRUITMENT" description="参与执行与宣传工作。这是骨干选拔，普通入社继续使用游戏社群路径。" />
    <section className="member-shell"><p><Link href="/community">加入现有游戏社群</Link> · <Link href="/community/apply">申请组织新社群</Link></p>{intro && <Prose doc={intro} />}
      <h2>骨干招新批次</h2>{!batches.docs.length && <p>暂无已发布的骨干批次。普通入社可继续查看游戏社群。</p>}
      <div className="community-list">{batches.docs.map(batch => <article className="panel" key={batch.id}><h3><Link href={"/join/staff/batches/" + batch.id}>{batch.title}</Link></h3>
        <p>{batch.description}</p><p>{staffWindow(batch)} · 截止：{formatDate(batch.endAt)}</p><Link href={"/join/staff/batches/" + batch.id}>查看批次与本人申请 ↗</Link></article>)}</div>
      {receipts && receipts.totalDocs > 0 && <><h2>我的骨干申请回执</h2><p>已提交记录保留原批次标题；批次撤下后仍可从此查看本人回执。</p>
        <div className="community-list">{receipts.docs.map(receipt => <article className="panel" key={receipt.id} data-staff-receipt={receipt.id}>
          <h3><Link href={"/join/staff/batches/" + relationID(receipt.batch)}>{receipt.batchTitle}</Link></h3>
          <p>{staffStatusLabels[receipt.status]} · 申请编号 {receipt.id} · {formatDate(receipt.updatedAt)}</p>
          <Link href={"/join/staff/batches/" + relationID(receipt.batch)}>查看本人回执 ↗</Link>
        </article>)}</div><Pagination page={receipts.page ?? 1} total={receipts.totalPages} path="/join/staff" /></>}
      {legacy.docs.length > 0 && <><h2>招新批次与历史记录</h2><p>既有外部批次与历史资料，保留原报名详情入口。</p><Cards docs={legacy.docs} collection="recruitment" /></>}
    </section></>;
}
