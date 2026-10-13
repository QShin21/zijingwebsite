import Link from "next/link";
import { DesignNavigation } from "./DesignNavigation";
import { BrandMark, Icon } from "@/components/Identity";
import { Picture } from "@/components/Content";
import type { Content } from "@/lib/content";
import { formatDate, routeFor, eventState } from "@/lib/rules";
import type { ThemeName } from "./theme";

export const designBase = "/design-preview";
export function DesignHeader({
  name,
  signedIn,
  navigation,
  preview = true,
  theme = "light",
}: {
  name: string;
  signedIn: boolean;
  navigation?: { path: string; label: string }[];
  preview?: boolean;
  theme?: ThemeName;
}) {
  return (
    <>
      {preview && (
        <div className="z-preview-note">
          <span>紫荆主场 · 设计与交互样张</span>
          <Link href="/">
            返回首页 <Icon name="arrow" />
          </Link>
        </div>
      )}
      <header className="z-header">
        <div className="z-header-inner">
          <Link href={preview ? designBase : "/"} className="z-brand">
            <BrandMark />
            <span>
              {name}
              <small>ZIJING ESPORTS</small>
            </span>
          </Link>
          <DesignNavigation
            signedIn={signedIn}
            navigation={navigation}
            preview={preview}
            theme={theme}
          />
        </div>
      </header>
    </>
  );
}
export function DesignFooter({
  name = "紫荆电竞",
  footer,
  preview = true,
}: { name?: string; footer?: string | null; preview?: boolean } = {}) {
  return (
    <footer className="z-footer">
      <div className="z-footer-top">
        <div>
          <strong>{name}</strong>
          <p>{footer || "在校园里，为共同的热爱相遇。"}</p>
        </div>
        <nav aria-label="页脚">
          <Link href="/about">关于社团</Link>
          <Link href="/contact">联系与合作</Link>
          <Link href="/privacy">隐私说明</Link>
          <Link href="/account">个人中心</Link>
        </nav>
      </div>
      <p className="z-footer-bottom">
        © {new Date().getFullYear()} {name}
        {preview ? " · 隔离设计预览，内容与权限沿用真实业务" : ""}
      </p>
    </footer>
  );
}
export function SectionHeading({
  title,
  href,
  action = "查看全部",
}: {
  index?: string;
  en?: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="z-section-heading">
      <h2>{title}</h2>
      {href && (
        <Link className="z-text-link" href={href}>
          {action} <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}
export function DemoTag({ demo }: { demo?: boolean }) {
  return demo ? <span className="z-demo">合成演示 · 非实际安排</span> : null;
}
export function EmptyState({
  title = "这里暂时没有内容",
  description = "新内容公开后会出现在这里。",
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
  collection = "events",
  preview = true,
  gameTitle,
}: {
  doc: Content;
  index?: number;
  collection?: string;
  preview?: boolean;
  gameTitle?: string;
}) {
  const href =
    collection === "events"
      ? preview
        ? designBase + "/activity/" + doc.id
        : "/events/" + doc.slug
      : "/" + (routeFor[collection] || collection) + "/" + doc.slug;
  const date = doc.startAt || doc.date;
  const isEvent = collection === "events";
  const labels: Record<string, string> = {
    events: "活动",
    teams: "代表队",
    honors: "荣誉档案",
    news: "社团动态",
    albums: "影像",
    recruitment: "招新",
    announcements: "通知",
  };
  return (
    <article
      className={`z-event-card ${isEvent ? "z-event-row" : "z-story-entry"}`}
    >
      {isEvent ? (
        <div className="z-event-date">
          {date ? (
            <time dateTime={date}>{formatDate(date)}</time>
          ) : (
            <span>时间待公布</span>
          )}
          <span>{eventState(doc)}</span>
        </div>
      ) : doc.cover ? (
        <Link
          className="z-story-image"
          href={href}
          tabIndex={-1}
          aria-hidden="true"
        >
          <Picture id={doc.cover} />
        </Link>
      ) : null}
      <div className="z-card-content">
        <div className="z-card-meta">
          <span>{gameTitle || labels[collection] || "社团内容"}</span>
          {!isEvent && date && <time dateTime={date}>{formatDate(date)}</time>}
          {doc.placing && <span>{doc.placing}</span>}
        </div>
        <DemoTag demo={doc.demo} />
        <h3>
          <Link href={href}>{doc.title}</Link>
        </h3>
        <p>
          {doc.summary ||
            (isEvent ? "查看活动安排、参与条件与报名方式。" : "查看完整内容。")}
        </p>
        {isEvent && doc.location && (
          <p className="z-location">{doc.location}</p>
        )}
      </div>
      <Link className="z-card-action" href={href}>
        {isEvent ? "活动详情" : "查看详情"}
        <Icon name="arrow" />
      </Link>
    </article>
  );
}
