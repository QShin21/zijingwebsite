"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinAction } from "@/app/(frontend)/community/actions";
import { joinLabels } from "@/lib/community-status";
type Receipt = { id: number; status: string; updatedAt: string; note?: string | null; confirmedAt?: string | null };
export function CommunityJoinFlow({ game, contacts, receipt }: { game: number; contacts: { id: number; name: string; qr: string }[]; receipt: Receipt | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <section className="member-shell">
    <h2>我的进群进度</h2>
    <p role="status">{receipt ? joinLabels[receipt.status] : "尚未记录进群意向"}</p>
    <p>微信好友申请和进群由你与管理员在微信中完成。查看、保存或扫描名片、网站注册及提交意向均不会自动进群。</p>
    {receipt?.note && <p className="preserve">管理员说明：{receipt.note}</p>}
    {receipt?.confirmedAt && <p>人工确认时间：{new Date(receipt.confirmedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>}
    <p role="alert">{message}</p>
    <form className="member-form" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      const form = new FormData(event.currentTarget);
      const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
      form.set("action", action || "request");
      setBusy(true); setMessage("");
      try { const result = await joinAction(form); if (result.error) setMessage(result.error); else router.refresh(); }
      catch { setMessage("暂时无法保存，请重试并核对最新进度。"); }
      finally { setBusy(false); }
    }}>
      <input type="hidden" name="game" value={game} />
      <input type="hidden" name="id" value={receipt?.id ?? ""} />
      <input type="hidden" name="revision" value={receipt?.updatedAt ?? ""} />
      {!receipt || receipt.status === "withdrawn" ? <>
        {contacts.length ? <><label>联系哪位管理员<select name="contact" required>{contacts.map(contact => <option value={contact.id} key={contact.id}>{contact.name}</option>)}</select></label>
          <button className="button" type="submit" name="action" value="request" disabled={busy}>记录加入意向</button></>
          : <p>暂无在任管理员的有效名片。请稍后再来，或在游戏社群页申请参与组织。</p>}
      </> : <>
        {["requested", "friendReported"].includes(receipt.status) && <button className="button" type="submit" name="action" value="reportFriend" disabled={busy}>我已发送好友申请</button>}
        {!["joined", "withdrawn"].includes(receipt.status) && <button className="button light" type="submit" name="action" value="withdraw" disabled={busy}>撤回网站意向</button>}
        {receipt.status === "joined" && <p>网站保留管理员人工确认记录。退出或更正群成员情况请联系管理员。</p>}
      </>}
    </form>
    <h2>联系管理员</h2>
    <p>保存个人名片，在微信中识别并加好友；备注你的昵称及希望加入的游戏社群，等待管理员回复与拉群。撤回网站意向不会删除微信好友或退出微信群。</p>
    <div className="contact-grid">{contacts.map(contact => <article key={contact.id}><h3>{contact.name}</h3>
      <img src={contact.qr} width={280} height={280} alt={`${contact.name}的微信名片二维码`} />
      <a className="button light" href={contact.qr} download={`${contact.name}-微信名片.png`}>保存微信名片</a>
    </article>)}</div>
  </section>;
}
