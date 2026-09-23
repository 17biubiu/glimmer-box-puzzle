<script setup lang="ts">
import * as THREE from 'three'
import { buildPet, disposeObject } from '~/game/render/pets'
import { PETS, type PetKind } from '~/game/core/types'

const props = defineProps<{ kind: PetKind }>()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const failed = shallowRef(false)
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let observer: ResizeObserver | undefined
let pet: THREE.Group | undefined
const camera = new THREE.OrthographicCamera(-0.85, 0.85, 0.85, -0.85, 0.1, 20)

function render() {
  if (!canvas.value || !renderer || !scene) return
  const width = canvas.value.clientWidth
  const height = canvas.value.clientHeight
  if (!width || !height) return
  renderer.setSize(width, height, false)
  const aspect = width / height
  camera.left = -0.78 * aspect
  camera.right = 0.78 * aspect
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
}

function updatePet() {
  if (!scene) return
  if (pet) {
    scene.remove(pet)
    disposeObject(pet)
  }
  pet = buildPet(props.kind)
  pet.rotation.y = -0.16
  scene.add(pet)
  render()
}

onMounted(() => {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas.value!, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8bca3, 2.4))
    const light = new THREE.DirectionalLight(0xffffff, 2.4)
    light.position.set(-3, 5, 4)
    scene.add(light)
    camera.position.set(0, 1.8, 4)
    camera.lookAt(0, 0.57, 0)
    updatePet()
    observer = new ResizeObserver(render)
    observer.observe(canvas.value!)
  } catch {
    failed.value = true
  }
})
watch(() => props.kind, updatePet)
onBeforeUnmount(() => {
  observer?.disconnect()
  if (scene) disposeObject(scene)
  renderer?.dispose()
  renderer?.forceContextLoss()
})
</script>

<template>
  <span class="pet-portrait">
    <span v-if="failed" class="pet-fallback" aria-hidden="true">{{ PETS.find(p => p.id === kind)?.emoji }}</span>
    <canvas v-else ref="canvas" aria-hidden="true" />
  </span>
</template>

<style scoped>
.pet-portrait { display: block; width: 100%; height: 116px; }
canvas { display: block; width: 100%; height: 100%; }
.pet-fallback { font-size: 64px; line-height: 116px; }
</style>
