// https://nuxt.com/docs/api/configuration/nuxt-config
const env = ((globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process?.env) ?? {}
const repositoryName = env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const githubPagesBase =
  repositoryName && !repositoryName.endsWith('.github.io')
    ? `/${repositoryName}/`
    : '/'
const baseURL = env.NUXT_APP_BASE_URL || (env.GITHUB_ACTIONS === 'true' ? githubPagesBase : '/')

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-01-01',
  experimental: {
    appManifest: false,
  },
  nitro: {
    prerender: {
      routes: ['/'],
    },
  },
  modules: ['@vite-pwa/nuxt', '@nuxtjs/i18n'],
  css: ['~/assets/main.css'],
  i18n: {
    defaultLocale: 'zh',
    strategy: 'no_prefix',
    lazy: true,
    langDir: 'locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'glimmer-locale',
      redirectOn: 'root',
    },
    bundle: {
      optimizeTranslationDirective: false,
    },
    locales: [
      { code: 'zh', name: '简体中文', language: 'zh-CN', file: 'zh.json' },
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
      { code: 'ja', name: '日本語', language: 'ja-JP', file: 'ja.json' },
      { code: 'fr', name: 'Français', language: 'fr-FR', file: 'fr.json' },
      { code: 'de', name: 'Deutsch', language: 'de-DE', file: 'de.json' },
    ],
  },
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '微光纪念宝盒 · 宠物推箱子',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: `${baseURL}icons/app-icon.svg` },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: `${baseURL}icons/favicon-32x32.png` },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: `${baseURL}icons/favicon-16x16.png` },
        { rel: 'apple-touch-icon', sizes: '180x180', href: `${baseURL}icons/apple-touch-icon.png` },
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: '带着宠物小伙伴，把微光纪念宝盒推到星光之处。3D 卡通推箱子小游戏。' },
        { name: 'theme-color', content: '#8fd6ff' },
        { name: 'application-name', content: '微光纪念宝盒' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: '微光宝盒' },
      ],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    includeAssets: [
      'icons/app-icon.svg',
      'icons/apple-touch-icon.png',
      'icons/favicon-16x16.png',
      'icons/favicon-32x32.png',
    ],
    manifest: {
      id: baseURL,
      scope: baseURL,
      start_url: baseURL,
      name: '微光纪念宝盒 · 宠物推箱子',
      short_name: '微光宝盒',
      description: '带着宠物小伙伴，把微光纪念宝盒推到星光之处。3D 卡通推箱子小游戏。',
      theme_color: '#8fd6ff',
      background_color: '#fffaf0',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'zh-CN',
      categories: ['games', 'puzzle', 'entertainment'],
      icons: [
        { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    experimental: {
      enableWorkboxPayloadQueryParams: true,
    },
    workbox: {
      navigateFallback: `${baseURL}index.html`,
      cleanupOutdatedCaches: true,
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json,txt,xsb,woff2}'],
    },
    devOptions: {
      enabled: true,
      type: 'module',
      suppressWarnings: true,
    },
  },
  typescript: {
    strict: true,
  },
})
