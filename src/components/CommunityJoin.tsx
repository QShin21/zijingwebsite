"use client";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import styles from "./community-pages/CommunityPages.module.css";
import { useT } from "@/components/i18n/LocaleProvider";

type Contact = { id: number; name: string; qr: string };
const subscribe = () => () => {};

/** The caller only passes the existing consented, active-office projection. */
export function CommunityContactCards({ contacts }: { contacts: Contact[] }) {
  const t = useT();
  return (
    <div className={styles.contactList}>
      {contacts.map((contact) => (
        <article className={styles.contact} key={contact.id}>
          <h3>{contact.name}</h3>
          <small>{t("在任管理员，已授权展示名片", "Active admin; card shared with consent")}</small>
          <img
            className={styles.qr}
            src={contact.qr}
            width={280}
            height={280}
            loading="lazy"
            alt={t(`${contact.name}的微信名片二维码`, `WeChat card QR code of ${contact.name}`)}
          />
          <div className={styles.contactActions}>
            <a
              className="button light"
              href={contact.qr}
              download={t(`${contact.name}-微信名片.png`, `${contact.name}-wechat-card.png`)}
            >
              {t("保存微信名片", "Save WeChat card")}
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CommunityJoin({ slug }: { slug: string }) {
  const t = useT();
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
    setStatus(t("正在加载管理员名片…", "Loading admin contact cards…"));
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
          ? t(
              "任选一位管理员，添加好友时备注昵称和希望加入的社群。",
              "Pick any admin. When adding them, note your nickname and the community you want to join.",
            )
          : t("暂无在任管理员的有效名片，请稍后再来。", "No active admin cards are available. Please check back later."),
      );
    } catch {
      if (currentRequest !== request.current) return;
      setStatus(t("暂时无法加载名片，请重试。若登录已失效，请重新登录。", "Could not load the cards. Try again, or sign in again if your session expired."));
      setFailed(true);
    } finally {
      if (currentRequest === request.current) setLoading(false);
    }
  }
  return (
    <>
      <button
        className="button community-join"
        aria-label={t("联系管理员（添加社群管理员微信）", "Contact an admin (add a community admin on WeChat)")}
        disabled={!ready}
        onClick={open}
      >
        {t("联系管理员", "Contact an admin")}
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
          <h2 id={titleID}>{t("联系管理员，申请加入微信群", "Contact an admin to join the WeChat group")}</h2>
          <button
            autoFocus
            type="button"
            aria-label={t("关闭弹窗", "Close dialog")}
            onClick={() => dialog.current?.close()}
          >
            {t("关闭", "Close")}
          </button>
        </div>
        <div aria-busy={loading}>
          <p role="status">{status}</p>
          {failed && (
            <button className="button light" type="button" onClick={open}>
              {t("重试加载", "Retry")}
            </button>
          )}
          <CommunityContactCards contacts={contacts} />
        </div>
        <div className={styles.dialogFooter}>
          <p>
            {t(
              "保存名片后可在微信中识别，添加好友时备注昵称和社群。请等待管理员回复与人工拉群。",
              "Save the card and scan it in WeChat. Note your nickname and community when adding. An admin will reply and add you to the group manually.",
            )}
          </p>
          <p>{t("查看、保存或识别名片均不会自动加入微信群。", "Viewing, saving or scanning a card does not add you to the WeChat group automatically.")}</p>
        </div>
      </dialog>
    </>
  );
}
