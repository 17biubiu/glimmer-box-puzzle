<script setup lang="ts">
import type { PetKind } from '~/game/core/types'
const props = defineProps<{ pet: PetKind; earned: number; total: number }>()
const { t, petInfo } = useGameI18n()
const info = computed(() => petInfo(props.pet))
</script>

<template>
  <section class="food-reward" :aria-label="t('reward.aria')">
    <div class="reward-scene" aria-hidden="true">
      <PetPortrait :kind="pet" />
      <span class="reward-food" :class="{ earned: earned > 0 }">{{ info.foodEmoji }}</span>
    </div>
    <p class="reward-title" role="status">
      {{ earned > 0 ? t('reward.earned', { pet: info.name, count: earned, food: info.food }) : t('reward.retry', { pet: info.name }) }}
    </p>
    <p class="reward-detail">{{ t('reward.bag', { total }) }}</p>
    <p v-if="earned === 0" class="reward-detail">{{ t('reward.claimed') }}</p>
  </section>
</template>

<style scoped>
.food-reward { padding: 10px 0 16px; }
.reward-scene { display: flex; align-items: center; justify-content: center; height: 100px; }
.reward-scene :deep(.pet-portrait) { width: 120px; height: 110px; }
.reward-food { font-size: 40px; }
.reward-food.earned { animation: food-arrive 480ms ease-out both; }
.reward-title { font-size: 16px; font-weight: 800; line-height: 1.6; }
.reward-detail { font-size: 12px; line-height: 1.7; color: #675b6d; }
@keyframes food-arrive {
  from { transform: translate(18px, -12px) scale(0.85); opacity: 0; }
  to { transform: translate(0, 0) scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { .reward-food.earned { animation: none; } }
</style>
