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
import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/i18n/locale";
import { localizeAccountMessage } from "@/lib/i18n/messages-account";
import { applicationLabelsEn, keyedLabel } from "@/lib/i18n/labels-account";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("申请成为社群管理员", "Apply to be a community admin"), robots: { index: false, follow: false } };
}

const tone: Record<string, Tone> = { pending: "info", approved: "success", returned: "warning", rejected: "danger", withdrawn: "neutral" };

export default async function Apply({ searchParams }: { searchParams: Promise<{ message?: string; submitted?: string; edit?: string }> }) {
  const p = await cms(),
    { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const { t, locale } = await getT();
  const when = (value?: string | null) => (locale === "en" ? formatDateTime(value, "en") || "TBA" : formatDate(value));
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
      eyebrow={t("COMMUNITY · 社群管理员申请", "COMMUNITY · Admin application")}
      title={t("申请成为社群管理员", "Apply to be a community admin")}
      description={t("把熟悉的游戏组织成日常交流、活动和比赛的社群。选择已有社群，或提出一个新的游戏项目。", "Turn a game you know into a community for chat, events and matches. Pick an existing community or propose a new game.")}
      back={{ href: "/community", label: t("游戏社群", "Game communities") }}
      steps={[t("填写社群计划", "Write your plan"), t("等待负责人审核", "Wait for review"), t("获批后开始组织", "Start organizing once approved")]}
      current={query.submitted ? 1 : 0}
      actions={
        <a className={buttonClass("stage")} href="#my-applications">
          {t("查看我的申请", "View my applications")}
        </a>
      }
      aside={
        <>
          <TaskNote title={t("从申请到组织社群", "From application to community")}>
            <p>{t("说明想组织的游戏和准备开展的工作；在“我的申请”中查看状态，退回后可修改重提。", "Describe the game and what you plan to do. Track status under “My applications”; returned applications can be edited and resubmitted.")}</p>
            <p>{t("获批后开始组织，微信建群和拉群由管理员人工完成。", "Start organizing once approved. WeChat groups are created and joined manually by admins.")}</p>
          </TaskNote>
          <TaskNote title={t("联系名片由你授权", "You control your contact card")}>
            <p>{t("只有申请获批、任职有效且已授权时，微信名片才向登录成员展示。获批后可更新名片或关闭展示。", "Your WeChat card is shown to signed-in members only when approved, in office and authorized by you. You can update or hide it after approval.")}</p>
          </TaskNote>
          <TaskNote title={t("申请资料的用途", "How your details are used")} links={[{ href: "/privacy", label: t("阅读隐私说明", "Read the privacy notice") }]}>
            <p>{t("姓名和手机号用于受控审核与联系。社群任职与平台角色分别管理。", "Your name and phone are used only for review and contact. Community positions and platform roles are managed separately.")}</p>
          </TaskNote>
        </>
      }
    >
      {query.message && <p role="status">{localizeAccountMessage(query.message, locale)}</p>}
      {query.submitted ? (
        <section className={work.panel} role="status" data-state={apps.docs[0]?.status}>
          <h2>{pending ? t("申请已提交", "Application submitted") : t("核对我的申请", "Check my applications")}</h2>
          <p>
            {pending
              ? t("已有待审核申请。请在下方核对对应游戏与提交时间，等待负责人审核。", "You have an application pending review. Check the game and submission time below.")
              : t("请在下方查看当前申请记录与处理意见；如果记录尚未出现，先刷新核对后再决定是否重新提交。", "See your application records and review notes below. If a record is missing, refresh and check before submitting again.")}
          </p>
          <p>{t("批准与网站初始化不代表已经创建或进入微信群。", "Approval and website setup do not mean a WeChat group has been created or joined.")}</p>
          <div className={work.actions}>
            <a className={buttonClass("primary", "small")} href="#my-applications">
              {t("查看申请进度", "View progress")}
            </a>
            <Link className={work.chipLink} href="/community/apply">
              {t("继续填写新申请", "Start a new application")}
            </Link>
            <Link className={work.chipLink} href="/account">
              {t("返回我的", "Back to Me")}
            </Link>
          </div>
        </section>
      ) : (
        <section className={work.panel} aria-labelledby="application-form-title">
          <h2 id="application-form-title">{initial ? t("修改申请资料", "Edit application") : t("填写申请资料", "Application details")}</h2>
          <CommunityApplicationForm key={initial?.id ?? "new"} games={games.docs.map((game) => ({ id: game.id, title: game.title }))} initial={initial} />
        </section>
      )}

      <Section id="my-applications" title={t("我的申请", "My applications")} description={t("状态、处理意见与下一步。", "Status, review notes and next steps.")}>
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
                        {t("提交于", "Submitted")} <time dateTime={app.createdAt}>{when(app.createdAt)}</time>
                      </p>
                    </div>
                    <StatusPill tone={tone[status] ?? "neutral"}>{keyedLabel(locale, status, applicationLabelsEn, applicationLabels[status])}</StatusPill>
                  </header>
                  {app.reviewNote && (
                    <div className={work.submission}>
                      <h4>{t("处理意见", "Review note")}</h4>
                      <p className="preserve">{app.reviewNote}</p>
                    </div>
                  )}
                  {status === "pending" && <p className={work.meta}>{t("负责人审核后，处理结果会显示在这条申请中。", "The result appears here after review.")}</p>}
                  {status === "approved" && <p className={work.meta}>{t("社群任职已获批准。微信建群与实际进群仍由管理员人工操作和确认。", "Your community position is approved. WeChat groups are still created and joined manually by admins.")}</p>}
                  {status === "approved" && (
                    <details className={work.disclosure}>
                      <summary>{t("管理我的联系名片", "Manage my contact card")}</summary>
                      <p>{app.contactConsent ? t("当前展示：已同意展示。任职有效时按此设置向登录成员展示。", "Display: shown. While in office it is shown to signed-in members per this setting.") : t("当前展示：已关闭展示。任职有效时按此设置向登录成员展示。", "Display: hidden. While in office it is shown to signed-in members per this setting.")}</p>
                      <ActionForm action={updateCommunityCardResultAction} className="member-form">
                        <input type="hidden" name="id" value={app.id} />
                        <input type="hidden" name="revision" value={app.updatedAt} />
                        <label>
                          {t("更新微信名片（不选保留原图）", "Update WeChat card (leave empty to keep current)")}
                          <input type="file" name="wechatQr" accept="image/png,image/jpeg,image/webp" />
                        </label>
                        <label className="check">
                          <input type="checkbox" name="contactConsent" defaultChecked={app.contactConsent ?? false} />
                          {t(applicationContactConsentLabel, "I agree to show my WeChat card as the contact for joining the group")}
                        </label>
                        <SubmitButton>{t("保存名片与展示设置", "Save card and display settings")}</SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                  <div className={work.actions}>
                    {["returned", "withdrawn"].includes(status) && (
                      <Link className={buttonClass("primary", "small")} href={`/community/apply?edit=${app.id}`}>
                        {t("修改并重新提交", "Edit and resubmit")}
                      </Link>
                    )}
                    {status === "pending" && (
                      <form action={withdrawApplicationAction}>
                        <input type="hidden" name="id" value={app.id} />
                        <input type="hidden" name="revision" value={app.updatedAt} />
                        <SubmitButton className={buttonClass("ghost", "small")}>{t("撤回网站申请", "Withdraw website application")}</SubmitButton>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={t("还没有管理员申请", "No admin applications yet")} icon="inbox" compact>
            {t("填写上方资料后，你的申请进度将保存在这里。", "After you fill in the form above, your progress is saved here.")}
          </EmptyState>
        )}
      </Section>
    </TaskFrame>
  );
}
