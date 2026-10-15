import Link from "next/link";
import Image from "next/image";
import beianIcon from "./beian.png";
import { DesignNavigation } from "./DesignNavigation";
import { BrandMark, Icon } from "@/components/Identity";
import { Picture } from "@/components/Content";
import type { Content } from "@/lib/content";
import { formatDate, routeFor, eventState } from "@/lib/rules";
import type { ThemeName } from "./theme";
import chrome from "./SiteChrome.module.css";

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
      <header className={chrome.header}>
        <div className={chrome.headerInner}>
          <Link
            href={preview ? designBase : "/"}
            prefetch={signedIn ? undefined : false}
            className={chrome.brand}
          >
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
    <footer className={chrome.footer}>
      <div className={chrome.footerTop}>
        <div className={chrome.footerIdentity}>
          <strong>{name}</strong>
          <p>{footer || "在校园里，为共同的热爱相遇。"}</p>
        </div>
        <nav aria-label="页脚" className={chrome.footerNav}>
          <div>
            <p>认识紫荆</p>
            <Link href="/about" prefetch={false}>
              关于社团
            </Link>
            <Link href="/contact" prefetch={false}>
              联系与合作
            </Link>
          </div>
          <div>
            <p>参与与帮助</p>
            <Link href="/account" prefetch={false}>
              个人中心
            </Link>
            <Link href="/privacy" prefetch={false}>
              隐私说明
            </Link>
          </div>
        </nav>
      </div>
      <div className={chrome.footerBottom}>
        <div className={chrome.footerLegal}>
          <p>
            © {new Date().getFullYear()} {name}
          </p>
          <nav aria-label="网站备案" className={chrome.footerRecords}>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
            >
              京ICP备2025135109号-2
            </a>
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=11010802050680"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src={beianIcon}
                alt=""
                width={18}
                height={20}
                unoptimized
              />
              京公网安备11010802050680号
            </a>
          </nav>
        </div>
        {preview && <p>隔离设计预览，内容与权限沿用真实业务</p>}
        <a href={preview ? "#design-main" : "#main"}>
          回到页首 <Icon name="diagonal" />
        </a>
      </div>
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
