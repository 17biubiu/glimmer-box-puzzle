<script setup lang="ts">
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const { t } = useGameI18n()
const deferredPrompt = shallowRef<BeforeInstallPromptEvent | null>(null)
const installState = ref<'hidden' | 'ready' | 'ios'>('hidden')
const installing = ref(false)

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIosLike(): boolean {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function refreshInstallState(): void {
  if (isStandalone()) {
    installState.value = 'hidden'
    return
  }
  if (deferredPrompt.value) {
    installState.value = 'ready'
    return
  }
  installState.value = isIosLike() ? 'ios' : 'hidden'
}

async function installApp(): Promise<void> {
  if (!deferredPrompt.value || installing.value) return
  installing.value = true
  try {
    await deferredPrompt.value.prompt()
    const choice = await deferredPrompt.value.userChoice
    if (choice.outcome === 'accepted') {
      deferredPrompt.value = null
    }
  } finally {
    installing.value = false
    refreshInstallState()
  }
}

function onBeforeInstallPrompt(event: Event): void {
  event.preventDefault()
  deferredPrompt.value = event as BeforeInstallPromptEvent
  refreshInstallState()
}

function onAppInstalled(): void {
  deferredPrompt.value = null
  refreshInstallState()
}

onMounted(() => {
  refreshInstallState()
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
  window.addEventListener('appinstalled', onAppInstalled)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
  window.removeEventListener('appinstalled', onAppInstalled)
})
</script>

<template>
  <section v-if="installState !== 'hidden'" class="install-card" :class="`install-card--${installState}`" :aria-label="t('home.installTitle')">
    <div class="install-card-copy">
      <h2 class="install-card-title">{{ t('home.installTitle') }}</h2>
      <p class="install-card-text">
        {{ installState === 'ios' ? t('home.installIosHint') : t('home.installHint') }}
      </p>
    </div>
    <button
      v-if="installState === 'ready'"
      class="btn btn-green install-card-btn"
      type="button"
      :disabled="installing"
      @click="installApp"
    >
      {{ installing ? t('home.installing') : t('home.installAction') }}
    </button>
  </section>
</template>
