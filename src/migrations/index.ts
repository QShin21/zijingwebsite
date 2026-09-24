import * as migration_20260920_102916 from './20260920_102916';
import * as migration_20260924_133459 from './20260924_133459';
import * as migration_20260924_134008 from './20260924_134008';

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
    name: '20260924_134008'
  },
];
