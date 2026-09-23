import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './scripts',
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  workers: 1,
  reporter: 'list',
  outputDir: '.tmp/playwright',
  use: {
    baseURL: 'http://127.0.0.1:7101',
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
        '--disable-gpu-shader-disk-cache', '--disable-gpu-program-cache',
        '--disable-features=TSFImeSupport',
      ],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 7101 --host 127.0.0.1',
    url: 'http://127.0.0.1:7101',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
