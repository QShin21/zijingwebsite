"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="error-page"><p className="eyebrow">A BRIEF TIMEOUT</p><h1>连接暂时中断</h1><p>内容暂时无法载入。请重试，或返回首页。你的报名是否成功，请以实际受理平台的记录为准。</p><div className="error-actions"><button className="button light" onClick={reset}>重新加载</button><Link className="button" href="/">返回首页</Link></div></section>;
}
