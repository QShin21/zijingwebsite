import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve('miniprogram');
const source = path.join(root, 'src');
const app = JSON.parse(fs.readFileSync(path.join(source, 'app.json'), 'utf8'));
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
const failures = [];
if (project.appid !== 'wxccf9f8fc9515ebd5' || project.miniprogramRoot !== 'src/' || project.compileType !== 'miniprogram') failures.push('Wrong project identity or source directory');
if (project.setting.urlCheck !== true) failures.push('Domain checking must remain enabled in the shared project');
for (const route of app.pages) {
  for (const extension of ['.js', '.wxml', '.wxss']) if (!fs.existsSync(path.join(source, route + extension))) failures.push(`Missing ${route}${extension}`);
}
for (const tab of app.tabBar.list) {
  if (!app.pages.includes(tab.pagePath)) failures.push(`Unknown tab ${tab.pagePath}`);
  for (const icon of [tab.iconPath, tab.selectedIconPath]) if (!fs.existsSync(path.join(source, icon))) failures.push(`Missing tab icon ${icon}`);
}
let count = 0; let bytes = 0;
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(filename); continue; }
    count++; bytes += fs.statSync(filename).size;
    if (entry.name.endsWith('.json')) JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (entry.name.endsWith('.js')) {
      const text = fs.readFileSync(filename, 'utf8');
      new vm.Script(text, { filename });
      for (const match of text.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (!match[1].startsWith('.') || !fs.existsSync(path.resolve(path.dirname(filename), match[1] + '.js'))) failures.push(`Unresolved native dependency in ${filename}`);
      }
      if (/-----BEGIN (?:RSA )?PRIVATE KEY-----|AppSecret|PAYLOAD_SECRET\s*[:=]/.test(text)) failures.push(`Credential material in ${filename}`);
    }
    if (entry.name.endsWith('.wxml')) {
      const text = fs.readFileSync(filename, 'utf8');
      for (const binding of text.matchAll(/wx:(?:if|elif|for)="([^"]*)"/g)) {
        if (!binding[1].startsWith('{{') || !binding[1].endsWith('}}')) failures.push(`Missing reactive template binding in ${filename}`);
      }
      if (/\{\{[^}]*\.(slice|indexOf|substring|startsWith)\(/.test(text)) failures.push(`Unsupported template method in ${filename}`);
    }
  }
}
walk(source);
if (bytes > 2 * 1024 * 1024) failures.push('Main package exceeds 2 MiB');
if (failures.length) { failures.forEach(value => console.error(value)); process.exit(1); }
console.log(JSON.stringify({ pages: app.pages.length, files: count, bytes, domainChecking: true, nativeDependencies: 0 }));
