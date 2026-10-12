import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const require = createRequire(new URL('../scripts/check-miniapp.mjs', import.meta.url));
const script = ts.transpileModule(readFileSync('scripts/check-miniapp.mjs', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

// Execute the complete gate against synthetic files; no source tree or git history is changed.
function check(wxml: string, options: { js?: string; urlCheck?: boolean } = {}) {
  const root = path.resolve('miniprogram');
  const source = path.join(root, 'src');
  const directory = path.join(source, 'pages/example');
  const directories = new Map([
    [source, ['app.json', 'pages']],
    [path.join(source, 'pages'), ['example']],
    [directory, ['index.js', 'index.wxml', 'index.wxss']],
  ]);
  const files = new Map([
    [path.join(root, 'project.config.json'), JSON.stringify({ appid: 'wxccf9f8fc9515ebd5', miniprogramRoot: 'src/', compileType: 'miniprogram', setting: { urlCheck: options.urlCheck ?? true } })],
    [path.join(source, 'app.json'), JSON.stringify({ pages: ['pages/example/index'], tabBar: { list: [] } })],
    [path.join(directory, 'index.js'), options.js ?? 'Page({ data: {} });'],
    [path.join(directory, 'index.wxml'), wxml],
    [path.join(directory, 'index.wxss'), 'page { color: #333; }'],
  ]);
  const messages: string[] = [];
  const runtimeChecks: { check: boolean }[] = [];
  const stopped = new Error('synthetic process.exit');
  let status = 0;
  const fs = {
    readFileSync(filename: string) {
      if (!files.has(filename)) throw new Error(`Unexpected fixture read: ${filename}`);
      return files.get(filename)!;
    },
    existsSync: (filename: string) => files.has(filename),
    statSync: (filename: string) => ({ size: Buffer.byteLength(files.get(filename)!) }),
    readdirSync: (filename: string) => directories.get(filename)!.map(name => ({ name, isDirectory: () => directories.has(path.join(filename, name)) })),
  };
  try {
    runInNewContext(script, {
      exports: {},
      require: (name: string) => name === 'node:fs' ? fs : name === './build-mini-questionnaire.mjs'
        ? { buildQuestionnaireRuntime: (value: { check: boolean }) => runtimeChecks.push(value) } : require(name),
      process: { exit: (value: number) => { status = value; throw stopped; } },
      console: { error: (value: string) => messages.push(value), log: (value: string) => messages.push(value) },
    }, { filename: 'scripts/check-miniapp.mjs' });
  } catch (cause) { if (cause !== stopped) throw cause; }
  expect(runtimeChecks).toEqual([{ check: true }]);
  return { status, messages: messages.join('\n') };
}

const invalid = [
  ['named AND', '<view wx:if="{{ready &amp;&amp; allowed}}"/>'],
  ['partly escaped AND', '<view wx:if="{{ready &amp;& allowed}}"/>'],
  ['decimal AND', '<view wx:if="{{ready &#38;&#038; allowed}}"/>'],
  ['hexadecimal AND', '<view wx:if="{{ready &#x26;&#X026; allowed}}"/>'],
  ['named less than', '<view wx:if="{{count &lt; limit}}"/>'],
  ['decimal less than', '<view wx:if="{{count &#60; limit}}"/>'],
  ['named greater than', '<view wx:if="{{count &gt; limit}}"/>'],
  ['hexadecimal greater than', '<view wx:if="{{count &#x3e; limit}}"/>'],
  ['escaped quote syntax', '<text>{{ &quot;quoted&quot; }}</text>'],
  ['text binding', '<text>{{left &amp; right}}</text>'],
  ['ordinary attribute binding', '<button disabled="{{busy &amp;&amp; active}}"/>'],
  ['binding after quoted closing delimiter', '<text>{{ "}}" }}{{ready &amp;&amp; active}}</text>'],
  ['operator after quoted closing delimiter', '<text>{{ "}}" + (ready &amp;&amp; active) }}</text>'],
  ['operator after escaped quote', String.raw`<text>{{ 'don\'t }}' + (ready &amp;&amp; active) }}</text>`],
  ['operator after nested objects', '<text>{{ ({ nested: {} }).ready &amp;&amp; active }}</text>'],
  ['multiline binding', '<view wx:if="{{ready\n&amp;&amp;\nactive}}"/>'],
  ['double encoded operator', '<text>{{ready &amp;amp;&amp;amp; active}}</text>'],
];
const valid = [
  ['visible text entities', '<text>A &amp; B &lt; C &gt; D &#38; &#x3e; &quot;label&quot;</text>'],
  ['static attribute entities', '<text data-label="A &amp; B"/>'],
  ['single quoted entities', '<text>{{ \'&amp;&amp;\' + \'&lt;\' + \'&#38;\' }}</text>'],
  ['double quoted entities', '<text>{{ "&amp;&amp;" + "&gt;" + "&#x26;" }}</text>'],
  ['raw operators', '<view wx:if="{{ready && allowed && count < limit && count > 0}}"/>'],
  ['quoted closing delimiter', '<text>{{ "}}" }}</text><text>A &amp; B</text>'],
  ['escaped single quote', String.raw`<text>{{ 'don\'t }} &amp;' }}</text>`],
  ['escaped double quote', String.raw`<text>{{ "say \"}} &lt;\"" }}</text>`],
  ['escaped backslash', String.raw`<text>{{ '\\' + '&amp;' }}</text>`],
  ['object braces', '<text>{{ {value: {}} }}{{ready && allowed}}</text>'],
  ['WXML comment', '<view><!-- {{ready &amp;&amp; active}} --><text>{{ready && active}}</text></view>'],
  ['quoted entities beside operators', '<view wx:if="{{ready && title === \'&amp;&amp;\'}}">{{ready ? \'&lt;\' : \'&gt;\'}}</view>'],
];

describe('WXML binding entity gate: actual check script with synthetic filesystem', () => {
  it.each(invalid)('rejects %s', (_name, wxml) => {
    const result = check(wxml);
    expect(result.status).toBe(1);
    expect(result.messages).toMatch(/HTML-escaped entity .* in WXML binding.*index\.wxml/);
  });
  it.each(valid)('allows %s', (_name, wxml) => {
    const result = check(wxml);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.messages)).toMatchObject({ pages: 1, domainChecking: true, nativeDependencies: 0 });
  });
  it.each([
    ['reactive binding', '<view wx:if="ready"/>', {}, 'Missing reactive template binding'],
    ['unsupported method', '<text>{{items.slice(0)}}</text>', {}, 'Unsupported template method'],
    ['native dependency', '<view/>', { js: "require('./missing');" }, 'Unresolved native dependency'],
    ['domain checking', '<view/>', { urlCheck: false }, 'Domain checking must remain enabled'],
  ] as const)('preserves the %s guard', (_name, wxml, options, message) => {
    const result = check(wxml, options);
    expect(result.status).toBe(1);
    expect(result.messages).toContain(message);
  });
});
