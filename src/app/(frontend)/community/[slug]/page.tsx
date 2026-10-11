import Link from "next/link";
export default async function CommunityHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="community-home-grid">{[
    ["updates", "活动与通知", "了解社群活动安排与最新通知。"],
    ["showcase", "社群风采", "分享活动照片、精彩集锦与值得记录的瞬间。"],
  ].map(([path, title, description]) => <Link className="panel" href={`/community/${slug}/${path}`} key={path}><h2>{title} ↗</h2><p>{description}</p></Link>)}</div>;
}
