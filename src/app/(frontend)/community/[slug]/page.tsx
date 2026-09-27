import Link from "next/link";
export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="community-home-grid">{[
    ["updates", "活动与通知", "了解社群活动、阅读通知，留言并表达参加意愿。"],
    ["forum", "论坛讨论", "发起话题、交流心得，查看社群精选讨论。"],
    ["chat", "社群交流", "和伙伴聊聊近况、组队开黑，随时查看聊天记录。"],
    ["showcase", "社群风采", "分享活动照片、精彩集锦与值得记录的瞬间。"],
  ].map(([path, title, description]) => <Link className="panel" href={`/community/${slug}/${path}`} key={path}><h2>{title} ↗</h2><p>{description}</p></Link>)}</div>;
}
