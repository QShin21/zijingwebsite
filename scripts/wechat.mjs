import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const command = process.argv[2];
if (!['preview', 'upload', 'open', 'close', 'cache', 'auto', 'islogin'].includes(command)) {
  console.error('Usage: node scripts/wechat.mjs preview|upload|open|close|cache|auto|islogin [--port PORT]'); process.exit(1);
}
const project = path.resolve('miniprogram');
const { version } = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(project, 'project.config.json'), 'utf8'));
if (config.appid !== 'wxccf9f8fc9515ebd5' || config.miniprogramRoot !== 'src/') throw new Error('Unexpected Mini Program identity');
if (['preview', 'upload'].includes(command) && process.env.WECHAT_SKIP_CHECKS !== '1') {
  const check = spawnSync(process.execPath, ['scripts/check-miniapp.mjs'], { stdio: 'inherit', windowsHide: true });
  if (check.status !== 0) process.exit(check.status || 1);
}
const installRoot = process.env.WECHAT_DEVTOOLS_PATH || 'e:\\Program Files (x86)\\Tencent\\微信web开发者工具';
const entry = path.join(installRoot, 'resources/app.asar.unpacked/js/common/cli/index.js');
if (!fs.existsSync(entry)) throw new Error('Set WECHAT_DEVTOOLS_PATH to the installed developer tools directory');
const extra = process.argv.slice(3);
const requestedPort = extra.includes('--port') ? extra[extra.indexOf('--port') + 1] : process.env.WECHAT_DEVTOOLS_PORT;
const archivePath = path.join(installRoot, 'resources/app.asar');
const possible = [...new Set([archivePath, archivePath.replace(/^[A-Za-z]:/, value => value.toUpperCase()), archivePath.replace(/^[A-Za-z]:/, value => value.toLowerCase())])];
const profiles = possible.map(value => {
  const directory = path.join(os.homedir(), 'AppData/Local/微信开发者工具/User Data', createHash('md5').update(value).digest('hex'), 'Default');
  const marker = path.join(directory, '.ide');
  let port;
  try { port = JSON.parse(fs.readFileSync(marker, 'utf8')); } catch { /* Not an active CLI profile. */ }
  return { value, exists: fs.existsSync(directory), port, mtime: fs.existsSync(marker) ? fs.statSync(marker).mtimeMs : 0 };
}).filter(value => value.exists);
const selected = (profiles.find(value => Number(value.port) === Number(requestedPort)) || profiles.sort((a, b) => b.mtime - a.mtime)[0])?.value || possible[0];
// Installed Windows CLI versions derive different profile paths from drive-letter case.
// Use the existing installation profile; the normal CLI still checks its access token.
const bootstrap = `const path=require('node:path');let selected=${JSON.stringify(selected)};Object.defineProperty(global,'installPath',{configurable:true,get(){return selected},set(){}});const entry=${JSON.stringify(entry)};process.env.cwd=process.cwd();process.argv=[process.execPath,'--ms-enable-electron-run-as-node',entry,'--electron',...process.argv.slice(1)];require(entry);`;
const args = [command, '--project', project, '--lang', 'zh'];
if (!extra.includes('--port') && process.env.WECHAT_DEVTOOLS_PORT) args.push('--port', process.env.WECHAT_DEVTOOLS_PORT);
args.push(...extra);
const output = path.join(project, 'preview'); fs.mkdirSync(output, { recursive: true });
if (command === 'preview') args.push('--qr-format', 'image', '--qr-output', path.join(output, 'preview.png'), '--info-output', path.join(output, 'preview-info.json'));
if (command === 'upload') args.push('--version', process.env.MINIAPP_VERSION || version, '--desc', process.env.MINIAPP_DESCRIPTION || (version + ' 开发版'), '--info-output', path.join(output, 'upload-info.json'));
if (command === 'auto') args.push('--auto-port', process.env.MINIAPP_AUTO_PORT || '9420', '--trust-project');
const started = Date.now();
const result = spawnSync(process.execPath, ['-e', bootstrap, ...args], { stdio: 'inherit', env: process.env, windowsHide: true });
if (result.error) throw result.error;
if (result.status === 0 && ['preview', 'upload'].includes(command)) {
  // Some installed CLI versions exit zero after an API error. Require fresh official output.
  const info = path.join(output, command === 'preview' ? 'preview-info.json' : 'upload-info.json');
  const fresh = fs.existsSync(info) && fs.statSync(info).mtimeMs >= started;
  const size = fresh ? JSON.parse(fs.readFileSync(info, 'utf8')).size : null;
  const valid = Number.isFinite(typeof size === 'number' ? size : size?.total) && (typeof size === 'number' ? size : size.total) > 0;
  const qr = path.join(output, 'preview.png');
  if (!valid || (command === 'preview' && (!fs.existsSync(qr) || fs.statSync(qr).mtimeMs < started))) {
    console.error('Developer tools did not produce a fresh success result. See the API error above.');
    process.exit(1);
  }
}
process.exit(result.status || 0);
