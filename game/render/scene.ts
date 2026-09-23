// Three.js 场景构建与棋盘同步 —— 命令式挂载到 <canvas>
// 视觉：马里奥式明亮高饱和原色、卡通低多边形、软阴影、
// 「微光纪念宝盒」发光箱子（在目标点上变更亮/变色）。

import * as THREE from 'three'
import type { Direction, ParsedLevel, PetKind, Point } from '../core/types'
import type { SokobanEngine } from '../core/engine'
import { buildPet, disposeObject, posePet } from './pets'

const TILE = 1
const WALL_H = 0.95
const WALL_H_LOW = 0.3 // 面向镜头的围挡墙降矮高度，避免遮挡内侧格子
const PITCH = (55 * Math.PI) / 180 // 固定俯视角 ~55°

const COLORS = {
  sky: 0x8fd6ff,
  floorA: 0xffe082, // 明亮地板 A
  floorB: 0xffd54f, // 明亮地板 B
  goal: 0x69f0ae,
  wall: 0xff6f61, // 珊瑚红墙体
  wallTop: 0xff8a75,
  boxBody: 0xffc94d,
  boxTrim: 0x26c6da,
  glowOff: 0xffd166, // 未在目标点：暖金光
  glowOn: 0x7ffff0, // 在目标点：明亮青白光
}

interface BoxVisual {
  group: THREE.Group
  bodyMat: THREE.MeshStandardMaterial
  trimMat: THREE.MeshStandardMaterial
  light: THREE.PointLight
  glow: THREE.Sprite
  glowMat: THREE.SpriteMaterial
  target: THREE.Vector3
  from: THREE.Vector3
  hopT: number // >=1 表示无动画
}

function makeGlowTexture(): THREE.Texture {
  const size = 128
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const ctx = cv.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class GameScene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private canvas: HTMLCanvasElement
  private board = new THREE.Group()
  private pet: THREE.Group | null = null
  private petTarget = new THREE.Vector3()
  private petFrom = new THREE.Vector3()
  private petHopT = 1
  private pushing = false
  private moveDuration = 0.14
  private moveVector = { x: 0, z: 0 }
  private directionMarker: THREE.Mesh | null = null
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private boxes: BoxVisual[] = []
  private level: ParsedLevel | null = null
  private dirLight: THREE.DirectionalLight
  private clock = new THREE.Clock()
  private raf = 0
  private resizeHandler: () => void
  private glowTex: THREE.Texture
  private resizeObserver: ResizeObserver
  private sharedSpriteGeometry: THREE.BufferGeometry | null = null
  private winAnimating = false
  private winTime = 0
  private time = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(COLORS.sky)
    this.scene.fog = new THREE.Fog(COLORS.sky, 18, 42)

    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100)

    // 灯光：半球环境光 + 平行光（软阴影）
    const hemi = new THREE.HemisphereLight(0xd8f1ff, 0xffe0b2, 1.0)
    this.scene.add(hemi)
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.6)
    this.dirLight.castShadow = true
    this.dirLight.shadow.mapSize.set(1024, 1024)
    this.dirLight.shadow.bias = -0.002
    this.scene.add(this.dirLight)
    this.scene.add(this.dirLight.target)

    this.glowTex = makeGlowTexture()
    this.scene.add(this.board)

    this.resizeHandler = () => this.resize()
    window.addEventListener('resize', this.resizeHandler)
    this.resizeObserver = new ResizeObserver(this.resizeHandler)
    this.resizeObserver.observe(canvas)
    this.resize()
    this.loop()
  }

  /** 网格坐标 → 世界坐标 */
  private toWorld(p: Point, y = 0): THREE.Vector3 {
    const l = this.level!
    return new THREE.Vector3((p.x - (l.width - 1) / 2) * TILE, y, (p.y - (l.height - 1) / 2) * TILE)
  }

  /** 载入关卡并重建棋盘 */
  setLevel(level: ParsedLevel, pet: PetKind): void {
    this.winAnimating = false
    this.level = level
    // 清空旧棋盘
    this.scene.remove(this.board)
    disposeObject(this.board)
    this.boxes = []
    this.board = new THREE.Group()
    this.scene.add(this.board)

    // 地板（棋盘格双色明亮地砖）
    const floorGeo = new THREE.BoxGeometry(TILE * 0.98, 0.12, TILE * 0.98)
    const matA = new THREE.MeshStandardMaterial({ color: COLORS.floorA, roughness: 0.85 })
    const matB = new THREE.MeshStandardMaterial({ color: COLORS.floorB, roughness: 0.85 })
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const c = level.cells[y * level.width + x]!
        if (c === 'wall' || c === 'void') continue
        const m = new THREE.Mesh(floorGeo, (x + y) % 2 === 0 ? matA : matB)
        m.position.copy(this.toWorld({ x, y }, -0.06))
        m.receiveShadow = true
        this.board.add(m)
      }
    }

    // 墙体（ chunky 方块，顶部稍亮）
    // 面向镜头一侧的围挡墙（同列南侧无可玩格、北侧有可玩格）降矮渲染，
    // 否则 55° 俯视下高墙会遮挡其身后约 2/3 格地面，看不清棋盘。
    const isPlayable = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= level.width || y >= level.height) return false
      const c = level.cells[y * level.width + x]!
      return c !== 'wall' && c !== 'void'
    }
    const isFrontWall = (x: number, y: number): boolean => {
      let northPlayable = false
      for (let yy = y - 1; yy >= 0; yy--) {
        if (isPlayable(x, yy)) {
          northPlayable = true
          break
        }
      }
      if (!northPlayable) return false
      for (let yy = y + 1; yy < level.height; yy++) {
        if (isPlayable(x, yy)) return false
      }
      return true
    }
    const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE)
    const wallLowGeo = new THREE.BoxGeometry(TILE, WALL_H_LOW, TILE)
    const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.7, flatShading: true })
    const wallTopGeo = new THREE.BoxGeometry(TILE * 0.86, 0.14, TILE * 0.86)
    const wallTopMat = new THREE.MeshStandardMaterial({ color: COLORS.wallTop, roughness: 0.65, flatShading: true })
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.cells[y * level.width + x] !== 'wall') continue
        const h = isFrontWall(x, y) ? WALL_H_LOW : WALL_H
        const w = new THREE.Mesh(h === WALL_H_LOW ? wallLowGeo : wallGeo, wallMat)
        w.position.copy(this.toWorld({ x, y }, h / 2))
        w.castShadow = true
        w.receiveShadow = true
        this.board.add(w)
        const top = new THREE.Mesh(wallTopGeo, wallTopMat)
        top.position.copy(this.toWorld({ x, y }, h + 0.07))
        top.castShadow = true
        this.board.add(top)
      }
    }

    // 目标点标记（发光圆盘 + 外圈）
    const goalGeo = new THREE.CircleGeometry(0.27, 24)
    const ringGeo = new THREE.RingGeometry(0.3, 0.38, 24)
    const goalMat = new THREE.MeshStandardMaterial({
      color: COLORS.goal,
      emissive: COLORS.goal,
      emissiveIntensity: 0.55,
      roughness: 0.5,
    })
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    for (const gpos of level.goals) {
      const disc = new THREE.Mesh(goalGeo, goalMat)
      disc.rotation.x = -Math.PI / 2
      disc.position.copy(this.toWorld(gpos, 0.005))
      this.board.add(disc)
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.copy(this.toWorld(gpos, 0.006))
      this.board.add(ring)
    }

    // 宝盒
    for (const b of level.boxStarts) {
      this.boxes.push(this.createBox(b))
    }

    // 宠物
    this.pet = buildPet(pet)
    this.pet.position.copy(this.toWorld(level.playerStart, 0))
    this.petTarget.copy(this.pet.position)
    this.petFrom.copy(this.petTarget)
    this.petHopT = 1
    this.pet.rotation.y = 0
    this.board.add(this.pet)
    this.directionMarker = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.2, 3),
      new THREE.MeshBasicMaterial({ color: 0x40364a }),
    )
    this.directionMarker.visible = false
    this.board.add(this.directionMarker)

    this.frameCamera()
  }

  private createBox(start: Point): BoxVisual {
    const group = new THREE.Group()
    const bodyMat = new THREE.MeshStandardMaterial({
      color: COLORS.boxBody,
      roughness: 0.45,
      metalness: 0.15,
      emissive: COLORS.glowOff,
      emissiveIntensity: 0.35,
      flatShading: true,
    })
    const trimMat = new THREE.MeshStandardMaterial({
      color: COLORS.boxTrim,
      roughness: 0.35,
      metalness: 0.3,
      emissive: COLORS.boxTrim,
      emissiveIntensity: 0.4,
      flatShading: true,
    })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.6), bodyMat)
    body.position.y = 0.21
    body.castShadow = true
    group.add(body)
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.68), trimMat)
    lid.position.y = 0.49
    lid.castShadow = true
    group.add(lid)
    // 十字缎带
    const bandMat = trimMat
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.44, 0.12), bandMat)
    band1.position.y = 0.21
    group.add(band1)
    const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.62), bandMat)
    band2.position.y = 0.21
    group.add(band2)
    // 顶部小宝石
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09),
      new THREE.MeshStandardMaterial({
        color: 0xfff7ae,
        emissive: 0xffe066,
        emissiveIntensity: 1.2,
        roughness: 0.2,
        flatShading: true,
      }),
    )
    gem.position.y = 0.64
    gem.castShadow = true
    group.add(gem)

    const light = new THREE.PointLight(COLORS.glowOff, 0.9, 2.6, 1.4)
    light.position.y = 0.55
    group.add(light)

    const glowMat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color: COLORS.glowOff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const glow = new THREE.Sprite(glowMat)
    this.sharedSpriteGeometry = glow.geometry
    glow.scale.set(1.7, 1.7, 1)
    glow.position.y = 0.4
    group.add(glow)

    const pos = this.toWorld(start, 0)
    group.position.copy(pos)
    this.board.add(group)
    return { group, bodyMat, trimMat, light, glow, glowMat, target: pos.clone(), from: pos.clone(), hopT: 1 }
  }

  /** 从引擎状态同步棋盘（带补间动画） */
  syncEngine(engine: SokobanEngine, movedDir?: Direction, pushedIndex = -1): void {
    if (this.pet) this.petFrom.copy(this.pet.position).setY(0)
    this.petTarget.copy(this.toWorld(engine.player, 0))
    this.pushing = pushedIndex >= 0
    this.moveDuration = this.pushing ? 0.18 : 0.14
    if (movedDir) {
      this.petHopT = 0
      this.moveVector = {
        up: { x: 0, z: -1 }, down: { x: 0, z: 1 },
        left: { x: -1, z: 0 }, right: { x: 1, z: 0 },
      }[movedDir]
      if (this.directionMarker) {
        this.directionMarker.visible = !this.reducedMotion.matches
        this.directionMarker.rotation.set(Math.PI / 2, 0, -Math.atan2(this.moveVector.x, this.moveVector.z))
      }
    } else {
      this.petHopT = 1
      this.pet?.position.copy(this.petTarget)
      if (this.pet) posePet(this.pet, 1, false)
      if (this.directionMarker) this.directionMarker.visible = false
    }
    engine.boxes.forEach((b, i) => {
      const vis = this.boxes[i]
      if (!vis) return
      vis.from.copy(vis.group.position).setY(0)
      vis.target.copy(this.toWorld(b, 0))
      vis.hopT = i === pushedIndex ? 0 : 1
      if (i !== pushedIndex) vis.group.position.copy(vis.target)
      const onGoal = engine.isGoal(b.x, b.y)
      const glow = onGoal ? COLORS.glowOn : COLORS.glowOff
      vis.bodyMat.emissive.setHex(glow)
      vis.bodyMat.emissiveIntensity = onGoal ? 0.85 : 0.35
      vis.glowMat.color.setHex(glow)
      vis.glowMat.opacity = onGoal ? 0.85 : 0.55
      vis.light.color.setHex(glow)
      vis.light.intensity = onGoal ? 1.6 : 0.9
    })
  }

  playWin(): void {
    this.winAnimating = true
    this.winTime = this.time
  }

  /** 固定视角自动取景：~55° 俯视、锁定朝向、适配关卡范围 */
  private frameCamera(): void {
    if (!this.level) return
    const l = this.level
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight)
    const sinP = Math.sin(PITCH)
    const cosP = Math.cos(PITCH)
    // 投影到屏幕后的半高：地面深度* sin(pitch) + 墙高 * cos(pitch)
    const halfH = ((l.height * sinP + (WALL_H + 0.9) * cosP) / 2) * 1.18
    const halfW = (l.width / 2) * 1.18
    const frustumH = Math.max(halfH, halfW / Math.max(0.1, aspect), 2.6)
    this.camera.left = -frustumH * aspect
    this.camera.right = frustumH * aspect
    this.camera.top = frustumH
    this.camera.bottom = -frustumH
    this.camera.updateProjectionMatrix()

    const dist = 20
    this.camera.position.set(0, Math.sin(PITCH) * dist, Math.cos(PITCH) * dist)
    this.camera.lookAt(0, 0, 0)

    // 平行光随关卡范围调整
    this.dirLight.position.set(l.width * 0.7, 9, l.height * 0.5 + 3)
    this.dirLight.target.position.set(0, 0, 0)
    const r = Math.max(l.width, l.height) * 0.85 + 2
    const sc = this.dirLight.shadow.camera
    sc.left = -r
    sc.right = r
    sc.top = r
    sc.bottom = -r
    sc.near = 1
    sc.far = 30
    sc.updateProjectionMatrix()
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.frameCamera()
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.time += dt
    // Fixed-duration, synchronized slides; never rotate the pet on direction changes.
    if (this.pet) {
      if (this.petHopT < 1) {
        this.petHopT = this.reducedMotion.matches ? 1 : Math.min(1, this.petHopT + dt / this.moveDuration)
        const t = 1 - Math.pow(1 - this.petHopT, 2)
        this.pet.position.lerpVectors(this.petFrom, this.petTarget, t)
        posePet(this.pet, this.petHopT, this.pushing, this.moveVector.x, this.moveVector.z)
      } else if (this.winAnimating && !this.reducedMotion.matches && this.time - this.winTime < 0.65) {
        this.pet.position.y = Math.sin((this.time - this.winTime) / 0.65 * Math.PI) * 0.12
      } else {
        this.pet.position.y = 0
      }
      if (this.directionMarker) {
        this.directionMarker.position.copy(this.pet.position)
        this.directionMarker.position.x += this.moveVector.x * 0.46
        this.directionMarker.position.z += this.moveVector.z * 0.46
        this.directionMarker.position.y = 0.025
        this.directionMarker.visible = this.petHopT < 1 && !this.reducedMotion.matches
      }
    }

    // 箱子补间 + 发光脉动
    for (let i = 0; i < this.boxes.length; i++) {
      const vis = this.boxes[i]!
      if (vis.hopT < 1) {
        vis.hopT = this.reducedMotion.matches ? 1 : Math.min(1, vis.hopT + dt / this.moveDuration)
        vis.group.position.lerpVectors(vis.from, vis.target, 1 - Math.pow(1 - vis.hopT, 2))
      }
      const pulse = this.reducedMotion.matches ? 0.5 : 0.5 + 0.5 * Math.sin(this.time * 2.4 + i * 1.3)
      vis.glow.scale.setScalar(1.55 + pulse * 0.35)
      vis.group.rotation.y = 0
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resizeHandler)
    this.resizeObserver.disconnect()
    disposeObject(this.scene)
    // Three.js shares Sprite geometry; release its renderer bindings only at scene teardown.
    this.sharedSpriteGeometry?.dispose()
    this.dirLight.shadow.map?.dispose()
    this.glowTex.dispose()
    this.renderer.dispose()
  }
}
