import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

// Ship the same schema, validation and branching used by the website to WeChat.
// Generated native CommonJS modules contain no server or browser dependencies.
export function buildQuestionnaireRuntime({ check = false } = {}) {
  const directory = path.resolve('miniprogram/src/lib/generated');
  const modules = ['signup-schema', 'questionnaire-model', 'questionnaire-flow', 'team-recruitment-form'];
  if (!check) fs.mkdirSync(directory, { recursive: true });
  for (const name of modules) {
    const source = fs.readFileSync(`src/lib/${name}.ts`, 'utf8');
    const hash = createHash('sha256').update(source).digest('hex');
    const portable = source
      .replaceAll('new TextEncoder().encode(JSON.stringify(value)).length', 'utf8Length(JSON.stringify(value))')
      .replaceAll('Object.hasOwn(', 'Object.prototype.hasOwnProperty.call(')
      .replaceAll('Object.fromEntries(', 'fromEntries(')
      .replaceAll('pages.at(-1)', 'pages[pages.length - 1]');
    const prefix = name === 'signup-schema'
      ? 'const { utf8Length } = require("../questionnaire-runtime");\n'
      : name === 'questionnaire-model'
        ? 'const { fromEntries } = require("../questionnaire-runtime");\n'
        : '';
    const { outputText } = ts.transpileModule(prefix + portable, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, newLine: ts.NewLineKind.LineFeed },
    });
    const output = `// Generated from src/lib/${name}.ts; run pnpm miniapp:generate.\n// Source SHA-256: ${hash}\n${outputText}`;
    const target = path.join(directory, `${name}.js`);
    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output)
        throw new Error(`Native questionnaire runtime is stale: ${name}; run pnpm miniapp:generate`);
    } else fs.writeFileSync(target, output);
  }
  return { sharedQuestionnaireModules: modules.length, mode: check ? 'checked' : 'generated' };
}
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || ''))
  console.log(JSON.stringify(buildQuestionnaireRuntime({ check: process.argv.includes('--check') })));
