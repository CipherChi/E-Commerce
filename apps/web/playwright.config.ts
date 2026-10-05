import { defineConfig, devices } from '@playwright/test';

const webUrl = 'http://127.0.0.1:3000';
const apiUrl = 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'corepack pnpm --filter api start',
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'playwright-retail-access-secret',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'playwright-retail-refresh-secret',
        API_PORT: '3001',
        API_ORIGIN: apiUrl,
        WEB_ORIGIN: webUrl,
      },
    },
    {
      command: 'corepack pnpm exec next start --hostname 127.0.0.1',
      url: webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: apiUrl },
    },
  ],
});
