import Link from "next/link";
import { PageState } from "@/components/PageState";
export default function NotFound() {
  return (
    <PageState
      label="404 · 页面未找到"
      title="暂时找不到这一页"
      description="页面可能已调整，或内容尚未公开。请核对链接，也可以从当前栏目重新查找。"
      help={
        <>
          <p>
            申请与报名可以从个人中心继续查看。需要协助时，可使用社团的联系入口。
          </p>
          <Link href="/account">查看我的事务</Link>
          <Link href="/contact">联系社团</Link>
        </>
      }
    >
      <Link className="z-button" href="/events">
        查看社团活动
      </Link>
      <Link className="z-button z-outline" href="/">
        返回首页
      </Link>
    </PageState>
  );
}
