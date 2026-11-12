import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';

// Never reads .env or connects to an existing server. Retains all synthetic
// databases/media/logs after the run; no cleanup, drop or backup retention.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(repo, '.data'), { recursive: true });
const directory = await fs.mkdtemp(path.join(repo, '.data/v2-database-compatibility-'));
const app = path.join(directory, 'app');
await fs.mkdir(app);
for (const name of ['src', 'scripts', 'tests', 'package.json', 'tsconfig.json', 'vitest.config.ts']) {
  await fs.cp(path.join(repo, name), path.join(app, name), { recursive: true });
}
await fs.symlink(path.join(repo, 'node_modules'), path.join(app, 'node_modules'), 'dir');
await fs.mkdir(path.join(app, 'docs/evidence'), { recursive: true });
await fs.writeFile(path.join(app, '.env'), '# Synthetic database compatibility only\n');
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address(); server.close(() => resolve(port));
  });
});
const user = 'zijing_v2_backend_synthetic', password = 'Synthetic-Only-Database-Compatibility';
const postgres = new EmbeddedPostgres({
  databaseDir: path.join(directory, 'pg'), port, user, password, persistent: true,
  postgresFlags: ['-h', '127.0.0.1', '-k', ''],
  onLog(message) { if (/FATAL|ERROR/.test(String(message))) console.error(message); }, onError(message) { console.error(String(message)); },
});
const env = {
  PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', TZ: 'UTC',
  NODE_ENV: 'development', APP_ENV: 'development', DB_PUSH: 'false',
  DATABASE_URL: `postgresql://${user}:${password}@127.0.0.1:${port}/zijing_v2_backend_synthetic`,
  PAYLOAD_SECRET: 'Synthetic-Only-V2-Compatibility-Secret-20261112',
  PAYLOAD_CONFIG_PATH: path.join(app, 'src/payload.config.ts'),
  DOTENV_CONFIG_PATH: path.join(app, '.env'), DOTENV_CONFIG_QUIET: 'true',
  SERVER_URL: 'http://localhost:3000', NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  MEDIA_DIR: path.join(directory, 'media'), SMTP_HOST: '', S3_BUCKET: '',
  NEXT_TELEMETRY_DISABLED: '1', DISABLE_PAYLOAD_HMR: 'true',
  REBUILD_QA_PROFILE: 'contracts', V2_COMPAT_SYNTHETIC: 'true',
  V2_COMPAT_EVIDENCE: path.join(directory, 'evidence.json'),
};
await fs.mkdir(env.MEDIA_DIR);
async function run(args, logName) {
  const log = await fs.open(path.join(directory, logName), 'w');
  let writes = Promise.resolve();
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => { process.stdout.write(chunk); writes = writes.then(() => log.write(chunk)).then(() => {}); });
      child.stderr.on('data', chunk => { process.stderr.write(chunk); writes = writes.then(() => log.write(chunk)).then(() => {}); });
      child.on('error', reject); child.on('close', resolve);
    });
    await writes;
    if (code !== 0) throw new Error(`${logName} failed (exit ${code})`);
  } finally { await log.close(); }
}
let failed = false;
try {
  await postgres.initialise(); await postgres.start();
  const client = postgres.getPgClient(); await client.connect();
  await client.query('CREATE DATABASE zijing_v2_backend_synthetic'); await client.end();
  console.log(`Isolated synthetic run: ${directory}`);
  await run(['--import', 'tsx', 'scripts/v2-database-compatibility.ts'], 'upgrade.log');
  await run([path.join(repo, 'node_modules/vitest/vitest.mjs'), 'run',
    'tests/v2-backend.integration.test.ts', 'tests/v2-read-projections.test.ts', 'tests/nickname-db.test.ts',
    'tests/v2-image-tickets.test.ts', 'tests/v2-core.test.ts', 'tests/v2-media-compatibility.test.ts',
    'tests/v2-legacy-http-contract.test.ts', 'tests/v2-legacy-questionnaire.test.ts',
    'tests/v2-legacy-signup-methods.test.ts', 'tests/v2-legacy-staff-flows.test.ts',
    'tests/v2-legacy-team-profile-confirmation-http.test.ts', 'tests/v2-legacy-team-signup.test.ts',
    'tests/backup-private-videos.test.ts', '--reporter=default', '--reporter=json',
    '--outputFile=' + path.join(directory, 'contracts.json')], 'contracts.log');
  const evidence = JSON.parse(await fs.readFile(env.V2_COMPAT_EVIDENCE, 'utf8'));
  const contracts = JSON.parse(await fs.readFile(path.join(directory, 'contracts.json'), 'utf8'));
  if (!contracts.success || contracts.numFailedTests || contracts.numPendingTests) throw new Error('Contracts did not all execute successfully');
  evidence.contractSuites = { result: 'PASS', files: contracts.testResults.length, passed: contracts.numPassedTests, failed: contracts.numFailedTests, skipped: contracts.numPendingTests };
  await fs.writeFile(env.V2_COMPAT_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
  await fs.copyFile(env.V2_COMPAT_EVIDENCE, path.join(repo, 'docs/evidence/v2-database-compatibility-20261112.json'));
} catch (error) { failed = true; console.error(error); }
finally {
  if (postgres.process?.exitCode === null) await postgres.stop();
  else postgres.process = undefined; // Already exited; the library's exit hook must not wait for it again.
}
// embedded-postgres installs an exit hook; set the result after stopping it.
console.log(`Synthetic evidence/logs retained: ${directory}`);
process.exit(failed ? 1 : 0);
