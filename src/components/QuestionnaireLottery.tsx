"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { activityRequest } from "./activity-pages/client-request";
import { formatDate } from "@/lib/rules";
import styles from "./activity-pages/Workspace.module.css";

type Workbench = {
  total: number;
  draw: null | { candidates: number; winners: number; drawnAt: string; revision: string };
};

export function QuestionnaireLottery({ kind, id }: { kind: string; id: number }) {
  const endpoint = `/api/activities/${kind}/${id}/lottery`;
  const [data, setData] = useState<Workbench | null>(null);
  const [count, setCount] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await activityRequest(endpoint));
      setFailed(false);
      setMessage("");
    } catch (error) {
      setFailed(true);
      setMessage((error as Error).message);
    } finally { setBusy(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  async function draw(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || busy || lock.current) return;
    const winners = Number(count);
    if (!Number.isSafeInteger(winners) || winners < 1 || winners > data.total) {
      setFailed(true); setMessage("中签人数须在 1 到当前报名人数之间。"); return;
    }
    const prompt = `将从当前 ${data.total} 份报名中随机抽出 ${winners} 人，结果立即显示在本人回执中。${data.draw ? "重新抽签会更新所有人的现有结果。" : ""}确认抽签？`;
    if (!window.confirm(prompt)) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const result: Workbench = await activityRequest(endpoint, "POST", {
        count: winners, expectedTotal: data.total, revision: data.draw?.revision ?? null,
      });
      setData(result); setFailed(false); setMessage("抽签完成，结果已显示在报名人的回执中。");
    } catch (error) {
      const reason = (error as Error).message;
      setFailed(true);
      setMessage(/提交结果尚未确认|服务器响应不完整|服务器暂时无法确认提交结果/.test(reason)
        ? "抽签结果暂未确认，请刷新报名与抽签状态后再操作。" : reason);
    }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <section className={styles.section} aria-busy={busy}>
      <header className={styles.sectionHeader}>
        <div><h2>报名抽签</h2><p>每份报名有一次抽签机会，中签人数由活动管理员设置。</p></div>
        <button type="button" disabled={busy} onClick={() => void load()}>刷新报名与抽签状态</button>
      </header>
      {message && <p className={failed ? styles.error : styles.feedback} role={failed ? "alert" : "status"}>{message}</p>}
      {!data && !message && <p role="status">正在读取报名人数…</p>}
      {data && <>
        <p>当前报名：<strong>{data.total} 人</strong></p>
        {data.draw ? <p>上次抽签：{formatDate(data.draw.drawnAt)}，{data.draw.candidates} 人参与，{data.draw.winners} 人中签。</p>
          : <p>当前活动尚未抽签。</p>}
        <p className={styles.scope}>结果立即显示在网页和小程序的本人报名回执。抽签后新增的报名显示“未参与本次抽签”。</p>
        <form className={styles.actionForm} onSubmit={draw}>
          <label htmlFor="lottery-winners">中签人数</label>
          <input id="lottery-winners" type="number" min={1} max={data.total || 1} step={1} required
            value={count} onChange={event => setCount(event.target.value)} disabled={busy || data.total === 0} />
          <button className="button" disabled={busy || data.total === 0} type="submit">
            {busy ? "处理中…" : data.draw ? "重新抽签并更新结果" : "抽签并公布结果"}
          </button>
        </form>
        {data.draw && <p className={styles.scope}>重新抽签会更新所有报名人的结果，历史抽签记录会保留。</p>}
      </>}
    </section>
  );
}
