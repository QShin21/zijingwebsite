import Image from "next/image";
import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { cms } from "@/lib/content";
import { canPublish } from "@/lib/rules";
import { decideAction } from "../actions";
export default async function Review({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; done?: string }>;
}) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!canPublish(user)) notFound();
  const apps = await p.find({
    collection: "community-applications",
    overrideAccess: false,
    user,
    where: { status: { equals: "pending" } },
    sort: "createdAt",
    limit: 50,
    depth: 0,
  });
  const ids = apps.docs.map((app) =>
    typeof app.applicant === "object" ? app.applicant.id : app.applicant,
  );
  const applicants = ids.length
    ? await p.find({
        collection: "users",
        overrideAccess: false,
        user,
        where: { id: { in: ids } },
        limit: 50,
        depth: 0,
        select: { name: true, email: true, accountStatus: true },
      })
    : { docs: [] };
  const byId = new Map(applicants.docs.map((person) => [person.id, person]));
  const query = await searchParams;
  return (
    <>
      <PageHeading
        title="社群管理员申请审核"
        eyebrow="REVIEW QUEUE"
        description="审核通过已有游戏的申请，或创建新游戏社群并授予对应管理权限。"
      />
      <section className="member-shell">
        <p role="status">
          {query.message || (query.done ? "审核结果已保存。" : "")}
        </p>
        {apps.docs.length ? (
          apps.docs.map((app) => {
            const person = byId.get(
              typeof app.applicant === "object"
                ? app.applicant.id
                : app.applicant,
            );
            const complete = Boolean(
              app.realName && app.phone && app.wechatQr && person,
            );
            return (
              <article className="panel" key={app.id}>
                <h2>{app.proposedGame}</h2>
                <dl className="account-details">
                  <div>
                    <dt>姓名</dt>
                    <dd>{app.realName || "待补充"}</dd>
                  </div>
                  <div>
                    <dt>手机号</dt>
                    <dd>{app.phone || "待补充"}</dd>
                  </div>
                  <div>
                    <dt>昵称</dt>
                    <dd>{person?.name || "账号已不可用"}</dd>
                  </div>
                  <div>
                    <dt>邮箱</dt>
                    <dd>{person?.email || "账号已不可用"}</dd>
                  </div>
                  <div>
                    <dt>提交时间</dt>
                    <dd>
                      {new Date(app.createdAt).toLocaleString("zh-CN", {
                        timeZone: "Asia/Shanghai",
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>账号状态</dt>
                    <dd>
                      {person?.accountStatus === "suspended"
                        ? "已停用"
                        : person
                          ? "正常"
                          : "已不可用"}
                    </dd>
                  </div>
                </dl>
                {app.wechatQr && (
                  <figure className="application-qr">
                    <Image
                      unoptimized
                      src={`/community/applications/${app.id}/qr`}
                      width={280}
                      height={280}
                      alt="申请人的微信名片二维码"
                    />
                    <figcaption>
                      <a
                        href={`/community/applications/${app.id}/qr`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看完整二维码
                      </a>
                    </figcaption>
                  </figure>
                )}
                {!complete && (
                  <p className="form-feedback">
                    此申请资料不全，请退回后联系申请人重新提交。
                  </p>
                )}
                <h3>申请说明</h3>
                <p className="preserve">{app.reason}</p>
                <p>{app.game ? "加入已有社群" : "通过后建立新社群"}</p>
                <div className="review-actions">
                  <form action={decideAction}>
                    <input type="hidden" name="id" value={app.id} />
                    <SubmitButton
                      className="button light"
                      name="decision"
                      value="approved"
                      disabled={!complete}
                    >
                      批准
                    </SubmitButton>
                  </form>
                  <form action={decideAction}>
                    <input type="hidden" name="id" value={app.id} />
                    <SubmitButton
                      className="button"
                      name="decision"
                      value="rejected"
                    >
                      退回
                    </SubmitButton>
                  </form>
                </div>
              </article>
            );
          })
        ) : (
          <p>目前没有待审核申请。</p>
        )}
      </section>
    </>
  );
}
