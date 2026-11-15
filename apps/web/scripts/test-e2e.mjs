import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(webDir, '..', 'api');
function fromEnvFile(key) {
  try {
    const contents = readFileSync(resolve(apiDir, '.env'), 'utf8');
    const line = contents.split(/\r?\n/).find((entry) => entry.trimStart().startsWith(`${key}=`));
    if (!line) return undefined;
    return line
      .slice(line.indexOf('=') + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  } catch {
    return undefined;
  }
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const testUrl = process.env.TENANT_TEST_DATABASE_URL ?? fromEnvFile('TENANT_TEST_DATABASE_URL');
if (!testUrl) throw new Error('TENANT_TEST_DATABASE_URL must point to a dedicated test database.');
const parsed = new URL(testUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0]);
const maskedUrl = `${parsed.protocol}//${parsed.username}:***@${parsed.host}/${databaseName}${parsed.search}`;
console.log(`Playwright database target: ${maskedUrl}`);
if (databaseName !== 'hotel_manager_test') {
  throw new Error(
    `Refusing database reset: expected hotel_manager_test, received ${databaseName || '(empty)'}.`,
  );
}

const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  TENANT_TEST_DATABASE_URL: testUrl,
  NEXT_PUBLIC_API_URL: process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3001',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'playwright-retail-access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'playwright-retail-refresh-secret',
};

run(
  'pnpm',
  ['exec', 'prisma', 'generate', '--schema', 'prisma/schema.prisma'],
  apiDir,
  env,
);
run('pnpm', ['exec', 'next', 'build'], webDir, env);
run(
  'pnpm',
  [
    'exec',
    'prisma',
    'migrate',
    'reset',
    '--force',
    '--skip-seed',
    '--schema',
    'prisma/schema.prisma',
  ],
  apiDir,
  env,
);
run(
  'pnpm',
  ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'],
  webDir,
  env,
);
