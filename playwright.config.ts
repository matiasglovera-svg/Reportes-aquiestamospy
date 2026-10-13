import { defineConfig } from '@playwright/test';

/**
 * QA visual. Por defecto levanta la app local (DATA_SOURCE=local, planilla de fixtures/).
 * Para probar producción: E2E_BASE_URL=https://… E2E_USER=… E2E_PASSWORD=… npm run e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, locale: 'es-PY', timezoneId: 'America/Asuncion' },
  projects: [
    { name: 'escritorio', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'movil', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run dev', url: 'http://localhost:3000/login', reuseExistingServer: true, timeout: 120_000 },
});
