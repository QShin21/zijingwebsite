import { CommunityApplicationForm } from "@/components/CommunityApplicationForm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionForm } from "@/components/activity-pages/ActionForm";
import { cms, list } from "@/lib/content";
import { applicationLabels, applicationContactConsentLabel } from "@/lib/community-status";
import { relationID, formatDate } from "@/lib/rules";
import { withdrawApplicationAction, updateCommunityCardResultAction } from "../actions";
import { TaskFrame, TaskNote } from "@/components/v2/TaskFrame";
import { EmptyState, Section, StatusPill, buttonClass, type Tone } from "@/components/v2/ui";
import work from "@/components/v2/work.module.css";

export const metadata = { title: "申请成为社群管理员", robots: { index: false, follow: false } };

const tone: Record<string, Tone> = { pending: "info", approved: "success", returned: "warning", rejected: "danger", withdrawn: "neutral" };

export default async function Apply({ searchParams }: { searchParams: Promise<{ message?: string; submitted?: string; edit?: string }> }) {
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
    select: { proposedGame: true, status: true, createdAt: true, updatedAt: true, game: true, reviewNote: true, contactConsent: true },
  });
  const edit = query.edit
    ? await p.findByID({ collection: "community-applications", id: Number(query.edit), overrideAccess: false, user, depth: 0 }).catch(() => null)
    : null;
  const initial =
    edit && Number(relationID(edit.applicant)) === user.id && ["returned", "withdrawn"].includes(edit.status || "")
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
  const pending = apps.docs.some((app) => app.status === "pending");

  return (
    <TaskFrame
      eyebrow="COMMUNITY · 社群管理员申请"
      title="申请成为社群管理员"
      description="把熟悉的游戏组织成日常交流、活动和比赛的社群。选择已有社群，或提出一个新的游戏项目。"
      back={{ href: "/community", label: "游戏社群" }}
      steps={["填写社群计划", "等待负责人审核", "获批后开始组织"]}
      current={query.submitted ? 1 : 0}
      actions={
        <a className={buttonClass("stage")} href="#my-applications">
          查看我的申请
        </a>
      }
      aside={
        <>
          <TaskNote title="从申请到组织社群">
            <p>说明想组织的游戏和准备开展的工作；在“我的申请”中查看状态，退回后可修改重提。</p>
            <p>获批后开始组织，微信建群和拉群由管理员人工完成。</p>
          </TaskNote>
          <TaskNote title="联系名片由你授权">
            <p>只有申请获批、任职有效且已授权时，微信名片才向登录成员展示。获批后可更新名片或关闭展示。</p>
          </TaskNote>
          <TaskNote title="申请资料的用途" links={[{ href: "/privacy", label: "阅读隐私说明" }]}>
            <p>姓名和手机号用于受控审核与联系。社群任职与平台角色分别管理。</p>
          </TaskNote>
        </>
      }
    >
      {query.message && <p role="status">{query.message}</p>}
      {query.submitted ? (
        <section className={work.panel} role="status" data-state={apps.docs[0]?.status}>
          <h2>{pending ? "申请已提交" : "核对我的申请"}</h2>
          <p>
            {pending
              ? "已有待审核申请。请在下方核对对应游戏与提交时间，等待负责人审核。"
              : "请在下方查看当前申请记录与处理意见；如果记录尚未出现，先刷新核对后再决定是否重新提交。"}
          </p>
          <p>批准与网站初始化不代表已经创建或进入微信群。</p>
          <div className={work.actions}>
            <a className={buttonClass("primary", "small")} href="#my-applications">
              查看申请进度
            </a>
            <Link className={work.chipLink} href="/community/apply">
              继续填写新申请
            </Link>
            <Link className={work.chipLink} href="/account">
              返回我的
            </Link>
          </div>
        </section>
      ) : (
        <section className={work.panel} aria-labelledby="application-form-title">
          <h2 id="application-form-title">{initial ? "修改申请资料" : "填写申请资料"}</h2>
          <CommunityApplicationForm key={initial?.id ?? "new"} games={games.docs.map((game) => ({ id: game.id, title: game.title }))} initial={initial} />
        </section>
      )}

      <Section id="my-applications" title="我的申请" description="状态、处理意见与下一步。">
        {apps.docs.length ? (
          <div className={work.records}>
            {apps.docs.map((app) => {
              const status = app.status ?? "pending";
              return (
                <article className={work.record} key={app.id} data-state={status}>
                  <header className={work.recordHead}>
                    <div>
                      <h3>{app.proposedGame}</h3>
                      <p className={work.meta}>
                        提交于 <time dateTime={app.createdAt}>{formatDate(app.createdAt)}</time>
                      </p>
                    </div>
                    <StatusPill tone={tone[status] ?? "neutral"}>{applicationLabels[status]}</StatusPill>
                  </header>
                  {app.reviewNote && (
                    <div className={work.submission}>
                      <h4>处理意见</h4>
                      <p className="preserve">{app.reviewNote}</p>
                    </div>
                  )}
                  {status === "pending" && <p className={work.meta}>负责人审核后，处理结果会显示在这条申请中。</p>}
                  {status === "approved" && <p className={work.meta}>社群任职已获批准。微信建群与实际进群仍由管理员人工操作和确认。</p>}
                  {status === "approved" && (
                    <details className={work.disclosure}>
                      <summary>管理我的联系名片</summary>
                      <p>当前展示：{app.contactConsent ? "已同意展示" : "已关闭展示"}。任职有效时按此设置向登录成员展示。</p>
                      <ActionForm action={updateCommunityCardResultAction} className="member-form">
                        <input type="hidden" name="id" value={app.id} />
                        <input type="hidden" name="revision" value={app.updatedAt} />
                        <label>
                          更新微信名片（不选保留原图）
                          <input type="file" name="wechatQr" accept="image/png,image/jpeg,image/webp" />
                        </label>
                        <label className="check">
                          <input type="checkbox" name="contactConsent" defaultChecked={app.contactConsent ?? false} />
                          {applicationContactConsentLabel}
                        </label>
                        <SubmitButton>保存名片与展示设置</SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                  <div className={work.actions}>
                    {["returned", "withdrawn"].includes(status) && (
                      <Link className={buttonClass("primary", "small")} href={`/community/apply?edit=${app.id}`}>
                        修改并重新提交
                      </Link>
                    )}
                    {status === "pending" && (
                      <form action={withdrawApplicationAction}>
                        <input type="hidden" name="id" value={app.id} />
                        <input type="hidden" name="revision" value={app.updatedAt} />
                        <SubmitButton className={buttonClass("ghost", "small")}>撤回网站申请</SubmitButton>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="还没有管理员申请" icon="inbox" compact>
            填写上方资料后，你的申请进度将保存在这里。
          </EmptyState>
        )}
      </Section>
    </TaskFrame>
  );
}
