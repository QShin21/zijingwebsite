import { redirect } from "next/navigation";

/** Existing preview links now open the maintained business page. */
export default async function CommunityDirection({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/community/${encodeURIComponent(slug)}`);
}
