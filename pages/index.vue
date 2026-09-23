<script setup lang="ts">
import { PACKS, PETS, type PackId, type PetKind } from '~/game/core/types'
import { levelsOfPack } from '~/game/core/levels'
import { setPet } from '~/game/core/storage'
import { audio } from '~/game/audio/audio'

const save = useSave()
const router = useRouter()
const { t, localizedPets, localizedPacks } = useGameI18n()
const mainSiteUrl = 'https://www.pawandever.com/?ref=box-puzzle-home'

useHead(() => ({
  title: t('meta.homeTitle'),
}))

function choosePet(p: PetKind) {
  audio.setMuted(save.value.muted)
  audio.ensure()
  setPet(save.value, p)
}

function packClearedCount(pack: PackId): number {
  return levelsOfPack(pack).filter((l) => (save.value.stars[l.id] ?? 0) > 0).length
}

function goPack(pack: PackId) {
  audio.setMuted(save.value.muted)
  audio.ensure()
  audio.startBGM()
  router.push({ path: '/select', query: { pack } })
}

// 首次手势解锁音频（自动播放策略）
const unlock = () => {
  audio.setMuted(save.value.muted)
  audio.ensure()
}
onMounted(() => {
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlock)
  window.removeEventListener('keydown', unlock)
})
</script>

<template>
  <div class="page">
    <div style="height: 4vh" />
    <h1 class="game-title">{{ t('home.title') }}</h1>
    <p class="subtitle">{{ t('home.subtitle') }}</p>

    <h2 class="section-title">{{ t('home.choosePet') }}</h2>
    <div class="card-row pet-row">
      <button
        v-for="p in localizedPets"
        :key="p.id"
        class="pet-card"
        :class="{ selected: save.pet === p.id }"
        type="button"
        :aria-pressed="save.pet === p.id"
        @click="choosePet(p.id)"
      >
        <PetPortrait :kind="p.id" />
        <div class="pet-name">{{ p.name }}</div>
        <div class="pet-food">{{ p.foodEmoji }} {{ t('common.portions', { count: save.food[p.id] }) }}</div>
      </button>
    </div>

    <h2 class="section-title">{{ t('home.choosePack') }}</h2>
    <div class="card-row pack-row">
      <button
        v-for="pack in localizedPacks"
        :key="pack.id"
        class="pack-card"
        :style="{ background: pack.color + '33' }"
        type="button"
        @click="goPack(pack.id)"
      >
        <div class="pack-emoji">{{ pack.emoji }}</div>
        <div class="pack-name">{{ pack.name }}</div>
        <div class="pack-desc">{{ pack.desc }}</div>
        <div class="pack-progress">
          {{ t('home.packProgress', { cleared: packClearedCount(pack.id), total: levelsOfPack(pack.id).length }) }}
        </div>
      </button>
    </div>

    <p class="footer-brand">
      <a :href="mainSiteUrl" target="_blank" rel="noopener noreferrer">{{ t('home.siteLink') }}</a>
    </p>
  </div>
</template>
