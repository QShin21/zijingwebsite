import * as teamCore from './20261012_160000_team_core';
import * as activitySignups from './20261011_160000_activity_signups';
import * as clubOperations from './20261011_180000_club_operations';
import * as contentPromotions from './20261012_030000_content_promotions';
import * as staffRecruitment from './20261012_050000_staff_recruitment';
import * as teamMemberProfiles from './20261012_170000_team_member_profiles';
import * as teamHonorRecords from './20261012_080000_team_honor_records';
import * as chatNotifications from "./20260928_120000_chat_notifications";
import * as chatImages from "./20260929_010000_chat_images";
import * as migration_20260920_102916 from './20260920_102916';
import * as migration_20260924_133459 from './20260924_133459';
import * as migration_20260924_134008 from './20260924_134008';
import * as migration_20260926_145257_nickname_login from './20260926_145257_nickname_login';
import * as migration_20260927_004500_application_details from './20260927_004500_application_details';
import * as migration_20260927_181509_community_reactions from './20260927_181509_community_reactions';
import * as migration_20260927_181800_forum_curation from './20260927_181800_forum_curation';
import * as migration_20260927_182940_community_showcase from './20260927_182940_community_showcase';

export const migrations = [

  {
    up: migration_20260920_102916.up,
    down: migration_20260920_102916.down,
    name: '20260920_102916',
  },
  {
    up: migration_20260924_133459.up,
    down: migration_20260924_133459.down,
    name: '20260924_133459',
  },
  {
    up: migration_20260924_134008.up,
    down: migration_20260924_134008.down,
    name: '20260924_134008',
  },
  {
    up: migration_20260926_145257_nickname_login.up,
    down: migration_20260926_145257_nickname_login.down,
    name: '20260926_145257_nickname_login',
  },
  {
    up: migration_20260927_004500_application_details.up,
    down: migration_20260927_004500_application_details.down,
    name: '20260927_004500_application_details',
  },
  {
    up: migration_20260927_181509_community_reactions.up,
    down: migration_20260927_181509_community_reactions.down,
    name: '20260927_181509_community_reactions',
  },
  {
    up: migration_20260927_181800_forum_curation.up,
    down: migration_20260927_181800_forum_curation.down,
    name: '20260927_181800_forum_curation',
  },
  {
    up: migration_20260927_182940_community_showcase.up,
    down: migration_20260927_182940_community_showcase.down,
    name: '20260927_182940_community_showcase'
  },
  { up: chatNotifications.up, down: chatNotifications.down, name: "20260928_120000_chat_notifications" },
  { up: chatImages.up, down: chatImages.down, name: "20260929_010000_chat_images" },
  { up: activitySignups.up, down: activitySignups.down, name: '20261011_160000_activity_signups' },
  { up: clubOperations.up, down: clubOperations.down, name: '20261011_180000_club_operations' },
  { up: contentPromotions.up, down: contentPromotions.down, name: '20261012_030000_content_promotions' },
  { up: staffRecruitment.up, down: staffRecruitment.down, name: '20261012_050000_staff_recruitment' },
  { up: teamHonorRecords.up, down: teamHonorRecords.down, name: '20261012_080000_team_honor_records' },
  { up: teamCore.up, down: teamCore.down, name: '20261012_160000_team_core' },
  // Integration prerequisite: register the core 20261012_160000 migration before this entry.
  { up: teamMemberProfiles.up, down: teamMemberProfiles.down, name: '20261012_170000_team_member_profiles' },
];
