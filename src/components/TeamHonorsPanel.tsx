import Link from "next/link";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { canParticipate } from "@/lib/rules";
import { teamHonorService } from "@/lib/team-honor-service";
import {
  honorCanReview,
  honorError,
  honorReviewerOf,
  honorWorkspace,
} from "@/lib/team-honor-web";
import { TeamHonorArchiveCards } from "./TeamHonorArchives";
import { TeamHonorRecordCard } from "./TeamHonorRecord";
import { TeamHonorEditor } from "./TeamHonorEditor";
import { CommunityPager } from "./CommunityPager";
import { teamHonorQuery } from "./TeamHonorNavigation";
import styles from "@/app/(frontend)/_club/ClubPages.module.css";

// Parent's unified Teams & Honors route can embed this component without rebuilding teams.
export async function TeamHonorsPanel({
  payload: p,
  user,
  view = "public",
  page = 1,
  team,
  game,
}: {
  payload: Payload;
  user: User | null;
  view?: "public" | "mine" | "review";
  page?: number;
  team?: number;
  game?: number;
}) {
  const privateView = view !== "public" && canParticipate(user),
    reviewer = honorCanReview(user);
  const archives = privateView
    ? []
    : await teamHonorService.archives(p, { team, game });
  let memberships: Awaited<ReturnType<typeof teamHonorService.availableTeams>> =
      [],
    membershipError = "";
  if (canParticipate(user))
    try {
      memberships = await teamHonorService.availableTeams(p, user);
    } catch (error) {
      membershipError = honorError(error);
    }
  const records = privateView
    ? await honorWorkspace(
        p,
        user,
        view === "review" ? "review" : "mine",
        page,
        { team, game },
      )
    : null;
  const writableMemberships = memberships.filter(
    (item) =>
      (!team || item.team === team) && (!game || item.teamInfo.game === game),
  );
  const scopeQuery = teamHonorQuery({ team, game });
  const href = (nextView: "public" | "mine" | "review") => {
    const query = teamHonorQuery({ view: nextView, team, game });
    return "/teams/honors" + (query ? "?" + query : "");
  };
  const returnQuery = teamHonorQuery({ view, page, team, game });
  return (
    <section aria-label="代表队荣誉">
      <nav className="community-tabs" aria-label="代表队与荣誉筛选">
        <Link href={"/teams" + (game ? "?game=" + game : "")}>
          代表队与荣誉
        </Link>
        <Link
          href={href("public")}
          aria-current={view === "public" ? "page" : undefined}
        >
          队伍荣誉档案
        </Link>
        {canParticipate(user) && (
          <Link
            href={href("mine")}
            aria-current={view === "mine" ? "page" : undefined}
          >
            我的荣誉记录
          </Link>
        )}
        {reviewer && (
          <Link
            href={href("review")}
            aria-current={view === "review" ? "page" : undefined}
          >
            审核本社群荣誉
          </Link>
        )}
      </nav>
      {membershipError && <p role="status">{membershipError}</p>}
      <div className={styles.sectionHead}>
        <h2>{records ? view === "review" ? "待核验与处理记录" : "我的荣誉记录" : "队伍荣誉档案"}</h2>
        <p>{records ? `${records.totalDocs} 条记录` : `${archives.length} 支队伍有已批准荣誉`}</p>
      </div>
      <p className="field-hint">{view === "review" ? "仅显示当前授权社群的材料。退回或拒绝时，请给出可执行的说明。" : view === "mine" ? "本人投稿、审核结果与改稿记录保存在这里。待审材料须经他人核验后展示。" : "按队伍汇总已批准成绩；点击档案，可按赛事年份查阅完整记录。"}</p>
      {records ? (
        <>
          <div className="showcase-feed">
            {records.docs.map((record) => (
              <TeamHonorRecordCard
                key={record.id}
                record={record}
                reviewer={honorReviewerOf(user, record)}
                owner={user?.id === Number(record.author)}
                returnQuery={returnQuery}
                editable={memberships.some(
                  (membership) =>
                    membership.id === record.membershipRef &&
                    membership.team === Number(record.team),
                )}
              />
            ))}
          </div>
          {!records.docs.length && <div className="empty"><h3>{view === "review" ? "当前没有需要处理的荣誉记录" : "你还没有荣誉投稿"}</h3><p>{view === "review" ? "有权限处理的新投稿会出现在此处。" : "如果你是现任队员，可在下方填写荣誉并上传成果材料。"}</p></div>}
          <CommunityPager
            page={page}
            pages={records.totalPages}
            base="/teams/honors"
            query={"&" + teamHonorQuery({ view, team, game })}
          />
        </>
      ) : (
        <>
          <TeamHonorArchiveCards archives={archives} />
          {!archives.length && (
            <div className="empty"><h3>暂无已批准的荣誉档案</h3><p>队员投稿经核验后，将汇入所属队伍的同一档案。</p></div>
          )}
        </>
      )}
      {canParticipate(user) &&
        view !== "review" &&
        (writableMemberships.length ? (
          <TeamHonorEditor
            key={scopeQuery}
            memberships={writableMemberships}
            returnQuery={teamHonorQuery({ view: "mine", page, team, game })}
          />
        ) : (
          !membershipError && (
            <div className={styles.nextStep}><h3>投稿需要当前有效队员身份</h3><p>当前没有可投稿的有效代表队。已批准历史荣誉会继续保留。</p><Link className={styles.cardLink} href="/teams/recruitment">查看代表队招新与本人记录 →</Link></div>
          )
        ))}
    </section>
  );
}
