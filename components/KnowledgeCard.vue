<script setup lang="ts">
import { computed } from 'vue'

interface KnowledgeEntry {
  title: string
  text: string
}

const props = defineProps<{ entry: KnowledgeEntry; levelId: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useGameI18n()

const ctaUrl = computed(() => `https://www.pawandever.com/?ref=box-puzzle&level=${encodeURIComponent(props.levelId)}`)
</script>

<template>
  <GameDialog :label="t('knowledge.dialog')" @close="emit('close')">
    <div class="knowledge-card">
      <span class="kc-badge">{{ t('knowledge.badge') }}</span>
      <div class="kc-title">{{ props.entry.title }}</div>
      <p class="kc-text">{{ props.entry.text }}</p>
      <div class="kc-actions">
        <a class="btn btn-grape btn-sm" :href="ctaUrl" target="_blank" rel="noopener noreferrer">
          {{ t('knowledge.cta') }}
        </a>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">{{ t('knowledge.continue') }}</button>
      </div>
      <div class="kc-hint">{{ t('knowledge.hint') }}</div>
    </div>
  </GameDialog>
</template>
