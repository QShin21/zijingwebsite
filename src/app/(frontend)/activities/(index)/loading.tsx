import { RouteLoading } from "@/components/activity-pages/RouteLoading";
import { getT } from "@/lib/i18n/server";
export default async function Loading() {
  const { t } = await getT();
  return <RouteLoading label={t("问卷工作区", "questionnaire workspace")} />;
}
