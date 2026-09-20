import Link from "next/link";
export default function NotFound() {
  return <section className="error-page"><div className="error-number" aria-hidden="true">404<span>↗</span></div><p className="eyebrow">OFF THE MAP</p><h1>暂时找不到这一页</h1><p>页面可能已调整，或内容暂未公开。回到首页，也许会有新的发现。</p><div className="error-actions"><Link className="button light" href="/">返回首页</Link><Link className="button" href="/events">查看社团活动</Link></div></section>;
}
