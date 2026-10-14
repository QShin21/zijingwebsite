"use client";
import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import styles from "./community-pages/CommunityPages.module.css";

type Contact = { id: number; name: string; qr: string };
const subscribe = () => () => {};

/** The caller only passes the existing consented, active-office projection. */
export function CommunityContactCards({ contacts }: { contacts: Contact[] }) {
  return (
    <div className={styles.contactList}>
      {contacts.map((contact) => (
        <article className={styles.contact} key={contact.id}>
          <h3>{contact.name}</h3>
          <small>在任管理员，已授权展示名片</small>
          <img
            className={styles.qr}
            src={contact.qr}
            width={280}
            height={280}
            loading="lazy"
            alt={`${contact.name}的微信名片二维码`}
          />
          <div className={styles.contactActions}>
            <a
              className="button light"
              href={contact.qr}
              download={`${contact.name}-微信名片.png`}
            >
              保存微信名片
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CommunityJoin({ slug }: { slug: string }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const titleID = useId();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  async function open() {
    dialog.current?.showModal();
    const currentRequest = ++request.current;
    setStatus("正在加载管理员名片…");
    setLoading(true);
    setFailed(false);
    setContacts([]);
    try {
      const response = await fetch(
        `/community/${encodeURIComponent(slug)}/contacts`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const data: Contact[] = await response.json();
      if (currentRequest !== request.current) return;
      setContacts(data);
      setStatus(
        data.length
          ? "任选一位管理员，添加好友时备注昵称和希望加入的社群。"
          : "暂无在任管理员的有效名片，请稍后再来。",
      );
    } catch {
      if (currentRequest !== request.current) return;
      setStatus("暂时无法加载名片，请重试。若登录已失效，请重新登录。");
      setFailed(true);
    } finally {
      if (currentRequest === request.current) setLoading(false);
    }
  }
  return (
    <>
      <button
        className="button community-join"
        aria-label="联系管理员（添加社群管理员微信）"
        disabled={!ready}
        onClick={open}
      >
        联系管理员
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleID}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id={titleID}>联系管理员，申请加入微信群</h2>
          <button
            autoFocus
            type="button"
            aria-label="关闭弹窗"
            onClick={() => dialog.current?.close()}
          >
            关闭
          </button>
        </div>
        <div aria-busy={loading}>
          <p role="status">{status}</p>
          {failed && (
            <button className="button light" type="button" onClick={open}>
              重试加载
            </button>
          )}
          <CommunityContactCards contacts={contacts} />
        </div>
        <div className={styles.dialogFooter}>
          <p>
            保存名片后可在微信中识别，添加好友时备注昵称和社群。请等待管理员回复与人工拉群。
          </p>
          <Link
            className="button light"
            href={`/community/${slug}/join`}
            onClick={() => dialog.current?.close()}
          >
            记录意向与查看进群进度
          </Link>
          <p>查看、保存或识别名片均不会自动加入微信群。</p>
        </div>
      </dialog>
    </>
  );
}
