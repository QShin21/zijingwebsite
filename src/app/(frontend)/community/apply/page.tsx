import { CommunityApplicationForm } from "@/components/CommunityApplicationForm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { SubmitButton } from "@/components/SubmitButton";
import { cms, list } from "@/lib/content";
import { applicationLabels, applicationContactConsentLabel } from "@/lib/community-status";
import { relationID } from "@/lib/rules";
import {
  withdrawApplicationAction,
  updateCommunityCardAction,
} from "../actions";
import { formatDate } from "@/lib/rules";
import { ClubFrame, ClubSteps } from "../../_club/ClubPage";
import styles from "../../_club/ClubPages.module.css";
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
    <ClubFrame>
      <PageHeading
        title="申请成为社群管理员"
        eyebrow="社群组织"
        description="申请组织已有游戏社群或创建新群。批准后获得对应社群任职，保留原平台角色；微信群由管理员人工建立和拉群。"
      />
      <ClubSteps
        label="社群管理员申请流程"
        steps={[
          {
            title: "填写申请资料",
            description: "选择已有社群，或提出新的游戏项目。",
          },
          {
            title: "等待负责人审核",
            description: "在我的申请中查看状态与处理意见。",
          },
          {
            title: "获批后组织社群",
            description: "微信建群与拉群由管理员人工完成。",
          },
        ]}
      />
      <section className="member-shell">
        <p role="status">{query.message}</p>
        {query.submitted ? (
          <div className="application-confirmation" role="status">
            <h2>申请已提交</h2>
            <p>
              请等待负责人审核，可在下方查看状态和处理意见。批准与网站初始化不代表已经创建或进入微信群。
            </p>
            <Link className="button light" href="/account">
              返回我的账号
            </Link>{" "}
            <Link href="/community/apply">继续填写新申请</Link>
          </div>
        ) : (
          <div className={styles.split}>
            <section
              className={styles.formSurface}
              aria-labelledby="application-form-title"
            >
              <p className={styles.kicker}>管理员申请</p>
              <h2 id="application-form-title">
                {initial ? "修改申请资料" : "填写申请资料"}
              </h2>
              <p>准备好个人联系资料，以及你希望如何组织社群。</p>
              <CommunityApplicationForm
                key={initial?.id ?? "new"}
                games={games.docs.map((game) => ({
                  id: game.id,
                  title: game.title,
                }))}
                initial={initial}
              />
            </section>
            <aside className={styles.aside}>
              <h2>填写前，请了解</h2>
              <h3>已有社群 / 新建社群</h3>
              <p>申请管理已有社群时选择游戏项目；新建社群时填写新游戏名称。</p>
              <h3>微信名片展示授权</h3>
              <p>
                提交管理员申请须本人明确勾选名片展示同意。只有获批且任职有效时，名片才向登录成员展示。
              </p>
              <h3>资料与进度</h3>
              <p>
                姓名和手机号仅用于受控审核。待审可撤回；退回后可修改重提；获批后可更新或关闭名片展示。
              </p>
              <Link href="/privacy">阅读隐私说明 ↗</Link>
            </aside>
          </div>
        )}
        <section
          className={styles.recordSection}
          aria-labelledby="my-applications-title"
        >
          <div className={styles.sectionHead}>
            <h2 id="my-applications-title">我的申请</h2>
            <p>查看进度，继续下一步</p>
          </div>
          {apps.docs.length ? (
            apps.docs.map((app) => (
              <article className="panel" key={app.id}>
                <div className={styles.recordHead}>
                  <h3>{app.proposedGame}</h3>
                  <span
                    className={styles.status}
                    data-state={app.status ?? "pending"}
                  >
                    {applicationLabels[app.status ?? "pending"]}
                  </span>
                </div>
                <p className={styles.recordDate}>
                  提交时间：{formatDate(app.createdAt)}
                </p>
                {app.reviewNote && (
                  <p className="preserve">处理意见：{app.reviewNote}</p>
                )}
                {app.status === "approved" && (
                  <>
                    <p>
                      社群任职与平台角色分开。实际进群仍由微信管理员人工操作和确认。
                    </p>
                    <form
                      action={updateCommunityCardAction}
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
                    </form>
                  </>
                )}
                {["returned", "withdrawn"].includes(app.status ?? "") && (
                  <Link href={`/community/apply?edit=${app.id}`}>
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
              </article>
            ))
          ) : (
            <div className="empty">
              <div>
                <h3>暂无申请。</h3>
                <p>填写上方资料后，你的申请进度将保存在这里。</p>
              </div>
            </div>
          )}
        </section>
        <Link href="/community">返回游戏社群</Link>
      </section>
    </ClubFrame>
  );
}
