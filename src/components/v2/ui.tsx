import Link from "next/link";
import type { ReactNode } from "react";
import type { CommunityRef, ImageRef } from "@/lib/v2";
import { Icon, type IconName } from "./Icon";
import { hueStyle, initial } from "./format";
import styles from "./ui.module.css";

type Width = "max" | "workspace" | "form" | "reading";
export function Wrap({ children, width = "max", className }: { children: ReactNode; width?: Width; className?: string }) {
  return <div className={[styles.wrap, styles[width], className].filter(Boolean).join(" ")}>{children}</div>;
}

/** Inner-page header. "stage" tone renders the dark broadcast band. */
export function PageHero({
  title,
  eyebrow,
  description,
  actions,
  back,
  tone = "plain",
  meta,
  children,
  hue,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  tone?: "plain" | "stage";
  meta?: ReactNode;
  children?: ReactNode;
  hue?: number;
}) {
  return (
    <header
      className={tone === "stage" ? styles.heroStage : styles.hero}
      style={hue !== undefined ? hueStyle(hue) : undefined}
      data-hue={hue !== undefined || undefined}
    >
      <div className={styles.heroInner}>
        {back && (
          <nav aria-label="面包屑" className={styles.crumbs}>
            <Link href={back.href} className={styles.back}>
              <Icon name="back" size={16} />
              {back.label}
            </Link>
          </nav>
        )}
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <div className={styles.heroRow}>
          <div className={styles.heroText}>
            <h1>{title}</h1>
            {description && <p className={styles.heroDescription}>{description}</p>}
            {meta && <div className={styles.heroMeta}>{meta}</div>}
          </div>
          {actions && <div className={styles.heroActions}>{actions}</div>}
        </div>
        {children}
      </div>
    </header>
  );
}

export function Section({
  id,
  title,
  more,
  count,
  children,
  description,
  className,
}: {
  id: string;
  title: ReactNode;
  more?: { href: string; label: string };
  count?: number | null;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={[styles.section, className].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={`${id}-title`}>
            {title}
            {typeof count === "number" && count > 0 && <span className={styles.count}>{count}</span>}
          </h2>
          {description && <p className={styles.sectionDescription}>{description}</p>}
        </div>
        {more && (
          <Link href={more.href} className={styles.more}>
            {more.label}
            <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

type ButtonTone = "primary" | "accent" | "ghost" | "stage" | "danger";
export function ButtonLink({
  href,
  children,
  tone = "primary",
  icon,
  size,
  prefetch,
  external,
}: {
  href: string;
  children: ReactNode;
  tone?: ButtonTone;
  icon?: IconName;
  size?: "small";
  prefetch?: boolean;
  external?: boolean;
}) {
  const className = [styles.button, styles[tone], size === "small" ? styles.small : ""].join(" ");
  const content = (
    <>
      {children}
      {icon && <Icon name={icon} size={18} />}
    </>
  );
  return external ? (
    <a href={href} className={className} rel="noopener noreferrer" target="_blank">
      {content}
    </a>
  ) : (
    <Link href={href} className={className} prefetch={prefetch}>
      {content}
    </Link>
  );
}
export function buttonClass(tone: ButtonTone = "primary", size?: "small") {
  return [styles.button, styles[tone], size === "small" ? styles.small : ""].join(" ");
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "action" }) {
  return <span className={`${styles.chip} ${styles[`chip_${tone}`]}`}>{children}</span>;
}
export function CommunityChip({ community, link = false }: { community: CommunityRef; link?: boolean }) {
  const content = (
    <>
      <span className={styles.chipDot} aria-hidden="true" />
      {community.title}
    </>
  );
  return link ? (
    <Link href={`/community/${community.slug}`} className={styles.communityChip} style={hueStyle(community.hue)}>
      {content}
    </Link>
  ) : (
    <span className={styles.communityChip} style={hueStyle(community.hue)}>
      {content}
    </span>
  );
}

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "live" | "action";
export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`${styles.pill} ${styles[`pill_${tone}`]}`}>
      <span className={styles.pillDot} aria-hidden="true" />
      {children}
    </span>
  );
}
export function DemoPill() {
  return <span className={`${styles.pill} ${styles.pill_warning}`}>演示资料</span>;
}

export function EmptyState({
  title,
  children,
  actions,
  icon = "spark",
  compact,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  compact?: boolean;
}) {
  return (
    <div className={compact ? `${styles.empty} ${styles.emptyCompact}` : styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      {children && <div className={styles.emptyBody}>{children}</div>}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </div>
  );
}

export function ErrorState({ message, retryHref }: { message: string; retryHref?: string }) {
  return (
    <div className={styles.error} role="alert">
      <Icon name="close" size={20} />
      <div>
        <strong>{message}</strong>
        <p>如刚提交过资料，请到「我的」核对记录。</p>
      </div>
      {retryHref && (
        <Link href={retryHref} className={buttonClass("ghost", "small")}>
          重新加载
        </Link>
      )}
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  path,
  query = {},
}: {
  page: number;
  totalPages: number;
  path: string;
  query?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    if (target > 1) params.set("page", String(target));
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  };
  return (
    <nav className={styles.pager} aria-label="分页">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={buttonClass("ghost", "small")}>
          <Icon name="back" size={16} />
          上一页
        </Link>
      ) : (
        <span />
      )}
      <span className={styles.pagerStatus}>
        第 <strong>{page}</strong> / {totalPages} 页
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={buttonClass("ghost", "small")}>
          下一页
          <Icon name="arrow" size={16} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export type TabItem = { href: string; label: string; current: boolean; count?: number | null };
export function LinkTabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined} className={styles.tab} scroll={false}>
          {item.label}
          {typeof item.count === "number" && item.count > 0 && <span className={styles.tabCount}>{item.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function LoginWall({ title, children, returnTo }: { title: string; children?: ReactNode; returnTo: string }) {
  const query = `?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div className={styles.wall}>
      <span className={styles.wallIcon} aria-hidden="true">
        <Icon name="lock" size={26} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      <div className={styles.emptyActions}>
        <ButtonLink href={`/login${query}`} icon="login">
          登录
        </ButtonLink>
        <ButtonLink href={`/register${query}`} tone="ghost">
          注册账号
        </ButtonLink>
      </div>
    </div>
  );
}

export function Img({
  image,
  className,
  sizes,
  eager,
  alt,
}: {
  image: ImageRef;
  className?: string;
  sizes?: string;
  eager?: boolean;
  alt?: string;
}) {
  // Versioned same-origin image endpoint: plain <img> with intrinsic size, lazy by default.
  return (
    <img
      src={image.src}
      alt={alt ?? image.alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}

export function Avatar({ name, image, size = 40 }: { name: string; image?: ImageRef | null; size?: number }) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {image ? <Img image={image} alt="" /> : initial(name)}
    </span>
  );
}
export function AvatarStack({ people, total }: { people: { name: string; avatar: ImageRef | null }[]; total?: number }) {
  if (!people.length) return null;
  const rest = (total ?? people.length) - people.length;
  return (
    <span className={styles.stack} aria-label={`公开队员 ${total ?? people.length} 位`}>
      {people.map((person, index) => (
        <span key={`${person.name}-${index}`} title={person.name}>
          <Avatar name={person.name} image={person.avatar} size={32} />
        </span>
      ))}
      {rest > 0 && <span className={styles.stackMore}>+{rest}</span>}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "success" | "danger"; children: ReactNode }) {
  return (
    <div className={`${styles.notice} ${styles[`notice_${tone}`]}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function KeyValues({ items }: { items: { label: string; value: ReactNode }[] }) {
  const visible = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (!visible.length) return null;
  return (
    <dl className={styles.kv}>
      {visible.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
