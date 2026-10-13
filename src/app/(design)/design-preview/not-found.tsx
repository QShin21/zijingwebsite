import Link from "next/link";
export default function Missing() {
  return (
    <section className="z-section z-empty">
      <p className="z-kicker">404 / OFF THE FIELD</p>
      <h1>这里还没有公开内容。</h1>
      <p>内容可能尚未发布或已撤下，请从公开入口继续探索。</p>
      <Link className="z-button" href="/design-preview">
        返回预览首页 ↗
      </Link>
    </section>
  );
}
