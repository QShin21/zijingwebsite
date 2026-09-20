"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="page-head">
      <h1>页面暂时无法加载</h1>
      <p>请稍后重试。</p>
      <button className="button" onClick={() => reset()}>
        重新加载
      </button>
    </section>
  );
}
