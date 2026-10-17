import type { Payload } from 'payload';
import type { User } from '@/payload-types';
import { validNickname, nicknameKey } from '@/lib/nickname';
import { canParticipate, canReviewPromotion, canReviewCommunityApplication, canAppoint, communityIDs } from '@/lib/rules';

export function miniappUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, roles: user.roles,
    accountStatus: user.accountStatus, department: user.department,
    teams: (user.teams || []).map(value => typeof value === "object" ? value.id : value),
    capabilities: { reviewPromotion: canReviewPromotion(user), reviewCommunityApplication: canReviewCommunityApplication(user), appoint: canAppoint(user),
      publishCommunities: communityIDs(user, "publishContent"), reviewShowcaseCommunities: communityIDs(user, "reviewShowcase"),
      viewSignupCommunities: communityIDs(user, "viewSignups"), exportSignupCommunities: communityIDs(user, "exportSignups") },
    communities: (user.communities || []).map(value => typeof value === 'object' ? value.id : value) };
}

/** Identity resolution stays on the server and never exposes another user's email. */
export async function miniappLogin(p: Payload, identifier: string, password: string) {
  let email = identifier.trim().toLowerCase();
  if (!email.includes('@')) {
    if (!validNickname(identifier.trim())) throw new Error('Invalid credentials');
    const found = await p.find({ collection: 'users', overrideAccess: true,
      where: { nameKey: { equals: nicknameKey(identifier.trim()) } }, limit: 1, depth: 0,
      select: { email: true } });
    if (!found.docs[0]) throw new Error('Invalid credentials');
    email = found.docs[0].email;
  }
  const result = await p.login({ collection: 'users', data: { email, password }, depth: 0 });
  if (!result.user || !canParticipate(result.user)) throw new Error('Invalid credentials');
  return { token: result.token, exp: result.exp, user: miniappUser(result.user) };
}
