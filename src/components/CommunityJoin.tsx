"use client";
import { useRef, useState, useSyncExternalStore } from "react";
export function CommunityJoin({ slug }: { slug: string }) {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [contacts, setContacts] = useState<{ id: number; name: string; qr: string }[]>([]);
  const [status, setStatus] = useState("");
  async function open() {
    dialog.current?.showModal();
    setStatus("正在加载管理员名片…");
    setContacts([]);
    try {
      const response = await fetch(`/community/${encodeURIComponent(slug)}/contacts`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setContacts(data);
      setStatus(data.length ? "任选一位管理员，微信扫码或保存名片后添加。" : "管理员暂未提供可用名片，请稍后再来。");
    } catch { setStatus("名片加载失败，请关闭后重试。"); }
  }
  return <>
    <button className="button community-join" disabled={!ready} onClick={open}>添加社群管理员微信 · 加入微信社群 ↗</button>
    <dialog ref={dialog} className="community-dialog" aria-labelledby="join-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-top"><h2 id="join-title">加入微信社群</h2><button autoFocus aria-label="关闭弹窗" onClick={() => dialog.current?.close()}>关闭 ×</button></div>
      <p role="status">{status}</p>
      <div className="contact-grid">{contacts.map(contact => <article key={contact.id}>
        <h3>{contact.name}</h3>
        {/* Normalized PNG data, never remote or user-supplied HTML. */}
        <img src={contact.qr} alt={`${contact.name}的微信名片二维码`} width={280} height={280} />
        <a className="button light" href={contact.qr} download={`${contact.name}-微信名片.png`}>保存微信名片</a>
      </article>)}</div>
    </dialog>
  </>;
}
