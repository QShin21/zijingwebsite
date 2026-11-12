import { LinkTabs } from "./ui";

/** 代表队中心三段：队伍｜荣誉墙｜选拔中心. */
export function TeamsNav({ current }: { current: "teams" | "honors" | "recruitment" }) {
  return (
    <LinkTabs
      label="代表队中心"
      items={[
        { href: "/teams", label: "队伍", current: current === "teams" },
        { href: "/teams/honors", label: "荣誉墙", current: current === "honors" },
        { href: "/teams/recruitment", label: "选拔中心", current: current === "recruitment" },
      ]}
    />
  );
}
