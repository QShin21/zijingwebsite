"use client";

import Link from "next/link";
import { PageState } from "@/components/PageState";
import { useT } from "@/components/i18n/LocaleProvider";

export default function CommunityError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  return (
    <PageState
      label={t("SIGNAL LOST · 社群", "SIGNAL LOST · COMMUNITY")}
      title={t("社群内容暂时无法加载", "Community content could not be loaded")}
      description={t("请重试读取。如果刚才提交过申请或处理进度，请先核对本人记录，再决定是否重新提交。", "Try loading again. If you just submitted an application or a review, check your own records before submitting again.")}
      alert
      help={
        <>
          <p>{t("重新加载只读取页面内容，不会重复提交申请或审核结果。", "Reloading only reads the page; it does not resubmit applications or reviews.")}</p>
          <Link href="/community">{t("返回社群目录", "Back to communities")}</Link>
        </>
      }
    >
      <button className="button" type="button" onClick={retry}>
        {t("重新加载", "Reload")}
      </button>
      <Link className="button light" href="/account">
        {t("查看我的事务", "View my tasks")}
      </Link>
    </PageState>
  );
}
