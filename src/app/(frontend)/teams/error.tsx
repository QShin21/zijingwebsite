"use client";

import Link from "next/link";
import { PageState } from "@/components/PageState";

export default function TeamError({ retry }: { error?: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageState
      label="SIGNAL LOST · 代表队"
      title="队伍页面暂时无法读取"
      description="请重新读取当前页面。若刚完成提交，可先到本人记录核对结果。"
      alert
      help={
        <>
          <p>重新读取不会重复提交入队申请、荣誉或审核结果。</p>
          <Link href="/teams/honors?view=mine">查看我的荣誉记录</Link>
        </>
      }
    >
      <button className="button" type="button" onClick={() => retry()}>
        重新读取
      </button>
      <Link className="button light" href="/teams/recruitment">
        查看我的入队记录
      </Link>
    </PageState>
  );
}
