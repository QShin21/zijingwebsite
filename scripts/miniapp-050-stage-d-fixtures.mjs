// Isolated synthetic states for team membership, public records and controlled evidence.
import { stageDTeamFixtures } from './miniapp-050-stage-d-team-fixtures.mjs';
import { stageDHonorFixtures } from './miniapp-050-stage-d-honor-fixtures.mjs';

export function stageDFixtures(rt, native, exists) {
  return [
    ...stageDTeamFixtures(rt, native, exists),
    ...stageDHonorFixtures(rt, native, exists),
  ];
}
