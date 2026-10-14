import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms, bySlug } from "@/lib/content";
import { canHandleCommunityJoins, formatDate } from "@/lib/rules";
import { joinLabels } from "@/lib/community-status";
import { handleJoinResultAction } from "../../actions";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import {
  CommunityEmpty,
  CommunityPageHeader,
} from "@/components/community-pages/CommunityPages";
import { SubmitButton } from "@/components/SubmitButton";
import { CommunityPager, pageNumber } from "@/components/CommunityPager";
import { ClubFrame } from "../../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";

export default async function Members({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; message?: string }>;
}) {
  const { slug } = await params,
    query = await searchParams;
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  const game = await bySlug("games", slug);
  if (!game || !canHandleCommunityJoins(user, game.id)) notFound();
  const page = pageNumber(query.page);
  const rows = await p.find({
    collection: "community-joins",
    overrideAccess: false,
    user,
    depth: 0,
    limit: 20,
    page,
    sort: "createdAt",
    where: {
      and: [
        { game: { equals: game.id } },
        { status: { in: ["requested", "friendReported", "awaitingInvite"] } },
      ],
    },
  });
  return (
    <ClubFrame className={`${styles.page} ${styles.body}`}>
      <CommunityPageHeader
        title="人工进群管理"
        description="先在微信核实好友申请，再实际拉群。完成微信操作后，在对应记录中保存人工确认。"
      />
      <div className={styles.sectionHead}>
        <h2>待处理意向</h2>
        <p>
          {rows.totalDocs} 条，属于{game.title}
        </p>
      </div>
      <p role="status">{query.message}</p>
      <div className={styles.records}>
        {rows.docs.map((row) => (
          <article className={styles.record} key={row.id}>
            <div className={styles.recordGrid}>
              <div>
                <header className={styles.recordHeader}>
                  <h3>{row.memberName}</h3>
                  <span className={styles.status} data-state={row.status}>
                    {joinLabels[row.status]}
                  </span>
                </header>
                <dl className={styles.facts}>
                  <div>
                    <dt>记录意向</dt>
                    <dd>
                      <time dateTime={row.createdAt}>
                        {formatDate(row.createdAt)}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>最近更新</dt>
                    <dd>
                      <time dateTime={row.updatedAt}>
                        {formatDate(row.updatedAt)}
                      </time>
                    </dd>
                  </div>
                </dl>
                {row.note && (
                  <div className={styles.note}>
                    <h3>上次说明</h3>
                    <p className="preserve">{row.note}</p>
                  </div>
                )}
              </div>
              <section
                className={styles.decision}
                aria-label={`${row.memberName}的进群处理`}
              >
                <h3>
                  {row.status === "awaitingInvite"
                    ? "确认已完成拉群"
                    : "核对微信好友状态"}
                </h3>
                <p>
                  {row.status === "awaitingInvite"
                    ? "请先确认这位同学已由你实际拉入微信群，再保存进群确认。"
                    : "在微信中通过好友后，保存为等待拉群。网站意向与自报状态不能代替微信核实。"}
                </p>
                <ActionForm
                  action={handleJoinResultAction}
                  className="member-form"
                >
                  <input type="hidden" name="game" value={game.id} />
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="revision" value={row.updatedAt} />
                  <input type="hidden" name="returnPage" value={page} />
                  <label>
                    处理说明（可选）
                    <textarea name="note" maxLength={500} rows={3} />
                  </label>
                  <div className="reaction-bar">
                    {row.status === "awaitingInvite" ? (
                      <SubmitButton name="action" value="confirmJoined">
                        已人工拉群，确认进群
                      </SubmitButton>
                    ) : (
                      <SubmitButton name="action" value="confirmFriend">
                        好友已通过，等待拉群
                      </SubmitButton>
                    )}
                  </div>
                </ActionForm>
              </section>
            </div>
          </article>
        ))}
      </div>
      {!rows.docs.length && (
        <CommunityEmpty title="暂无待处理进群意向">
          <p>
            成员记录意向或自报好友申请后，会在此显示。只有实际完成微信操作后，才更新人工确认。
          </p>
        </CommunityEmpty>
      )}
      <CommunityPager
        page={page}
        pages={rows.totalPages}
        base={`/community/${slug}/members`}
      />
    </ClubFrame>
  );
}
