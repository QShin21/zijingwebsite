"use client";

import Link from "next/link";
import { PageState } from "@/components/PageState";

export default function CommunityError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageState
      label="SIGNAL LOST · 社群"
      title="社群内容暂时无法加载"
      description="请重试读取。如果刚才提交过申请或处理进度，请先核对本人记录，再决定是否重新提交。"
      alert
      help={
        <>
          <p>重新加载只读取页面内容，不会重复提交申请或审核结果。</p>
          <Link href="/community">返回社群目录</Link>
        </>
      }
    >
      <button className="button" type="button" onClick={retry}>
        重新加载
      </button>
      <Link className="button light" href="/account">
        查看我的事务
      </Link>
    </PageState>
  );
}
