import Link from "next/link";
import type { Payload } from "payload";
import type { User } from "@/payload-types";
import { canParticipate } from "@/lib/rules";
import { getT } from "@/lib/i18n/server";
import { localizeMessage } from "@/lib/i18n/messages";
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
  const { t, locale } = await getT();
  const signedIn = canParticipate(user);
  if (view !== "public" && !signedIn) {
    const query = teamHonorQuery({ view, page, team, game });
    const returnTo = safeReturnPath(`/teams/honors?${query}`, "/teams/honors");
    return (
      <section className={styles.workspace} aria-label={t("代表队荣誉", "Team honors")}>
        <LoginWall title={view === "review" ? t("登录后查看荣誉审核", "Sign in to review honors") : t("登录后查看我的投稿", "Sign in to view your submissions")} returnTo={returnTo}>
          {t("登录后将返回当前荣誉视图。", "You will return to this honor view after signing in.")}
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
    <section className={styles.workspace} aria-label={t("代表队荣誉", "Team honors")}>
      <nav className={styles.taskNav} aria-label={t("代表队与荣誉筛选", "Teams and honors filter")}>
        <Link href={"/teams" + (game ? "?game=" + game : "")}>
          {t("代表队与荣誉", "Teams & honors")}
        </Link>
        <Link
          href={href("public")}
          aria-current={view === "public" ? "page" : undefined}
        >
          {t("队伍荣誉档案", "Team honor archives")}
        </Link>
        {signedIn && (
          <Link
            href={href("mine")}
            aria-current={view === "mine" ? "page" : undefined}
          >
            {t("我的荣誉记录", "My honor records")}
          </Link>
        )}
        {reviewer && (
          <Link
            href={href("review")}
            aria-current={view === "review" ? "page" : undefined}
          >
            {t("审核本社群荣誉", "Review community honors")}
          </Link>
        )}
      </nav>
      {membershipError && (
        <p id={view === "mine" ? "honor-editor" : undefined} role="status">
          {localizeMessage(membershipError, locale)}
        </p>
      )}
      <div className={styles.summary}>
        <div>
          <TeamSectionHeading
            title={
              records
                ? view === "review"
                  ? t("待核验与处理记录", "Records to verify and handle")
                  : t("我的荣誉记录", "My honor records")
                : t("队伍荣誉档案", "Team honor archives")
            }
          >
            {records
              ? t(`${records.totalDocs} 条记录`, `${records.totalDocs} record${records.totalDocs === 1 ? "" : "s"}`)
              : t(`${archives.length} 支队伍有已批准荣誉`, `${archives.length} team${archives.length === 1 ? " has" : "s have"} approved honors`)}
          </TeamSectionHeading>
          <p>
            {view === "review"
              ? t("仅显示当前授权社群的材料。打开记录，核对成果与证据后处理。", "Only materials from communities you are authorized for are shown. Open a record and check the results and evidence before acting.")
              : view === "mine"
                ? t("在这里继续投稿、补充材料，查看本人记录与审核意见。", "Submit honors, add materials, and see your records and review notes here.")
                : t("查阅各队已核验的赛事成绩。现任队员可提交荣誉，经审核后收录至本队档案。", "Browse each team's verified competition results. Current players can submit honors, which join the team archive after review.")}
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
              {t("提交队伍荣誉", "Submit a team honor")}
            </Link>
          )}
      </div>
      {records ? (
        <>
          <div className={styles.honorQueue}>
            {records.docs.map((record) => (
              <TeamHonorRecordCard
                key={record.id}
                locale={locale}
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
                  ? t("当前没有需要处理的荣誉记录", "No honor records need attention")
                  : t("你还没有荣誉投稿", "You have no honor submissions yet")}
              </h3>
              <p>
                {view === "review"
                  ? t("有权限处理的新投稿会出现在此处。", "New submissions you can handle will appear here.")
                  : writableMemberships.length
                    ? t("可在下方填写荣誉并上传成果材料。", "Fill in an honor and upload materials below.")
                    : t("已提交的荣誉和审核进度会显示在这里。", "Submitted honors and review progress will appear here.")}
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
          <TeamHonorArchiveCards archives={archives} locale={locale} />
          {!archives.length && (
            <div className="empty">
              <h3>{t("暂无已批准的荣誉档案", "No approved honor archives yet")}</h3>
              <p>{t("队员投稿经核验后，将汇入所属队伍的同一档案。", "Verified player submissions are added to their team's archive.")}</p>
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
              <h3>{t("投稿需要当前有效队员身份", "Submitting requires active team membership")}</h3>
              <p>{t("当前筛选范围内，你的账号暂无可投稿的代表队。", "Your account has no team you can submit for in this filter.")}</p>
              <div className={styles.actions}>
                {memberships.length > 0 && (
                  <Link className="text-link" href={teamHonorSubmissionHref()}>
                    {t("查看全部可投稿队伍", "View all eligible teams")}
                  </Link>
                )}
                <Link className="text-link" href="/teams/recruitment">
                  {t("查看代表队招新与本人记录", "View team recruitment and your records")}
                </Link>
              </div>
            </div>
          )
        ))}
    </section>
  );
}
