// Isolated synthetic task states. The original native engine supplies projections.
import { stageCSignupFixtures } from './miniapp-050-stage-c-signup-fixtures.mjs';
import { stageCCommunityFixtures } from './miniapp-050-stage-c-community-fixtures.mjs';
import { stageCStaffFixtures } from './miniapp-050-stage-c-staff-fixtures.mjs';

export function stageCFixtures(rt, native, exists) {
  return [
    ...stageCSignupFixtures(rt, native, exists),
    ...stageCCommunityFixtures(rt, native, exists),
    ...stageCStaffFixtures(rt, native, exists),
  ];
}
