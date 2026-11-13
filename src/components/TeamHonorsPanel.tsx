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
import { teamHonorQuery, teamHonorSubmissionHref } from "./TeamHonorNavigation";
import { safeReturnPath } from "./account-pages/auth-return";
import { LoginWall } from "./v2/ui";
import styles from "./team-pages/TeamPages.module.css";
import { TeamSectionHeading } from "./team-pages/TeamPageParts";

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
  const signedIn = canParticipate(user);
  if (view !== "public" && !signedIn) {
    const query = teamHonorQuery({ view, page, team, game });
    const returnTo = safeReturnPath(`/teams/honors?${query}`, "/teams/honors");
    return (
      <section className={styles.workspace} aria-label="代表队荣誉">
        <LoginWall title={view === "review" ? "登录后查看荣誉审核" : "登录后查看我的投稿"} returnTo={returnTo}>
          登录后将返回当前荣誉视图。
        </LoginWall>
      </section>
    );
  }
  const privateView = view !== "public" && signedIn;
  const reviewer = honorCanReview(user);
  const archives = privateView
    ? []
    : await teamHonorService.archives(p, { team, game });
  let memberships: Awaited<ReturnType<typeof teamHonorService.availableTeams>> =
      [],
    membershipError = "";
  if (privateView)
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
    <section className={styles.workspace} aria-label="代表队荣誉">
      <nav className={styles.taskNav} aria-label="代表队与荣誉筛选">
        <Link href={"/teams" + (game ? "?game=" + game : "")}>
          代表队与荣誉
        </Link>
        <Link
          href={href("public")}
          aria-current={view === "public" ? "page" : undefined}
        >
          队伍荣誉档案
        </Link>
        {signedIn && (
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
      {membershipError && (
        <p id={view === "mine" ? "honor-editor" : undefined} role="status">
          {membershipError}
        </p>
      )}
      <div className={styles.summary}>
        <div>
          <TeamSectionHeading
            title={
              records
                ? view === "review"
                  ? "待核验与处理记录"
                  : "我的荣誉记录"
                : "队伍荣誉档案"
            }
          >
            {records
              ? `${records.totalDocs} 条记录`
              : `${archives.length} 支队伍有已批准荣誉`}
          </TeamSectionHeading>
          <p>
            {view === "review"
              ? "仅显示当前授权社群的材料。打开记录，核对成果与证据后处理。"
              : view === "mine"
                ? "在这里继续投稿、补充材料，查看本人记录与审核意见。"
                : "查阅各队已核验的赛事成绩。现任队员可提交荣誉，经审核后收录至本队档案。"}
          </p>
        </div>
        {signedIn &&
          (view === "public" ||
            (view === "mine" && writableMemberships.length > 0)) && (
            <Link
              className="button"
              href={
                view === "mine"
                  ? "#honor-editor"
                  : teamHonorSubmissionHref({ team, game })
              }
            >
              提交队伍荣誉
            </Link>
          )}
      </div>
      {records ? (
        <>
          <div className={styles.honorQueue}>
            {records.docs.map((record) => (
              <TeamHonorRecordCard
                key={record.id}
                record={record}
                compact
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
          {!records.docs.length && (
            <div className="empty">
              <h3>
                {view === "review"
                  ? "当前没有需要处理的荣誉记录"
                  : "你还没有荣誉投稿"}
              </h3>
              <p>
                {view === "review"
                  ? "有权限处理的新投稿会出现在此处。"
                  : writableMemberships.length
                    ? "可在下方填写荣誉并上传成果材料。"
                    : "已提交的荣誉和审核进度会显示在这里。"}
              </p>
            </div>
          )}
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
            <div className="empty">
              <h3>暂无已批准的荣誉档案</h3>
              <p>队员投稿经核验后，将汇入所属队伍的同一档案。</p>
            </div>
          )}
        </>
      )}
      {privateView &&
        view === "mine" &&
        (writableMemberships.length ? (
          <TeamHonorEditor
            key={scopeQuery}
            memberships={writableMemberships}
            returnQuery={teamHonorQuery({ view: "mine", page, team, game })}
          />
        ) : (
          !membershipError && (
            <div id="honor-editor" className={styles.note}>
              <h3>投稿需要当前有效队员身份</h3>
              <p>当前筛选范围内，你的账号暂无可投稿的代表队。</p>
              <div className={styles.actions}>
                {memberships.length > 0 && (
                  <Link className="text-link" href={teamHonorSubmissionHref()}>
                    查看全部可投稿队伍
                  </Link>
                )}
                <Link className="text-link" href="/teams/recruitment">
                  查看代表队招新与本人记录
                </Link>
              </div>
            </div>
          )
        ))}
    </section>
  );
}
