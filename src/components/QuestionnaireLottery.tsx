"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { activityRequest } from "./activity-pages/client-request";
import { formatDate } from "@/lib/rules";
import styles from "./activity-pages/Workspace.module.css";
import { useLocale, useT } from "./i18n/LocaleProvider";
import { formatDateTime } from "@/lib/i18n/locale";
import { localizeManageMessage } from "@/lib/i18n/labels-manage";

type Workbench = {
  total: number;
  draw: null | { candidates: number; winners: number; drawnAt: string; revision: string };
};

export function QuestionnaireLottery({ kind, id, canExport }: { kind: string; id: number; canExport: boolean }) {
  const t = useT(), locale = useLocale();
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
      setFailed(true); setMessage(t("中签人数须在 1 到当前报名人数之间。", "The number selected must be between 1 and the current number of sign-ups.")); return;
    }
    const prompt = t(
      `将从当前 ${data.total} 份报名中随机抽出 ${winners} 人，结果立即显示在本人回执中。${data.draw ? "重新抽签会更新所有人的现有结果。" : ""}确认抽签？`,
      `${winners} of the current ${data.total} sign-ups will be drawn at random, and results will show on each receipt immediately.${data.draw ? " A new draw updates everyone's existing result." : ""} Run the draw?`,
    );
    if (!window.confirm(prompt)) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const result: Workbench = await activityRequest(endpoint, "POST", {
        count: winners, expectedTotal: data.total, revision: data.draw?.revision ?? null,
      });
      setData(result); setFailed(false); setMessage(t("抽签完成，结果已显示在报名人的回执中。", "Draw complete. Results now show on sign-up receipts."));
    } catch (error) {
      const reason = (error as Error).message;
      setFailed(true);
      setMessage(/提交结果尚未确认|服务器响应不完整|服务器暂时无法确认提交结果/.test(reason)
        ? t("抽签结果暂未确认，请刷新报名与抽签状态后再操作。", "The draw result is not confirmed yet. Refresh the sign-up and draw status before continuing.") : reason);
    }
    finally { lock.current = false; setBusy(false); }
  }

  async function exportLottery() {
    if (!data?.draw || busy || !canExport) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/activities/${kind}/${id}/signup?mode=export&lottery=1`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || t("导出失败", "Export failed"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      link.href = url;
      link.download = filename ? decodeURIComponent(filename) : "lottery-results.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFailed(false); setMessage(t("抽签结果已导出，请妥善保管个人信息。", "Draw results exported. Keep the personal data safe."));
    } catch (error) {
      setFailed(true); setMessage((error as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <section className={styles.section} aria-busy={busy}>
      <header className={styles.sectionHeader}>
        <div><h2>{t("报名抽签", "Sign-up lottery")}</h2><p>{t("每份报名有一次抽签机会，中签人数由活动管理员设置。", "Each sign-up gets one entry in the draw; activity managers set the number selected.")}</p></div>
        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => void load()}>{t("刷新报名与抽签状态", "Refresh sign-up and draw status")}</button>
      </header>
      {message && <p className={failed ? styles.error : styles.feedback} role={failed ? "alert" : "status"}>{localizeManageMessage(message, locale)}</p>}
      {!data && !message && <p role="status">{t("正在读取报名人数…", "Loading sign-up count…")}</p>}
      {data && <>
        <p>{t("当前报名：", "Current sign-ups: ")}<strong>{t(`${data.total} 人`, `${data.total}`)}</strong></p>
        {data.draw ? <p>{t(
          `上次抽签：${formatDate(data.draw.drawnAt)}，${data.draw.candidates} 人参与，${data.draw.winners} 人中签。`,
          `Last draw: ${formatDateTime(data.draw.drawnAt, locale)}, ${data.draw.candidates} entered, ${data.draw.winners} selected.`,
        )}</p>
          : <p>{t("当前活动尚未抽签。", "No draw has been run for this activity.")}</p>}
        <p className={styles.scope}>{t("结果立即显示在网页和小程序的本人报名回执。抽签后新增的报名显示“未参与本次抽签”。", "Results show immediately on each person's receipt on the website and mini program. Sign-ups added after the draw show “Not in this draw”.")}</p>
        <form className={styles.actionForm} onSubmit={draw}>
          <label htmlFor="lottery-winners">{t("中签人数", "Number selected")}</label>
          <input className={styles.lotteryInput} id="lottery-winners" type="number" min={1} max={data.total || 1} step={1} required
            placeholder={data.total ? t(`请输入 1–${data.total} 的人数`, `Enter 1–${data.total}`) : t("暂无报名", "No sign-ups yet")}
            value={count} onChange={event => setCount(event.target.value)} disabled={busy || data.total === 0} />
          <button className="button" disabled={busy || data.total === 0} type="submit">
            {busy ? t("处理中…", "Working…") : data.draw ? t("重新抽签并更新结果", "Redraw and update results") : t("抽签并公布结果", "Draw and publish results")}
          </button>
        </form>
        {data.draw && <p className={styles.scope}>{t("重新抽签会更新所有报名人的结果，历史抽签记录会保留。", "A redraw updates every sign-up's result; past draw records are kept.")}</p>}
        {canExport ? <div className={styles.lotteryExport}>
          <button className={styles.secondaryButton} type="button" disabled={busy || !data.draw} onClick={() => void exportLottery()}>{t("导出抽签结果 CSV", "Export draw results (CSV)")}</button>
          <p className={styles.scope}>{data.draw ? t("导出全部报名及最新抽签结果，包含抽签后新增的报名。", "Exports all sign-ups with the latest draw results, including sign-ups added after the draw.") : t("完成抽签后即可导出全部报名及抽签结果。", "After a draw you can export all sign-ups with draw results.")}</p>
        </div> : <p className={styles.scope}>{t("导出抽签结果需要单独授权。", "Exporting draw results requires separate permission.")}</p>}
      </>}
    </section>
  );
}
