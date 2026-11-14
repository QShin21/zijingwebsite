import * as communityIcons from "./20261112_020000_community_icons";
import * as activitySeatBlocks from "./20261112_030000_activity_seat_blocks";
import * as publicationContent from "./20261113_000000_publication_content";
import * as publicationAssetOwner from "./20261113_000100_publication_asset_owner";
import * as honoraryBackbone from "./20261113_000200_honorary_backbone";
import * as restoreEditedPromotions from "./20261113_000300_restore_edited_promotions";
import * as activitySeatRevision from "./20261112_040000_activity_seat_revision";
import * as activitySeatCancellation from "./20261112_050000_activity_seat_cancellation";
import * as activitySeatRevocation from "./20261112_060000_activity_seat_revocation";
import * as activitySeatRelease from "./20261112_070000_activity_seat_release";
import * as activitySeatAddition from "./20261112_080000_activity_seat_addition";
import * as activitySeatModes from "./20261112_090000_activity_seat_modes";
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

import * as contentAudience from "./20261113_000400_content_audience";
import * as activitySignupLotteries from "./20261113_000500_activity_signup_lotteries";
import * as activitySeatTickets from "./20261113_000600_activity_seat_tickets";
import * as customSeatLayout from "./20261113_000700_custom_seat_layout";
import * as personalArchives from "./20261113_000800_personal_archives";
import * as contentTranslations from "./20261113_000900_content_translations";
import * as contentTranslationSources from "./20261114_001000_content_translation_sources";
import * as contentTranslationMoreSources from "./20261114_001100_content_translation_more_sources";
import * as quizPrizes from "./20261114_001200_quiz_prizes";

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
  { up: activitySeatCancellation.up, down: activitySeatCancellation.down, name: "20261112_050000_activity_seat_cancellation" },
  { up: activitySeatRevocation.up, down: activitySeatRevocation.down, name: "20261112_060000_activity_seat_revocation" },
  { up: activitySeatRelease.up, down: activitySeatRelease.down, name: "20261112_070000_activity_seat_release" },
  { up: activitySeatAddition.up, down: activitySeatAddition.down, name: "20261112_080000_activity_seat_addition" },
  { up: activitySeatModes.up, down: activitySeatModes.down, name: "20261112_090000_activity_seat_modes" },
  { up: publicationContent.up, down: publicationContent.down, name: "20261113_000000_publication_content" },
  { up: publicationAssetOwner.up, down: publicationAssetOwner.down, name: "20261113_000100_publication_asset_owner" },
  { up: honoraryBackbone.up, down: honoraryBackbone.down, name: "20261113_000200_honorary_backbone" },
  { up: restoreEditedPromotions.up, down: restoreEditedPromotions.down, name: "20261113_000300_restore_edited_promotions" },
  { up: contentAudience.up, down: contentAudience.down, name: "20261113_000400_content_audience" },
  { up: activitySignupLotteries.up, down: activitySignupLotteries.down, name: "20261113_000500_activity_signup_lotteries" },
  { up: activitySeatTickets.up, down: activitySeatTickets.down, name: "20261113_000600_activity_seat_tickets" },
  { up: customSeatLayout.up, down: customSeatLayout.down, name: "20261113_000700_custom_seat_layout" },
  { up: personalArchives.up, down: personalArchives.down, name: "20261113_000800_personal_archives" },
  { up: contentTranslations.up, down: contentTranslations.down, name: "20261113_000900_content_translations" },
  { up: contentTranslationSources.up, down: contentTranslationSources.down, name: "20261114_001000_content_translation_sources" },
  { up: contentTranslationMoreSources.up, down: contentTranslationMoreSources.down, name: "20261114_001100_content_translation_more_sources" },
  { up: quizPrizes.up, down: quizPrizes.down, name: "20261114_001200_quiz_prizes" },
];
