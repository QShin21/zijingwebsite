import Link from "next/link";
import type { ReactNode } from "react";
export function PageHeading({ title, eyebrow, description, parent, children }: { title: string; eyebrow: string; description?: string | null; parent?: { href: string; label: string }; children?: ReactNode }) {
  return <header className="page-head">
    <nav className="breadcrumbs" aria-label="面包屑"><Link href="/">首页</Link><span aria-hidden="true">/</span>{parent ? <><Link href={parent.href}>{parent.label}</Link><span aria-hidden="true">/</span><span>详情</span></> : <span>{title}</span>}</nav>
    <div className="page-head-content"><div><p className="eyebrow"><span className="eyebrow-line" />{eyebrow}</p><h1>{title}</h1>{description && <p className="lead">{description}</p>}{children}</div><span className="page-head-cross" aria-hidden="true">↗</span></div>
  </header>;
}
