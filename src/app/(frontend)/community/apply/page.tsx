import { CommunityApplicationForm } from "@/components/CommunityApplicationForm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CommunityEmpty,
  CommunityPageHeader,
  CommunitySectionHeading,
} from "@/components/community-pages/CommunityPages";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import { cms, list } from "@/lib/content";
import {
  applicationLabels,
  applicationContactConsentLabel,
} from "@/lib/community-status";
import { relationID } from "@/lib/rules";
import {
  withdrawApplicationAction,
  updateCommunityCardResultAction,
} from "../actions";
import { formatDate } from "@/lib/rules";
import { ClubFrame } from "../../_club/ClubPage";
import styles from "@/components/community-pages/CommunityPages.module.css";
export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    submitted?: string;
    edit?: string;
  }>;
}) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const games = await list("games", {}, 1, 100),
    query = await searchParams;
  const apps = await p.find({
    collection: "community-applications",
    overrideAccess: false,
    user,
    where: { applicant: { equals: user.id } },
    sort: "-createdAt",
    limit: 50,
    depth: 0,
    select: {
      proposedGame: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      game: true,
      reviewNote: true,
      contactConsent: true,
    },
  });
  const edit = query.edit
    ? await p
        .findByID({
          collection: "community-applications",
          id: Number(query.edit),
          overrideAccess: false,
          user,
          depth: 0,
        })
        .catch(() => null)
    : null;
  const initial =
    edit &&
    Number(relationID(edit.applicant)) === user.id &&
    ["returned", "withdrawn"].includes(edit.status || "")
      ? {
          id: edit.id,
          updatedAt: edit.updatedAt,
          game: Number(relationID(edit.game)) || null,
          proposedGame: edit.proposedGame,
          realName: edit.realName,
          phone: edit.phone,
          reason: edit.reason,
          contactConsent: edit.contactConsent,
        }
      : undefined;
  return (
    <ClubFrame className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="申请导航">
        <Link href="/community">游戏社群</Link>
        <span aria-hidden="true">/</span>
        <span>管理员申请</span>
      </nav>
      <CommunityPageHeader
        title="申请成为社群管理员"
        description="把熟悉的游戏组织成日常交流、活动和比赛的社群。选择已有社群，或提出一个新的游戏项目。"
        action={
          <a className="button light" href="#my-applications">
            查看我的申请
          </a>
        }
      />
      {query.message && <p role="status">{query.message}</p>}
      {query.submitted ? (
        <section
          className={styles.receipt}
          role="status"
          data-state={apps.docs[0]?.status}
        >
          <h2>
            {apps.docs.some((app) => app.status === "pending")
              ? "申请已提交"
              : "核对我的申请"}
          </h2>
          <p>
            {apps.docs.some((app) => app.status === "pending")
              ? "已有待审核申请。请在下方核对对应游戏与提交时间，等待负责人审核。"
              : "请在下方查看当前申请记录与处理意见；如果记录尚未出现，先刷新核对后再决定是否重新提交。"}
          </p>
          <p>批准与网站初始化不代表已经创建或进入微信群。</p>
          <div className={styles.submitRow}>
            <a className="button" href="#my-applications">
              查看申请进度
            </a>
            <Link href="/community/apply">继续填写新申请</Link>
            <Link href="/account">返回我的账号</Link>
          </div>
        </section>
      ) : (
        <div className={styles.taskGrid}>
          <aside
            className={styles.taskAside}
            aria-labelledby="application-guide-title"
          >
            <h2 id="application-guide-title">从申请到组织社群</h2>
            <ol className={styles.steps} aria-label="社群管理员申请流程">
              <li>
                <div>
                  <strong>填写社群计划</strong>
                  <p>说明想组织的游戏和准备开展的工作。</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>等待负责人审核</strong>
                  <p>在我的申请中查看状态；退回后可修改重提。</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>获批后开始组织</strong>
                  <p>微信建群和拉群由管理员人工完成。</p>
                </div>
              </li>
            </ol>
            <h3>联系名片由你授权</h3>
            <p>
              只有申请获批、任职有效且已授权时，微信名片才向登录成员展示。获批后可更新名片或关闭展示。
            </p>
            <h3>申请资料的用途</h3>
            <p>姓名和手机号用于受控审核与联系。社群任职与平台角色分别管理。</p>
            <Link href="/privacy">阅读隐私说明</Link>
          </aside>
          <section
            className={styles.taskBody}
            aria-labelledby="application-form-title"
          >
            <h2 id="application-form-title">
              {initial ? "修改申请资料" : "填写申请资料"}
            </h2>
            <CommunityApplicationForm
              key={initial?.id ?? "new"}
              games={games.docs.map((game) => ({
                id: game.id,
                title: game.title,
              }))}
              initial={initial}
            />
          </section>
        </div>
      )}
      <section
        id="my-applications"
        className={styles.section}
        aria-labelledby="my-applications-title"
      >
        <CommunitySectionHeading title="我的申请" id="my-applications-title">
          <p>状态、处理意见与下一步</p>
        </CommunitySectionHeading>
        {apps.docs.length ? (
          <div className={styles.records}>
            {apps.docs.map((app) => (
              <article className={styles.record} key={app.id}>
                <div className={styles.recordGrid}>
                  <div>
                    <header className={styles.recordHeader}>
                      <div>
                        <h3>{app.proposedGame}</h3>
                        <p>
                          提交于{" "}
                          <time dateTime={app.createdAt}>
                            {formatDate(app.createdAt)}
                          </time>
                        </p>
                      </div>
                      <span
                        className={styles.status}
                        data-state={app.status ?? "pending"}
                      >
                        {applicationLabels[app.status ?? "pending"]}
                      </span>
                    </header>
                    {app.reviewNote && (
                      <div className={styles.note}>
                        <h3>处理意见</h3>
                        <p className="preserve">{app.reviewNote}</p>
                      </div>
                    )}
                    {app.status === "pending" && (
                      <p>负责人审核后，处理结果会显示在这条申请中。</p>
                    )}
                    {app.status === "approved" && (
                      <p>
                        社群任职已获批准。微信建群与实际进群仍由管理员人工操作和确认。
                      </p>
                    )}
                  </div>
                  <div>
                    {app.status === "approved" && (
                      <details className={styles.disclosure}>
                        <summary>管理我的联系名片</summary>
                        <p>
                          当前展示：
                          {app.contactConsent ? "已同意展示" : "已关闭展示"}
                          。任职有效时按此设置向登录成员展示。
                        </p>
                        <ActionForm
                          action={updateCommunityCardResultAction}
                          className="member-form"
                        >
                          <input type="hidden" name="id" value={app.id} />
                          <input
                            type="hidden"
                            name="revision"
                            value={app.updatedAt}
                          />
                          <label>
                            更新微信名片（不选保留原图）
                            <input
                              type="file"
                              name="wechatQr"
                              accept="image/png,image/jpeg,image/webp"
                            />
                          </label>
                          <label className="check">
                            <input
                              type="checkbox"
                              name="contactConsent"
                              defaultChecked={app.contactConsent ?? false}
                            />
                            {applicationContactConsentLabel}
                          </label>
                          <SubmitButton>保存名片与展示设置</SubmitButton>
                        </ActionForm>
                      </details>
                    )}
                    {["returned", "withdrawn"].includes(app.status ?? "") && (
                      <Link
                        className="button light"
                        href={`/community/apply?edit=${app.id}`}
                      >
                        修改并重新提交
                      </Link>
                    )}
                    {app.status === "pending" && (
                      <form action={withdrawApplicationAction}>
                        <input type="hidden" name="id" value={app.id} />
                        <input
                          type="hidden"
                          name="revision"
                          value={app.updatedAt}
                        />
                        <SubmitButton className="button light">
                          撤回网站申请
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <CommunityEmpty title="还没有管理员申请">
            <p>填写上方资料后，你的申请进度将保存在这里。</p>
          </CommunityEmpty>
        )}
      </section>
    </ClubFrame>
  );
}
