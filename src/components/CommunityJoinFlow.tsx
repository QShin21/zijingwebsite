"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinAction } from "@/app/(frontend)/community/actions";
import { joinLabels } from "@/lib/community-status";
import { CommunityContactCards } from "./CommunityJoin";
import styles from "@/app/(frontend)/_club/ClubPages.module.css";

type Receipt = { id: number; status: string; updatedAt: string; note?: string | null; confirmedAt?: string | null };
const nextSteps: Record<string, string> = {
  requested: "请在微信中添加管理员好友，发送后可在下方记录。",
  friendReported: "已记录你的自报状态，请等待管理员在微信中核实好友申请。",
  awaitingInvite: "好友已由管理员确认，请等待管理员在微信中拉群。",
  joined: "网站保留管理员的人工确认记录。群成员情况需要更正时，请联系管理员。",
  withdrawn: "已撤回网站意向。如仍希望加入，可以重新记录；微信中的好友与群关系不受影响。",
};
function dateLabel(value: string) { return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }); }
export function CommunityJoinFlow({ game, contacts, receipt }: { game: number; contacts: { id: number; name: string; qr: string }[]; receipt: Receipt | null }) {
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [result, setResult] = useState("");
  const state = receipt?.status || "none";
  return <div className={styles.split}>
    <section aria-labelledby="my-join-progress">
      <h2 id="my-join-progress">我的进群进度</h2>
      <div className={styles.flowStatus}>
        <h3 role="status">{receipt ? joinLabels[receipt.status] || "进度已更新" : "尚未记录进群意向"}</h3>
        <p>{nextSteps[state] || "先选择一位在任管理员，记录网站加入意向，再到微信中添加好友。"}</p>
        {receipt && <dl className={styles.flowMeta}>
          <div><dt>最近更新</dt><dd><time dateTime={receipt.updatedAt}>{dateLabel(receipt.updatedAt)}</time></dd></div>
          {receipt.confirmedAt && <div><dt>人工确认</dt><dd><time dateTime={receipt.confirmedAt}>{dateLabel(receipt.confirmedAt)}</time></dd></div>}
        </dl>}
      </div>
      {receipt?.note && <div className={styles.nextStep}><h3>管理员说明</h3><p className="preserve">{receipt.note}</p></div>}
      <p role="alert">{message}</p>
      <p role="status">{result}</p>
      <form className="member-form" aria-busy={busy} onSubmit={async event => {
        event.preventDefault();
        if (pending.current) return;
        const form = new FormData(event.currentTarget);
        const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
        form.set("action", action || "request");
        pending.current = true; setBusy(true); setMessage(""); setResult("");
        try {
          const response = await joinAction(form);
          if (response.error) setMessage(response.error);
          else { setResult("进度已保存，正在核对最新记录。"); router.refresh(); }
        } catch { setMessage("暂时无法确认保存结果。请刷新核对最新进度后重试。"); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <input type="hidden" name="game" value={game} />
        <input type="hidden" name="id" value={receipt?.id ?? ""} />
        <input type="hidden" name="revision" value={receipt?.updatedAt ?? ""} />
        {!receipt || receipt.status === "withdrawn" ? contacts.length ? <>
          <label>联系哪位管理员<select name="contact" required disabled={busy}>{contacts.map(contact => <option value={contact.id} key={contact.id}>{contact.name}</option>)}</select></label>
          <div className="reaction-bar"><button className="button" type="submit" name="action" value="request" disabled={busy}>{busy ? "正在记录…" : "记录加入意向"}</button></div>
        </> : <div className="empty"><h3>暂时无法记录新的意向</h3><p>暂无在任管理员的有效名片。请稍后再来，或申请参与社群组织。</p><Link href="/community/apply">申请成为社群管理员</Link></div> : <div className="reaction-bar">
          {receipt.status === "requested" && <button className="button" type="submit" name="action" value="reportFriend" disabled={busy}>{busy ? "正在保存…" : "我已发送好友申请"}</button>}
          {!["joined", "withdrawn"].includes(receipt.status) && <button className="button light" type="submit" name="action" value="withdraw" disabled={busy}>撤回网站意向</button>}
        </div>}
      </form>
      <p className="field-hint">微信好友申请和进群由你与管理员在微信中完成。查看、保存或扫描名片、网站注册及提交意向均不会自动进群。撤回网站意向不会删除微信好友或退出微信群。</p>
    </section>
    <aside className={styles.aside} aria-labelledby="join-contact-title">
      <h2 id="join-contact-title">联系管理员</h2>
      <p>保存个人名片，在微信中识别并加好友；备注昵称和希望加入的游戏社群，等待管理员回复与拉群。</p>
      {contacts.length ? <CommunityContactCards contacts={contacts} /> : <p>暂无可用名片，请稍后重试。</p>}
    </aside>
  </div>;
}
