import { canPublish, communityIDs, relationID, type Identity } from "./rules";

/** Current community offices own their artwork; platform publishers manage all communities. */
export const canManageCommunityIcon = (
  user: Identity | null | undefined,
  game: unknown,
) => canPublish(user) || communityIDs(user).includes(String(relationID(game)));
