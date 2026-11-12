"use client";
import Link from "next/link";
import { PageState } from "@/components/PageState";

export default function ErrorState({ retry }: { retry: () => void }) {
  return (
    <PageState
      label="V2 样张"
      title="内容暂时无法读取"
      description="请检查网络后重试。重新读取会尝试恢复当前样张页面。"
      alert
      help={
        <>
          <p>样张不读取或保存任何业务资料。刚提交过资料时，请到实际页面核对本人记录。</p>
          <Link href="/account">查看本人记录</Link>
        </>
      }
    >
      <button type="button" className="button" onClick={retry}>
        重新读取
      </button>
      <Link className="button light" href="/design-preview">
        返回样张首页
      </Link>
    </PageState>
  );
}
