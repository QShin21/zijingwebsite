import * as communityIcons from "./20261112_020000_community_icons";
import * as activitySeatBlocks from "./20261112_030000_activity_seat_blocks";
import * as activitySeatRevision from "./20261112_040000_activity_seat_revision";
import * as activitySeating from "./20261112_000000_activity_seating";
import * as activitySeatingSchedule from "./20261112_010000_activity_seating_schedule";
import * as v2HomeSections from "./20261112_000000_v2_home_sections";
import * as publicationImages from "./20261110_000000_publication_images";
import * as v2MediaSchedule from "./20261111_000000_v2_media_schedule";
import * as activitySignups from './20261011_160000_activity_signups';
import * as clubOperations from './20261011_180000_club_operations';
import * as contentPromotions from './20261012_030000_content_promotions';
import * as staffRecruitment from './20261012_050000_staff_recruitment';
import * as teamMemberProfiles from './20261012_170000_team_member_profiles';
import * as teamHonorRecords from './20261012_080000_team_honor_records';
import * as teamCore from './20261012_160000_team_core';
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
  // Authorized core dependency: source aec6f2675fbbe6074ad3867cff21e6fc69c6adaa; core first.
  { up: teamCore.up, down: teamCore.down, name: '20261012_160000_team_core' },
  { up: teamMemberProfiles.up, down: teamMemberProfiles.down, name: '20261012_170000_team_member_profiles' },
  { up: publicationImages.up, down: publicationImages.down, name: '20261110_000000_publication_images' },
  { up: v2MediaSchedule.up, down: v2MediaSchedule.down, name: '20261111_000000_v2_media_schedule' },
  { up: v2HomeSections.up, down: v2HomeSections.down, name: "20261112_000000_v2_home_sections" },
  { up: activitySeating.up, down: activitySeating.down, name: "20261112_000000_activity_seating" },
  { up: activitySeatingSchedule.up, down: activitySeatingSchedule.down, name: "20261112_010000_activity_seating_schedule" },
  { up: communityIcons.up, down: communityIcons.down, name: "20261112_020000_community_icons" },
  { up: activitySeatBlocks.up, down: activitySeatBlocks.down, name: "20261112_030000_activity_seat_blocks" },
  { up: activitySeatRevision.up, down: activitySeatRevision.down, name: "20261112_040000_activity_seat_revision" },
];
