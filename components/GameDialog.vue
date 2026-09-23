<script setup lang="ts">
withDefaults(defineProps<{ label: string; dismissible?: boolean }>(), { dismissible: true })
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
let previousFocus: HTMLElement | null = null
onMounted(() => {
  previousFocus = document.activeElement as HTMLElement | null
  dialog.value?.showModal()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="game-dialog"
    :aria-label="label"
    @cancel.prevent="dismissible && emit('close')"
    @click.self="dismissible && emit('close')"
  >
    <div class="dialog"><slot /></div>
  </dialog>
</template>

<style scoped>
.game-dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  padding: 18px;
  border: 0;
  width: min(100%, 460px);
  max-width: 100%;
  max-height: 100dvh;
  background: transparent;
  color: inherit;
  overscroll-behavior: contain;
}
.game-dialog::backdrop { background: rgba(64, 54, 74, 0.45); }
</style>
