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
];
