<script setup lang="ts">
const localeHead = useLocaleHead()
const { t } = useGameI18n()

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
  <NuxtPage />
</template>
