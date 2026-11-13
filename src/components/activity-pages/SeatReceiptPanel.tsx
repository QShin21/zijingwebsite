"use client";

import { useEffect, useState } from "react";
import { seatAPI, type SeatingKind, type SeatingState } from "@/lib/activity-seating-model";
import { SeatReceipt } from "./ActivitySeating";
import { seatRequest } from "./seat-request";
import { useT } from "@/components/i18n/LocaleProvider";
import styles from "./ActivitySeating.module.css";

/** Re-read the current owner's receipt when returning from the seating page. */
export function SeatReceiptPanel({ kind, id }: { kind: SeatingKind; id: number }) {
  const t = useT();
  const endpoint = seatAPI(kind, id);
  const [state, setState] = useState<SeatingState | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true, serial = 0;
    const load = async () => {
      const current = ++serial;
      try {
        const result = await seatRequest<SeatingState>(endpoint);
        if (active && current === serial) { setState(result); setFailed(false); }
      } catch {
        if (active && current === serial) { setState(null); setFailed(true); }
      }
    };
    void load();
    const refresh = () => { if (document.visibilityState === "visible") { setState(null); void load(); } };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [endpoint]);
  const hasReceipt = Boolean(state?.mine);
  useEffect(() => {
    if (hasReceipt && window.location.hash === "#seat-receipt") document.getElementById("seat-receipt")?.scrollIntoView({ block: "start" });
  }, [hasReceipt]);
  if (!state?.mine && !failed) return null;
  return <section id="seat-receipt" className={styles.section} aria-labelledby="seat-receipt-title">
    <h2 id="seat-receipt-title">{t("我的选座回执", "My seat receipt")}</h2>
    {state?.mine ? <SeatReceipt mine={state.mine} editable={false} endpoint={endpoint} ticketImages={state.ticketImages} />
      : <p>{t("选座回执暂时无法加载，请刷新页面重试。", "Your seat receipt cannot be loaded right now. Refresh the page and try again.")}</p>}
  </section>;
}
