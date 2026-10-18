/** Documentation-only static rendering. No production writes or native wx calls. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../..');
const browser = process.argv[2];
if (!browser || !fs.existsSync(browser)) throw new Error('Provide an existing Chromium/Edge executable path');
const renderer = path.join(root, 'scripts/rebuild-native-preview.mjs');
const run = (script, suite, fixtures, output) => {
  const result = spawnSync(process.execPath, [script, '--suite', suite, '--widths', '390',
    '--fixtures', fixtures.join(','), '--source-root', path.join(root, 'miniprogram/src'),
    '--output', path.join(root, '.data', output), '--browser', browser], { cwd: root, encoding: 'utf8' });
  process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
  if (result.status !== 0) throw new Error('Layout rendering failed: ' + suite);
};
// Old QA fixture wording mentions the retired join workflow. Change only the
// documentation fixture copy; current product WXML/WXSS/JS remains unmodified.
const temp = path.join(root, '.data/manual-render-source');
fs.mkdirSync(path.join(temp, 'scripts'), { recursive: true });
for (const file of ['rebuild-native-preview.mjs', 'miniapp-050-fixtures.mjs',
  'miniapp-050-stage-b-fixtures.mjs', 'wxml-preview-expression.mjs', 'wxml-preview-richtext.mjs']) {
  let text = fs.readFileSync(path.join(root, 'scripts', file), 'utf8');
  if (file === 'miniapp-050-fixtures.mjs') text = text
    .replace('本地合成社群，用于检查联系、加入意向与人工进群回执。', '本地合成社群，用于展示管理员联系方式和社群内容入口。')
    .replace('合成授权图片占位；尚无加入意向；长社群名称', '合成名片占位；联系管理员；不含进群进度');
  fs.writeFileSync(path.join(temp, 'scripts', file), text);
}
if (!fs.existsSync(path.join(temp, 'node_modules'))) fs.symlinkSync(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'junction');
run(path.join(temp, 'scripts/rebuild-native-preview.mjs'), 'stage-a',
  ['home-populated', 'events-populated', 'community-request'], 'manual-a');
run(renderer, 'stage-b', ['account-member','account-manager','explore-populated','detail-signup'], 'manual-b');
run(renderer, 'stage-c', ['auth-register-sent','signup-all-types','applications-new','staff-member-receipts',
  'signup-manage-advanced','signup-entries-viewer','activity-manage-community'], 'manual-c');
run(renderer, 'stage-d', ['team-recruitments','team-profiles-editor-hidden','team-honor-edit-new',
  'team-honor-workspace-review-evidence','team-review-join'], 'manual-d');
