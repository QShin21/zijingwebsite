import Link from "next/link";
import { list } from "@/lib/content";
import {
  SectionHeading,
  EmptyState,
} from "@/components/visual-direction/DesignUI";
import { SystemControls } from "@/components/visual-direction/SystemControls";
import { HomeEntries } from "@/components/visual-direction/HomeSections";
import { PageHeading } from "@/components/PageHeading";

export default async function SystemPage() {
  const [events, games] = await Promise.all([
    list("events", { archived: { not_equals: true } }, 1, 2),
    list("games", {}, 1, 1),
  ]);
  return (
    <div className="z-system">
      <PageHeading
        eyebrow="紫荆主场 · 可运行样张"
        title="共同的热爱，清楚的日常。"
        description="暖色阅读底、中文编辑式标题与真实栏目元信息。活动条目使用当前可公开内容；控件与审核状态为标明用途的交互样例。"
        action={
          <Link className="z-button z-outline" href="/">
            查看真实首页
          </Link>
        }
      >
        <nav className="z-system-index" aria-label="样张目录">
          <a href="#system-reading">颜色与阅读</a>
          <a href="#system-events">活动条目</a>
          <a href="#system-fields">字段与反馈</a>
          <a href="#system-status">审核状态</a>
        </nav>
      </PageHeading>
      <section className="z-system-section" id="system-reading">
        <SectionHeading title="颜色与阅读层级" />
        <div className="z-swatches">
          <div
            className="z-swatch"
            style={{ background: "var(--z-paper)", color: "var(--z-ink)" }}
          >
            <strong>页面与正文</strong>
            <small>paper / ink</small>
          </div>
          <div
            className="z-swatch"
            style={{ background: "var(--z-surface)", color: "var(--z-muted)" }}
          >
            <strong>内容表面与辅助信息</strong>
            <small>surface / muted</small>
          </div>
          <div
            className="z-swatch"
            style={{
              background: "var(--z-action)",
              color: "var(--z-action-ink)",
            }}
          >
            <strong>主要操作</strong>
            <small>action / action-ink</small>
          </div>
          <div
            className="z-swatch"
            style={{ background: "var(--z-tint)", color: "var(--z-action)" }}
          >
            <strong>选中与提示区域</strong>
            <small>tint / action</small>
          </div>
        </div>
      </section>
      <section className="z-system-section" id="system-events">
        <SectionHeading title="活动条目" href="/events" action="全部活动" />
        <div className="z-editorial-list">
          <HomeEntries
            docs={events.docs}
            kind="events"
            games={games.docs}
            preview={false}
          />
          {!events.docs.length && (
            <EmptyState
              title="暂无已公开活动"
              description="活动发布后会按真实对象显示时间和详情入口。"
            />
          )}
        </div>
      </section>
      <section className="z-system-section" id="system-fields">
        <div className="z-sample-layout">
          <div>
            <SectionHeading title="字段与失败反馈" />
            <SystemControls />
          </div>
          <aside className="z-specimen-contact">
            <p className="z-kicker">社群联系入口</p>
            <h2>
              联系管理员，
              <br />
              申请加入微信群
            </h2>
            <p>
              先查看社群介绍，再通过获准展示的微信名片联系管理员。入群由管理员人工完成。
            </p>
            <p className="z-muted">
              查看或保存名片、提交线上意向，都不代表已经加入微信群。
            </p>
            <Link
              className="z-button z-outline"
              href={
                games.docs[0]
                  ? `/community/${games.docs[0].slug}/join`
                  : "/community"
              }
            >
              {games.docs[0] ? "查看该社群联系流程" : "浏览游戏社群"}
            </Link>
          </aside>
        </div>
      </section>
      <section className="z-system-section" id="system-status">
        <SectionHeading title="审核状态样例" />
        <p className="z-muted">
          以下仅展示状态视觉。真实申请状态由服务端返回，并在对应对象页解释下一步。
        </p>
        <div className="z-status-line">
          <span className="z-status" data-state="info">
            已提交，等待审核
          </span>
          <span className="z-status" data-state="warning">
            待补充资料
          </span>
          <span className="z-status" data-state="success">
            审核通过
          </span>
          <span className="z-status" data-state="danger">
            审核未通过
          </span>
        </div>
      </section>
    </div>
  );
}
