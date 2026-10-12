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
    (item) => !team || item.team === team,
  );
  return (
    <section aria-label="代表队荣誉">
      <nav className="community-tabs" aria-label="代表队与荣誉筛选">
        <Link href="/teams">代表队与荣誉</Link>
        <Link
          href="/teams/honors"
          aria-current={view === "public" ? "page" : undefined}
        >
          队伍荣誉档案
        </Link>
        {canParticipate(user) && (
          <Link
            href="/teams/honors?view=mine"
            aria-current={view === "mine" ? "page" : undefined}
          >
            我的荣誉记录
          </Link>
        )}
        {reviewer && (
          <Link
            href="/teams/honors?view=review"
            aria-current={view === "review" ? "page" : undefined}
          >
            审核本社群荣誉
          </Link>
        )}
      </nav>
      {membershipError && <p role="status">{membershipError}</p>}
      {records ? (
        <>
          <div className="showcase-feed">
            {records.docs.map((record) => (
              <TeamHonorRecordCard
                key={record.id}
                record={record}
                reviewer={honorReviewerOf(user, record)}
                owner={user?.id === Number(record.author)}
                editable={memberships.some(
                  (membership) =>
                    membership.id === record.membershipRef &&
                    membership.team === Number(record.team),
                )}
              />
            ))}
          </div>
          {!records.docs.length && <p>此处暂无荣誉记录。</p>}
          <CommunityPager
            page={page}
            pages={records.totalPages}
            base="/teams/honors"
            query={"&view=" + view}
          />
        </>
      ) : (
        <>
          <TeamHonorArchiveCards archives={archives} />
          {!archives.length && (
            <p>暂无可展示的队伍荣誉档案，批准后的记录会自动汇总。</p>
          )}
        </>
      )}
      {canParticipate(user) &&
        view !== "review" &&
        (writableMemberships.length ? (
          <TeamHonorEditor memberships={writableMemberships} />
        ) : (
          !membershipError && (
            <p>当前没有可投稿的有效代表队。已批准历史荣誉会继续保留。</p>
          )
        ))}
    </section>
  );
}
