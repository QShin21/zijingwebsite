"use client";
import Link from "next/link";
import { PageState } from "@/components/PageState";
import { useT } from "@/components/i18n/LocaleProvider";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  return (
    <PageState
      label={t("SIGNAL LOST · 暂时无法显示", "SIGNAL LOST · Can’t display")}
      title={t("内容未能载入", "Content failed to load")}
      description={t(
        "请检查网络后重新加载。如果刚刚提交过报名或申请，请先在「我的」核对实际结果。",
        "Check your network and reload. If you just submitted a sign-up or application, check the actual result under “Me” first.",
      )}
      alert
      help={
        <>
          <p>
            {t(
              "重新加载会读取页面内容。提交结果暂时不明时，请先核对记录，避免重复提交。",
              "Reloading fetches the page again. If a submission result is unclear, check your records first to avoid submitting twice.",
            )}
          </p>
          <Link href="/events">{t("查看日程", "View schedule")}</Link>
        </>
      }
    >
      <button type="button" className="button" onClick={retry}>
        {t("重新加载", "Reload")}
      </button>
      <Link className="button light" href="/account">
        {t("查看本人记录", "View my records")}
      </Link>
    </PageState>
  );
}
