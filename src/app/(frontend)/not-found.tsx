import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-head">
      <p className="eyebrow">404</p>
      <h1>暂时找不到这一页</h1>
      <p>内容可能尚未发布，或链接已经变更。</p>
      <Link className="button" href="/">
        返回首页
      </Link>
    </div>
  );
}
