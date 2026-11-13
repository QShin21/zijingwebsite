import { LinkTabs } from "./ui";
import { getT } from "@/lib/i18n/server";

/** 代表队中心三段：队伍｜荣誉墙｜选拔中心. */
export async function TeamsNav({ current }: { current: "teams" | "honors" | "recruitment" }) {
  const { t } = await getT();
  return (
    <LinkTabs
      label={t("代表队中心", "Teams center")}
      items={[
        { href: "/teams", label: t("队伍", "Teams"), current: current === "teams" },
        { href: "/teams/honors", label: t("荣誉墙", "Honor wall"), current: current === "honors" },
        { href: "/teams/recruitment", label: t("选拔中心", "Tryouts"), current: current === "recruitment" },
      ]}
    />
  );
}
