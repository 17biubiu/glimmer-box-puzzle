<script setup lang="ts">
import { PACKS, type PackId } from '~/game/core/types'
import { levelsOfPack } from '~/game/core/levels'
import { isLevelUnlocked } from '~/game/core/storage'
import { starText } from '~/game/core/stars'
import { packProgress } from '~/game/core/achievements'

const route = useRoute()
const router = useRouter()
const save = useSave()
const { t, localizedPacks, packInfo: getPackInfo, levelName, stageName } = useGameI18n()
const mainSiteUrl = 'https://www.pawandever.com/?ref=box-puzzle-select'

useHead(() => ({
  title: t('meta.selectTitle'),
}))

const pack = computed<PackId>(() => {
  const q = route.query.pack
  return PACKS.some((p) => p.id === q) ? (q as PackId) : 'tutorial'
})

const packInfo = computed(() => getPackInfo(pack.value))
const levels = computed(() => levelsOfPack(pack.value))

function unlocked(num: number): boolean {
  return isLevelUnlocked(save.value, pack.value, num, (n) => levels.value[n - 1]!.id)
}

function goLevel(num: number) {
  if (!unlocked(num)) return
  router.push({ path: '/play', query: { pack: pack.value, num: String(num) } })
}

function switchPack(p: PackId) {
  router.replace({ path: '/select', query: { pack: p } })
}

/** 难度包角标：全三星显示 🏆，否则显示 已通关/总关数 */
function packBadge(p: PackId): string {
  const pr = packProgress(save.value, p)
  return pr.perfect ? '🏆' : `${pr.cleared}/${pr.total}`
}

function levelAria(num: number, name: string, stage?: string) {
  const lockedSuffix = !unlocked(num) ? t('select.lockedSuffix') : ''
  return t('select.levelAria', {
    num,
    name: levelName(name),
    stage: stageName(stage),
    locked: lockedSuffix,
  })
}
</script>

<template>
  <div class="page">
    <h1 class="game-title" style="font-size: clamp(22px, 4vw, 32px)">{{ t('select.title') }}</h1>

    <div class="pack-tabs">
      <button
        v-for="p in localizedPacks"
        :key="p.id"
        class="pack-tab"
        :class="{ active: p.id === pack }"
        :aria-pressed="p.id === pack"
        @click="switchPack(p.id)"
      >
        {{ p.emoji }} {{ p.name }}
        <span class="pack-badge">{{ packBadge(p.id) }}</span>
      </button>
    </div>

    <p class="pack-summary">{{ packInfo.desc }} · {{ t('select.progression') }}</p>
    <div class="level-grid">
      <button
        v-for="lv in levels"
        :key="lv.id"
        class="level-tile"
        :class="{ locked: !unlocked(lv.num) }"
        type="button"
        :disabled="!unlocked(lv.num)"
        :aria-label="levelAria(lv.num, lv.name, lv.stage)"
        @click="goLevel(lv.num)"
      >
        <template v-if="unlocked(lv.num)">
          <div class="level-num">{{ lv.num }}</div>
          <div class="level-name">{{ levelName(lv.name) }}</div>
          <div class="level-stage">{{ t('common.stageBoxes', { stage: stageName(lv.stage), count: lv.boxCount ?? 0 }) }}</div>
          <div class="level-stars">{{ starText(save.stars[lv.id] ?? 0) || '☆☆☆' }}</div>
        </template>
        <template v-else>
          <div class="lock-icon">🔒</div>
          <div class="level-name">{{ lv.num }} · {{ stageName(lv.stage) }}</div>
          <div class="level-name">{{ t('select.locked') }}</div>
        </template>
      </button>
    </div>

    <p style="margin-top: 22px">
      <NuxtLink to="/" class="btn btn-ghost btn-sm" style="text-decoration: none">{{ t('common.backHome') }}</NuxtLink>
    </p>

    <div class="home-footer-tools" aria-label="select footer tools">
      <div class="home-footer-links">
        <span class="home-footer-label">links</span>
        <a class="site-entry-text" :href="mainSiteUrl" target="_blank" rel="noopener noreferrer">
          paw &amp; ever
        </a>
      </div>
      <div class="home-footer-locale">
        <LocaleSwitcher inline compact />
      </div>
    </div>
  </div>
</template>
