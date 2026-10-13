import Link from "next/link";
import { notFound } from "next/navigation";
import { list } from "@/lib/content";
import { formatDate } from "@/lib/rules";
import { ActivitySignup } from "@/components/ActivitySignup";
import { Prose } from "@/components/Content";
import { StageArt, DemoTag } from "@/components/visual-direction/DesignUI";
export default async function ActivityDirection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    n = Number(id);
  if (!Number.isSafeInteger(n) || n < 1) notFound();
  const doc = (await list("events", { id: { equals: n } }, 1, 1)).docs[0];
  if (!doc) notFound();
  return (
    <div className="z-activity">
      <div className="z-flow-breadcrumb">
        <Link href="/design-preview">紫荆</Link>
        <span>/</span>
        <Link href="/events">社团活动</Link>
        <span>/</span>
        <strong>活动详情与报名</strong>
      </div>
      <header className="z-activity-heading">
        <p className="z-kicker">MAKE IT A MOMENT / ZIJING</p>
        <DemoTag demo={doc.demo} />
        <h1>{doc.title}</h1>
        <p>{doc.summary}</p>
        <dl className="z-event-facts">
          <div>
            <dt>活动时间</dt>
            <dd>
              {doc.startAt ? formatDate(doc.startAt) : "以公开活动说明为准"}
            </dd>
          </div>
          <div>
            <dt>活动地点</dt>
            <dd>{doc.location || "以活动说明为准"}</dd>
          </div>
          <div>
            <dt>活动类型</dt>
            <dd>{doc.type || "社团活动"}</dd>
          </div>
        </dl>
      </header>
      <div className="z-activity-grid">
        <section className="z-signup-surface">
          <p className="z-kicker">YOUR PLACE IN THE GAME</p>
          <h2>预留你的参与时刻。</h2>
          <ActivitySignup kind="events" id={doc.id} />
        </section>
        <aside>
          <div className="z-activity-art">
            <StageArt />
            <span aria-hidden="true">
              PLAY
              <br />
              TOGETHER.
            </span>
          </div>
          <section className="z-activity-note">
            <h2>活动说明</h2>
            {doc.body ? (
              <Prose doc={doc} />
            ) : (
              <p>
                请查看已发布的活动信息和报名状态，确认时间与地点后再提交。报名状态、可修改窗口与本人回执由现有服务端判断。
              </p>
            )}
            <Link className="z-text-link" href={"/events/" + doc.slug}>
              查看功能基线详情 ↗
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
