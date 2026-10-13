"use client";
export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section className="z-section z-empty" role="alert">
      <p className="z-kicker">LET'S TRY AGAIN</p>
      <h1>内容暂时无法读取。</h1>
      <p>请检查网络后重试。此操作不会提交或修改你的资料。</p>
      <button className="z-button" onClick={reset}>
        重新读取
      </button>
      <a className="z-text-link" href="/account">
        返回我的账号 ↗
      </a>
    </section>
  );
}
