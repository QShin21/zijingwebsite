"use client";

import Link from "next/link";
import { PageState } from "@/components/PageState";
import { useT } from "@/components/i18n/LocaleProvider";

export default function TeamError({ retry }: { error?: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  return (
    <PageState
      label={t("SIGNAL LOST · 代表队", "SIGNAL LOST · Teams")}
      title={t("队伍页面暂时无法读取", "This team page cannot be loaded right now")}
      description={t("请重新读取当前页面。若刚完成提交，可先到本人记录核对结果。", "Reload this page. If you just submitted something, check the result in your own records.")}
      alert
      help={
        <>
          <p>{t("重新读取不会重复提交入队申请、荣誉或审核结果。", "Reloading will not resubmit applications, honors or review decisions.")}</p>
          <Link href="/teams/honors?view=mine">{t("查看我的荣誉记录", "View my honor records")}</Link>
        </>
      }
    >
      <button className="button" type="button" onClick={() => retry()}>
        {t("重新读取", "Reload")}
      </button>
      <Link className="button light" href="/teams/recruitment">
        {t("查看我的入队记录", "View my team applications")}
      </Link>
    </PageState>
  );
}
