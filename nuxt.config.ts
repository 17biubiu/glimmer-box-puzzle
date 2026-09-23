// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-01-01',
  experimental: {
    appManifest: false,
  },
  modules: ['@nuxtjs/i18n'],
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
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '微光纪念宝盒 · 宠物推箱子',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: '带着宠物小伙伴，把微光纪念宝盒推到星光之处。3D 卡通推箱子小游戏。' },
        { name: 'theme-color', content: '#8fd6ff' },
      ],
    },
  },
  typescript: {
    strict: true,
  },
})
