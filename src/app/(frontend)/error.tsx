"use client";
import Link from "next/link";
import { PageState } from "@/components/PageState";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageState
      label="SIGNAL LOST · 暂时无法显示"
      title="内容未能载入"
      description="请检查网络后重新加载。如果刚刚提交过报名或申请，请先在「我的」核对实际结果。"
      alert
      help={
        <>
          <p>重新加载会读取页面内容。提交结果暂时不明时，请先核对记录，避免重复提交。</p>
          <Link href="/events">查看日程</Link>
        </>
      }
    >
      <button type="button" className="button" onClick={retry}>
        重新加载
      </button>
      <Link className="button light" href="/account">
        查看本人记录
      </Link>
    </PageState>
  );
}
