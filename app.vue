<script setup lang="ts">
const localeHead = useLocaleHead()
const { t } = useGameI18n()
const mainSiteUrl = 'https://www.pawandever.com/?ref=box-puzzle-global'

useHead(() => ({
  title: t('meta.siteTitle'),
  htmlAttrs: localeHead.value.htmlAttrs,
  link: localeHead.value.link,
  meta: [
    ...(localeHead.value.meta ?? []),
    { name: 'description', content: t('meta.siteDescription') },
  ],
}))
</script>

<template>
  <LocaleSwitcher />
  <a class="site-entry" :href="mainSiteUrl" target="_blank" rel="noopener noreferrer">paw &amp; ever</a>
  <NuxtPage />
</template>
