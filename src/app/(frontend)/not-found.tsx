import Link from "next/link";
import { PageState } from "@/components/PageState";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <PageState
      label={t("404 · 场地未找到", "404 · Venue not found")}
      title={t("暂时找不到这一页", "We can’t find this page")}
      description={t(
        "页面可能已调整，或内容尚未公开。请核对链接，也可以回到主场重新查找。",
        "The page may have moved or isn’t public yet. Check the link, or go back Home and look again.",
      )}
      help={
        <ul>
          <li>{t("如刚提交过申请或报名，请到「我的」核对记录。", "If you just submitted an application or sign-up, check your records under “Me”.")}</li>
          <li>
            <Link href="/account">{t("查看我的事务", "My tasks")}</Link>
          </li>
          <li>
            <Link href="/contact">{t("联系社团", "Contact the club")}</Link>
          </li>
        </ul>
      }
    >
      <Link className="button" href="/">
        {t("返回主场", "Back to Home")}
      </Link>
      <Link className="button light" href="/events">
        {t("查看日程", "View schedule")}
      </Link>
    </PageState>
  );
}
