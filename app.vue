<script setup lang="ts">
import { computed } from 'vue'

const localeHead = useLocaleHead()
const route = useRoute()
const { t } = useGameI18n()
const mainSiteUrl = 'https://www.pawandever.com/?ref=box-puzzle-global'
const isPlayPage = computed(() => route.path === '/play')
const showGlobalTopActions = computed(() => route.path !== '/' && !isPlayPage.value)

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
  <VitePwaManifest />
  <LocaleSwitcher v-if="showGlobalTopActions" />
  <a
    v-if="showGlobalTopActions"
    class="site-entry"
    :href="mainSiteUrl"
    target="_blank"
    rel="noopener noreferrer"
  >
    paw &amp; ever
  </a>
  <NuxtPage />
</template>
