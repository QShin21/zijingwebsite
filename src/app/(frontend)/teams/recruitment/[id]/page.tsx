import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cms } from "@/lib/content";
import { PageHeading } from "@/components/PageHeading";
import { TeamCoreApplicant } from "@/components/TeamCoreControls";
import { teamRecruitmentInfo, teamJoinReceipt } from "@/lib/team-core";
import { positiveID } from "@/lib/team-memberships";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "../../../_club/ClubPages.module.css";
export const dynamic = "force-dynamic";
export default async function Recruitment({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const id = positiveID((await params).id);
  if (!id) notFound();
  const info = await teamRecruitmentInfo(p, user, id).catch(() => null);
  if (!info) notFound();
  return (
    <ClubFrame>
      <PageHeading
        title={info.doc.title}
        eyebrow="TEAM SELECTION"
        description={info.form.intro}
        parent={{ href: "/teams/recruitment", label: "招新与我的记录" }}
      />
      <section className="member-shell">
        <div className={styles.subHeader}>
          <p className={styles.status}>{info.state}</p>
          <p>
            {!info.readOnly && info.state === "招新开放"
              ? "可先保存草稿，再核对并提交。"
              : "当前批次以页面显示的开放状态为准。"}
            状态、意见和历史回执以此页面显示为准。
          </p>
        </div>
        <TeamCoreApplicant
          key={info.version}
          id={id}
          form={info.form}
          version={info.version}
          state={info.state}
          readOnly={info.readOnly}
          initial={teamJoinReceipt(info.own)}
        />
      </section>
    </ClubFrame>
  );
}
