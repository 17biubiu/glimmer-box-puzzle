<script setup lang="ts">
import { shallowRef } from 'vue'
import type { AppLocale } from '~/composables/useGameI18n'

const props = withDefaults(defineProps<{
  inline?: boolean
  compact?: boolean
}>(), {
  inline: false,
  compact: false,
})

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

function onSelectChange(event: Event) {
  const code = (event.target as HTMLSelectElement).value as AppLocale
  void onSwitch(code)
}
</script>

<template>
  <div class="locale-switcher" :class="{ inline: props.inline }" :aria-label="t('language.switcherAria')" role="group">
    <template v-if="props.compact">
      <label class="sr-only" :for="`locale-select-${props.inline ? 'inline' : 'fixed'}`">{{ t('language.switcherAria') }}</label>
      <select
        :id="`locale-select-${props.inline ? 'inline' : 'fixed'}`"
        class="locale-select"
        :value="locale"
        :disabled="switching"
        @change="onSelectChange"
      >
        <option v-for="option in localeOptions" :key="option.code" :value="option.code">
          {{ option.short }}
        </option>
      </select>
    </template>
    <template v-else>
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
    </template>
  </div>
</template>
