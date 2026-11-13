import { RouteLoading } from "@/components/activity-pages/RouteLoading";
import { getT } from "@/lib/i18n/server";

export default async function Loading() {
  const { t } = await getT();
  return <RouteLoading label={t("代表队", "Teams")} />;
}
