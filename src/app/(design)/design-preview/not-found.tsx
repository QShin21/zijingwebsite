import Link from "next/link";
import { PageState } from "@/components/PageState";
export default function Missing() {
  return (
    <PageState
      label="404 · 设计预览"
      title="这里还没有公开内容"
      description="内容可能尚未发布或已撤下，请从当前可用入口继续浏览。"
      help={
        <>
          <p>
            设计系统样张展示共用颜色、阅读层级、表单与反馈。具体业务内容仍需当前账号具备访问权限。
          </p>
          <Link href="/design-preview/system">查看设计系统样张</Link>
        </>
      }
    >
      <Link className="button" href="/design-preview">
        返回预览首页
      </Link>
    </PageState>
  );
}
