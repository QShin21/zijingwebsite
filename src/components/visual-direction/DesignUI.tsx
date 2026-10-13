import Link from "next/link";
import { DesignNavigation } from "./DesignNavigation";
import { BrandMark, Icon } from "@/components/Identity";
import { Picture } from "@/components/Content";
import type { Content } from "@/lib/content";
import { formatDate, routeFor } from "@/lib/rules";

export const designBase = "/design-preview";
export function DesignHeader({
  name,
  signedIn,
}: {
  name: string;
  signedIn: boolean;
}) {
  return (
    <>
      <div className="z-preview-note">
        <span>视觉方向 01 / 紫荆赛场编辑部</span>
        <Link href="/">查看功能基线 ↗</Link>
      </div>
      <header className="z-header">
        <Link href={designBase} className="z-brand">
          <BrandMark />
          <span>
            紫荆电竞<small>ZIJING ESPORTS</small>
            <span className="sr-only">{name}</span>
          </span>
        </Link>
        <DesignNavigation signedIn={signedIn} />
      </header>
    </>
  );
}
export function DesignFooter() {
  return (
    <footer className="z-footer">
      <div className="z-footer-top">
        <div>
          <p className="z-kicker">BEYOND THE SCREEN</p>
          <h2>
            赛场内外，
            <br />
            共同热爱。
          </h2>
        </div>
        <nav aria-label="页脚">
          <Link href="/about">关于紫荆</Link>
          <Link href="/contact">联系与合作</Link>
          <Link href="/privacy">隐私说明</Link>
          <Link href="/account">我的账号</Link>
        </nav>
      </div>
      <div className="z-footer-mark" aria-hidden="true">
        ZIJING<span>↗</span>
      </div>
      <p className="z-footer-bottom">
        原创界面图形与生成主视觉 · 隔离设计预览 · 内容与操作权限沿用功能基线
      </p>
    </footer>
  );
}
export function StageArt({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={"z-stage " + className} aria-hidden="true">
      <picture>
        <source
          media="(max-width:760px)"
          srcSet="/design/zijing-stage-mobile.webp"
        />
        <img
          src="/design/zijing-stage.webp"
          alt=""
          width={1942}
          height={810}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
        />
      </picture>
    </div>
  );
}
export function SectionHeading({
  index,
  en,
  title,
  href,
  action = "查看全部",
}: {
  index: string;
  en: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="z-section-heading">
      <div>
        <p className="z-kicker">
          <span>{index}</span> / {en}
        </p>
        <h2>{title}</h2>
      </div>
      {href && (
        <Link className="z-text-link" href={href}>
          {action} <Icon name="diagonal" />
        </Link>
      )}
    </div>
  );
}
export function DemoTag({ demo }: { demo?: boolean }) {
  return demo ? <span className="z-demo">合成演示 · 非实际安排</span> : null;
}
export function EmptyState({
  title = "新的故事，正在准备。",
  description = "发布后的内容会出现在这里。",
  href,
  action = "返回社群",
}: {
  title?: string;
  description?: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="z-empty">
      <Icon name="layers" />
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="z-text-link" href={href}>
          {action} <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}
export function EventCard({
  doc,
  index = 0,
  collection = "events",
}: {
  doc: Content;
  index?: number;
  collection?: string;
}) {
  const href =
    collection === "events"
      ? designBase + "/activity/" + doc.id
      : "/" + (routeFor[collection] || collection) + "/" + doc.slug;
  return (
    <article className="z-event-card">
      <Link
        className={"z-card-visual z-card-visual-" + (index % 3)}
        href={href}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Picture
          id={doc.cover}
          fallback={
            <>
              <span className="z-card-cross">+</span>
              <span className="z-poster-label">
                {collection === "events" ? "PLAY" : "ZIJING"}
                <br />
                <i>{["TOGETHER", "AS ONE", "YOUR WAY"][index % 3]}</i>
              </span>
              <BrandMark />
            </>
          }
        />
      </Link>
      <div className="z-card-content">
        <div className="z-card-meta">
          <span>
            {doc.type || (collection === "teams" ? "代表队" : "社团活动")}
          </span>
          <span>{doc.startAt ? formatDate(doc.startAt) : "ZIJING / CLUB"}</span>
        </div>
        <DemoTag demo={doc.demo} />
        <h3>
          <Link href={href}>{doc.title}</Link>
        </h3>
        <p>{doc.summary || "查看公开内容，找到你的参与方式。"}</p>
        <Link className="z-card-action" href={href}>
          {collection === "events" ? "活动详情与报名" : "查看详情"}
          <Icon name="diagonal" />
        </Link>
      </div>
    </article>
  );
}
