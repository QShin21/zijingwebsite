import { CommunityApplicationForm } from "@/components/CommunityApplicationForm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { cms, list } from "@/lib/content";
export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; submitted?: string }>;
}) {
  const p = await cms();
  const { user } = await p.auth({ headers: await headers() });
  if (!user) redirect("/login");
  const games = await list("games", {}, 1, 100);
  const apps = await p.find({
    collection: "community-applications",
    overrideAccess: false,
    user,
    where: { applicant: { equals: user.id } },
    sort: "-createdAt",
    limit: 10,
    depth: 0,
    select: { proposedGame: true, status: true, createdAt: true },
  });
  const query = await searchParams;
  return (
    <>
      <PageHeading
        title="申请成为社群管理员"
        eyebrow="BUILD A COMMUNITY"
        description="可选择已有游戏社群，或填写一个尚未建立的游戏项目；通过后自动建立该游戏社群及论坛。"
      />
      <section className="member-shell">
        <p role="status">{query.message}</p>
        {query.submitted ? (
          <div className="application-confirmation" role="status">
            <h2>申请已提交</h2>
            <p>
              请添加社长微信{" "}
              <strong className="wechat-account">yz167015</strong> 进行备案。
            </p>
            <p>添加时请备注姓名、网站昵称和申请的游戏社群，等待负责人审核。</p>
            <Link className="button light" href="/account">
              返回我的账号
            </Link>
            <Link href="/community/apply">继续填写新申请</Link>
          </div>
        ) : (
          <CommunityApplicationForm
            games={games.docs.map((game) => ({
              id: game.id,
              title: game.title,
            }))}
          />
        )}
        <h2>我的申请</h2>
        {apps.docs.length ? (
          <ul className="community-list">
            {apps.docs.map((app) => (
              <li key={app.id}>
                <strong>{app.proposedGame}</strong>
                <span>
                  {app.status === "pending"
                    ? "待审核"
                    : app.status === "approved"
                      ? "已通过"
                      : "未通过"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>暂无申请。</p>
        )}
        <Link href="/community">返回游戏社群</Link>
      </section>
    </>
  );
}
