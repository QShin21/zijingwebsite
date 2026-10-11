import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cms, bySlug } from "@/lib/content";
import { communityContacts } from "@/lib/community-contacts";
import { CommunityJoinFlow } from "@/components/CommunityJoinFlow";
import { canParticipate } from "@/lib/rules";
export default async function Join({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await cms(), { user } = await p.auth({ headers: await headers() });
  const game = await bySlug("games", slug);
  if (!game || !canParticipate(user)) notFound();
  const receipt = (await p.find({ collection: "community-joins", overrideAccess: false, user, depth: 0, limit: 1,
    where: { and: [{ game: { equals: game.id } }, { member: { equals: user!.id } }] },
    select: { status: true, updatedAt: true, note: true, confirmedAt: true } })).docs[0] ?? null;
  return <CommunityJoinFlow game={game.id} contacts={await communityContacts(slug) ?? []} receipt={receipt} />;
}
