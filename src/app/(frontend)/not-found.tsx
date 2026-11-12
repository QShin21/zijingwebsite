import Link from "next/link";
import { PageState } from "@/components/PageState";

export default function NotFound() {
  return (
    <PageState
      label="404 · 场地未找到"
      title="暂时找不到这一页"
      description="页面可能已调整，或内容尚未公开。请核对链接，也可以回到主场重新查找。"
      help={
        <ul>
          <li>如刚提交过申请或报名，请到「我的」核对记录。</li>
          <li>
            <Link href="/account">查看我的事务</Link>
          </li>
          <li>
            <Link href="/contact">联系社团</Link>
          </li>
        </ul>
      }
    >
      <Link className="button" href="/">
        返回主场
      </Link>
      <Link className="button light" href="/events">
        查看日程
      </Link>
    </PageState>
  );
}
