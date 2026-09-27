import { cms, bySlug } from "./content";

// Server-only projection. This context is never taken from HTTP input.
// Collection access still applies; private application/user fields never leave this function.
export async function communityContacts(slug: string) {
  const game = await bySlug("games", slug);
  if (!game) return null;
  const p = await cms();
  const options = { overrideAccess: false as const, user: null, depth: 0,
    context: { publicCommunityContacts: game.id }, pagination: false };
  const users = await p.find({ collection: "users", ...options, select: { name: true } });
  if (!users.docs.length) return [];
  const applications = await p.find({ collection: "community-applications", ...options,
    where: { applicant: { in: users.docs.map(u => u.id) } }, sort: "-createdAt",
    select: { applicant: true, wechatQr: true } });
  return users.docs.flatMap(user => {
    const application = applications.docs.find(a => Number(a.applicant) === user.id && a.wechatQr);
    return application ? [{ id: user.id, name: user.name, qr: application.wechatQr! }] : [];
  });
}
