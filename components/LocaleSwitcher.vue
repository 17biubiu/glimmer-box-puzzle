<script setup lang="ts">
import { shallowRef } from 'vue'
import type { AppLocale } from '~/composables/useGameI18n'

const switching = shallowRef(false)
const { locale, localeOptions, switchLocale, t } = useGameI18n()

async function onSwitch(code: AppLocale) {
  if (switching.value || code === locale.value) return
  switching.value = true
  try {
    await switchLocale(code)
  } finally {
    switching.value = false
  }
}
</script>

<template>
  <div class="locale-switcher" :aria-label="t('language.switcherAria')" role="group">
    <button
      v-for="option in localeOptions"
      :key="option.code"
      class="locale-chip"
      type="button"
      :class="{ active: option.code === locale }"
      :aria-pressed="option.code === locale"
      :title="option.label"
      @click="onSwitch(option.code)"
    >
      {{ option.short }}
    </button>
  </div>
</template>
