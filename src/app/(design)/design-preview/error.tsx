"use client";
import Link from "next/link";
import { PageState } from "@/components/PageState";
export default function ErrorState({ retry }: { retry: () => void }) {
  return (
    <PageState
      label="设计预览"
      title="内容暂时无法读取"
      description="请检查网络后重试。重新读取会尝试恢复当前预览页面。"
      alert
      help={
        <>
          <p>
            可运行样张和实际页面使用相同的内容与权限。刚提交过资料时，请先核对本人记录。
          </p>
          <Link href="/account">查看本人记录</Link>
        </>
      }
    >
      <button className="z-button" onClick={retry}>
        重新读取
      </button>
      <Link className="z-button z-outline" href="/design-preview">
        返回预览首页
      </Link>
    </PageState>
  );
}
