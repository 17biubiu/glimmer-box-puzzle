<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { SokobanEngine } from '~/game/core/engine'
import { parseXsb, parseXsbSet } from '~/game/core/xsb-parser'
import { findLevel, nextLevel } from '~/game/core/levels'
import { PACKS, PETS, DIR_VECTORS, type Direction, type LevelMeta, type ParsedLevel } from '~/game/core/types'
import { computeStars, starText } from '~/game/core/stars'
import { packProgress, allPerfect } from '~/game/core/achievements'
import { isLevelUnlocked, recordClear, setMuted } from '~/game/core/storage'
import { levelsOfPack } from '~/game/core/levels'
import { GameScene } from '~/game/render/scene'
import { audio } from '~/game/audio/audio'

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const save = useSave()
const mainSiteUrl = 'https://www.pawandever.com/?ref=box-puzzle-play-footer'
const {
  t,
  knowledgeEntries,
  packInfo: getPackInfo,
  petInfo: getPetInfo,
  localizedLevel,
} = useGameI18n()

useHead(() => ({
  title: t('meta.playTitle'),
}))

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const loadError = ref('')
const moves = ref(0)
const pushes = ref(0)
const undoLeft = ref(0)
const won = ref(false)
const winStars = ref(0)
const showWin = ref(false)
const showKnowledge = ref(false)
const showRestart = shallowRef(false)
const rewardEarned = shallowRef(0)
const feedback = shallowRef('')
const placed = shallowRef(0)
const tipLoading = shallowRef(false)
const knowledgeEntry = ref<{ title: string; text: string } | null>(null)
// 成就庆祝：本次通关是否首次达成「全包 3★」/「全游戏大满贯」
const packPerfectCelebrate = ref(false)
const grandSlamCelebrate = ref(false)
const confettiPieces = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 0.17) % 1.8).toFixed(2),
  duration: (2.6 + ((i * 13) % 10) / 8).toFixed(2),
  emoji: ['🎉', '✨', '⭐', '🌟', '💛', '🎊'][i % 6],
  size: 14 + ((i * 7) % 16),
}))

const meta = shallowRef<LevelMeta>()
let parsed: ParsedLevel | null = null
let engine: SokobanEngine | null = null
let gs: GameScene | null = null
let winTimer: ReturnType<typeof setTimeout> | null = null
let loadController: AbortController | null = null
let loadVersion = 0
let disposed = false
let nextInputAt = 0
let pendingDirection: Direction | null = null
let inputTimer: ReturnType<typeof setTimeout> | null = null

const packInfo = computed(() => (meta.value ? getPackInfo(meta.value.pack) : undefined))
const petInfo = computed(() => getPetInfo(save.value.pet))
const petEmoji = computed(() => petInfo.value.emoji)
const localizedMeta = computed(() => localizedLevel(meta.value))
const nextMeta = computed(() => localizedLevel(meta.value ? nextLevel(meta.value) : undefined))
const best = computed(() => (meta.value ? save.value.best[meta.value.id] : undefined))
const blocked = computed(() => loading.value || !!loadError.value || won.value || showKnowledge.value || showRestart.value)

function publicAssetUrl(path: string) {
  if (!path.startsWith('/')) return path
  return `${runtimeConfig.app.baseURL}${path.slice(1)}`
}

function clearInput() {
  if (inputTimer) clearTimeout(inputTimer)
  inputTimer = null
  pendingDirection = null
  nextInputAt = 0
  touchStart = null
}

async function initLevel() {
  const version = ++loadVersion
  loadController?.abort()
  loadController = new AbortController()
  clearInput()
  engine = null
  parsed = null
  loading.value = true
  const pack = route.query.pack
  const num = Number(route.query.num)
  if ((pack !== 'tutorial' && pack !== 'easy' && pack !== 'medium' && pack !== 'hard') || !Number.isInteger(num) || num < 1) {
    router.replace('/')
    return
  }
  const m = findLevel(pack, num)
  if (!m) {
    router.replace({ path: '/select', query: { pack } })
    return
  }
  const packLevels = levelsOfPack(m.pack)
  if (!isLevelUnlocked(save.value, m.pack, m.num, n => packLevels[n - 1]!.id)) {
    void router.replace({ path: '/select', query: { pack } })
    return
  }
  meta.value = m
  loading.value = true
  loadError.value = ''
  won.value = false
  showWin.value = false
  showKnowledge.value = false
  showRestart.value = false
  feedback.value = ''
  placed.value = 0
  rewardEarned.value = 0
  packPerfectCelebrate.value = false
  grandSlamCelebrate.value = false
  moves.value = 0
  pushes.value = 0
  undoLeft.value = 0
  if (winTimer) {
    clearTimeout(winTimer)
    winTimer = null
  }
  try {
    const response = await fetch(publicAssetUrl(m.file), { signal: loadController.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (disposed || version !== loadVersion) return
    const chunks = parseXsbSet(text)
    if (!chunks.length) throw new Error('empty level file')
    parsed = parseXsb(chunks[0]!.xsb)
    engine = new SokobanEngine(parsed)
    if (!gs) gs = new GameScene(canvasRef.value!)
    gs.setLevel(parsed, save.value.pet)
    gs.syncEngine(engine)
    syncHud()
  } catch (e) {
    if (!disposed && version === loadVersion) {
      loadError.value = t('play.loadFailed', { message: (e as Error).message })
    }
  } finally {
    if (!disposed && version === loadVersion) loading.value = false
  }
}

function syncHud() {
  if (!engine) return
  moves.value = engine.moves
  pushes.value = engine.pushes
  undoLeft.value = engine.undoLeft
  placed.value = engine.boxes.filter(b => engine!.isGoal(b.x, b.y)).length
}

function doMove(dir: Direction) {
  if (!engine || blocked.value) return
  const remaining = nextInputAt - performance.now()
  if (remaining > 0) {
    pendingDirection = dir
    if (!inputTimer) inputTimer = setTimeout(() => {
      inputTimer = null
      const pending = pendingDirection
      pendingDirection = null
      if (pending) doMove(pending)
    }, remaining)
    return
  }
  if (inputTimer) clearTimeout(inputTimer)
  inputTimer = null
  pendingDirection = null
  const d = DIR_VECTORS[dir]
  const bi = engine.boxIndexAt(engine.player.x + d.x, engine.player.y + d.y)
  const res = engine.tryMove(dir)
  if (!res.moved) {
    audio.sfxBump()
    feedback.value = bi >= 0 ? t('play.blockedBox') : t('play.blockedWall')
    nextInputAt = performance.now() + 100
    return
  }
  nextInputAt = performance.now() + (res.pushed ? 180 : 140)
  feedback.value = res.pushed && engine.isGoal(engine.boxes[bi]!.x, engine.boxes[bi]!.y) ? t('play.boxPlaced') : ''
  if (res.pushed) audio.sfxPush()
  else audio.sfxMove()
  gs?.syncEngine(engine, dir, res.pushed ? bi : -1)
  syncHud()
  if (res.won) onWin()
}

function onWin() {
  if (!engine || !meta.value || won.value) return
  clearInput()
  won.value = true
  const stars = computeStars(engine.moves, meta.value.par)
  winStars.value = stars
  // 先记录「通关前」的成就状态，再写入成绩，判定是否为首次达成
  const wasPerfect = packProgress(save.value, meta.value.pack).perfect
  const wasGrand = allPerfect(save.value)
  rewardEarned.value = recordClear(save.value, meta.value.id, meta.value.pack, meta.value.num, stars, engine.moves, engine.pushes)
  packPerfectCelebrate.value = !wasPerfect && packProgress(save.value, meta.value.pack).perfect
  grandSlamCelebrate.value = !wasGrand && allPerfect(save.value)
  audio.sfxWin()
  gs?.playWin()
  winTimer = setTimeout(() => {
    showWin.value = true
  }, 750)
}

function doUndo() {
  if (!engine || blocked.value) return
  clearInput()
  if (engine.undo()) {
    audio.sfxUndo()
    gs?.syncEngine(engine)
    syncHud()
    feedback.value = t('play.undoDone')
  }
}

function requestRestart() {
  if (loading.value || loadError.value) return
  clearInput()
  if (moves.value > 0 && !won.value) showRestart.value = true
  else doRestart()
}

function doRestart() {
  if (!parsed || !meta.value || loading.value || loadError.value) return
  clearInput()
  showRestart.value = false
  showKnowledge.value = false
  feedback.value = ''
  engine = new SokobanEngine(parsed)
  gs?.setLevel(parsed, save.value.pet)
  gs?.syncEngine(engine)
  won.value = false
  showWin.value = false
  if (winTimer) {
    clearTimeout(winTimer)
    winTimer = null
  }
  syncHud()
}

function showTip() {
  if (tipLoading.value || blocked.value) return
  if (!knowledgeEntries.value.length) {
    feedback.value = t('play.tipsLoadFailed')
    return
  }
  clearInput()
  knowledgeEntry.value = knowledgeEntries.value[Math.floor(Math.random() * knowledgeEntries.value.length)]!
  showKnowledge.value = true
}

function toggleMute() {
  const m = !save.value.muted
  setMuted(save.value, m)
  audio.setMuted(m)
}

function goSelect() {
  clearInput()
  router.push({ path: '/select', query: { pack: meta.value?.pack ?? 'tutorial' } })
}

function goNext() {
  if (!nextMeta.value) return
  router.replace({ path: '/play', query: { pack: nextMeta.value.pack, num: String(nextMeta.value.num) } })
}

// ---- 键盘 ----
const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}
function onKey(e: KeyboardEvent) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
  if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"], dialog')) return
  if (blocked.value) return
  const dir = KEY_DIRS[e.key]
  if (dir) {
    e.preventDefault()
    doMove(dir)
    return
  }
  if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') {
    e.preventDefault()
    if (e.repeat) return
    doUndo()
  }
}

// ---- 触屏滑动 ----
let touchStart: { x: number; y: number } | null = null
function onTouchStart(e: TouchEvent) {
  if (blocked.value || e.touches.length !== 1) { touchStart = null; return }
  const t = e.touches[0]
  if (t) touchStart = { x: t.clientX, y: t.clientY }
}
function onTouchEnd(e: TouchEvent) {
  if (!touchStart) return
  const t = e.changedTouches[0]
  const start = touchStart
  touchStart = null
  if (!t || !start) return
  const dx = t.clientX - start.x
  const dy = t.clientY - start.y
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (Math.max(adx, ady) < 24) return
  doMove(adx > ady ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
}

let removeUnlock: (() => void) | null = null

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', clearInput)
  // 自动播放策略：首次手势解锁音频
  const unlock = () => {
    audio.ensure()
    audio.setMuted(save.value.muted)
    audio.startBGM()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  removeUnlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  watch(() => [route.query.pack, route.query.num], () => void initLevel(), { immediate: true })
})

onBeforeUnmount(() => {
  disposed = true
  loadVersion++
  loadController?.abort()
  clearInput()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('blur', clearInput)
  removeUnlock?.()
  if (winTimer) clearTimeout(winTimer)
  gs?.dispose()
  gs = null
})
</script>

<template>
  <div class="play-page">
    <header class="hud">
      <div class="hud-title">
        <span>{{ petEmoji }}</span>
        <span>{{ t('play.header', { pet: '', pack: `${packInfo?.emoji ?? ''} ${packInfo?.name ?? ''}`.trim(), num: localizedMeta?.num, level: localizedMeta?.name ?? '' }).trim() }}</span>
      </div>
      <div class="hud-stat">{{ meta?.par ? t('play.stepsWithPar', { moves, par: meta.par }) : t('play.steps', { moves }) }}</div>
      <div class="hud-stat">{{ t('play.pushes', { count: pushes }) }}</div>
      <div class="hud-actions">
        <button class="btn btn-sm btn-blue" :disabled="undoLeft === 0 || blocked" @click="doUndo">
          {{ t('play.undo', { left: undoLeft }) }}
        </button>
        <button class="btn btn-sm btn-coral" :disabled="loading || !!loadError" @click="requestRestart">{{ t('play.restart') }}</button>
        <button class="btn btn-sm btn-ghost" :aria-label="save.muted ? t('play.soundOn') : t('play.soundOff')" :aria-pressed="save.muted" @click="toggleMute">{{ save.muted ? '🔇' : '🔊' }}</button>
        <button class="btn btn-sm btn-ghost" :disabled="blocked || tipLoading" @click="showTip">{{ t('play.tips') }}</button>
        <button class="btn btn-sm btn-ghost" @click="goSelect">{{ t('play.select') }}</button>
      </div>
    </header>

    <div class="game-status">
      <span>{{ t('play.status', { stage: localizedMeta?.stage ?? '', placed, total: meta?.boxCount ?? 0 }) }}</span>
      <span role="status">{{ feedback || t('play.defaultHint') }}</span>
    </div>
    <div class="canvas-wrap">
      <canvas ref="canvasRef" :aria-label="t('play.boardAria')"
        @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd" @touchcancel="touchStart = null"></canvas>

      <div v-if="loading" class="loading-tip">{{ t('play.loading') }}</div>
      <div v-else-if="loadError" class="loading-tip" role="alert">
        {{ loadError }}
        <button class="btn btn-sm" @click="initLevel">{{ t('common.reload') }}</button>
      </div>
    </div>
    <div class="game-controls">
      <div class="game-controls-main">
        <div class="game-controls-meta">
          <a class="site-entry-text" :href="mainSiteUrl" target="_blank" rel="noopener noreferrer">paw &amp; ever</a>
          <LocaleSwitcher inline compact />
          <span class="food-balance">{{ petInfo.foodEmoji }} {{ petInfo.food }} {{ t('common.portions', { count: save.food[save.pet] }) }}</span>
        </div>
        <div class="dpad" role="group" :aria-label="t('play.dpad')">
          <button class="dpad-btn dpad-u" :disabled="blocked" :aria-label="t('play.up')" @click="doMove('up')">▲</button>
          <button class="dpad-btn dpad-l" :disabled="blocked" :aria-label="t('play.left')" @click="doMove('left')">◀</button>
          <button class="dpad-btn dpad-d" :disabled="blocked" :aria-label="t('play.down')" @click="doMove('down')">▼</button>
          <button class="dpad-btn dpad-r" :disabled="blocked" :aria-label="t('play.right')" @click="doMove('right')">▶</button>
        </div>
      </div>
    </div>

    <!-- 胜利结算 -->
    <GameDialog v-if="showWin" :label="t('play.winDialog')" :dismissible="false">
      <!-- 首次全包三星 / 大满贯时的彩带雨 -->
      <div v-if="packPerfectCelebrate || grandSlamCelebrate" class="confetti-layer" aria-hidden="true">
        <span
          v-for="(c, i) in confettiPieces"
          :key="i"
          class="confetti-piece"
          :style="{ left: c.left + '%', animationDelay: c.delay + 's', animationDuration: c.duration + 's', fontSize: c.size + 'px' }"
          >{{ c.emoji }}</span
        >
      </div>
      <div>
        <div class="win-stars">{{ starText(winStars) }}</div>
        <div class="win-title">{{ t('play.winTitle') }}</div>
        <FoodReward :pet="save.pet" :earned="rewardEarned" :total="save.food[save.pet]" />
        <div v-if="grandSlamCelebrate" class="trophy-banner grand">
          {{ t('play.grandSlam', { count: PACKS.length }) }}
        </div>
        <div v-else-if="packPerfectCelebrate" class="trophy-banner">
          {{ t('play.packPerfect', { pack: packInfo?.name ?? '' }) }}
        </div>
        <div class="win-stats">
          <div class="win-stat">{{ meta?.par ? t('play.stepsWithPar', { moves, par: meta.par }) : t('play.steps', { moves }) }}</div>
          <div class="win-stat">{{ t('play.pushes', { count: pushes }) }}</div>
          <div v-if="best" class="win-stat">{{ t('play.best', { moves: best.moves, pushes: best.pushes }) }}</div>
        </div>
        <div class="win-actions">
          <button v-if="nextMeta" class="btn btn-green" @click="goNext">{{ t('play.next') }}</button>
          <button class="btn btn-blue" @click="doRestart">{{ t('play.replay') }}</button>
          <button class="btn btn-ghost" @click="goSelect">{{ t('play.select') }}</button>
        </div>
      </div>
    </GameDialog>

    <GameDialog v-if="showRestart" :label="t('play.restartDialog')" @close="showRestart = false">
      <h2 class="win-title">{{ t('play.restartTitle') }}</h2>
      <p class="restart-hint">{{ t('play.restartHint', { moves }) }}</p>
      <div class="win-actions">
        <button class="btn btn-ghost" autofocus @click="showRestart = false">{{ t('common.continueGame') }}</button>
        <button class="btn btn-coral" @click="doRestart">{{ t('play.confirmRestart') }}</button>
      </div>
    </GameDialog>

    <!-- 主动查看的小贴士；原生对话框打开时暂停棋盘输入。 -->
    <KnowledgeCard
      v-if="showKnowledge && knowledgeEntry && meta"
      :entry="knowledgeEntry"
      :level-id="meta.id"
      @close="showKnowledge = false"
    />
  </div>
</template>
