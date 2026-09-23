// 程序化低多边形宠物 —— 仅使用 Three.js 基础几何体（盒/球/锥/圆柱）
// 无任何外部模型文件。4 种宠物：猫 / 狗 / 兔子 / 蜥蜴，纯装饰用途。

import * as THREE from 'three'
import type { PetKind } from '../core/types'

function mat(color: number, opts: { emissive?: number; rough?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.7,
    metalness: 0.05,
    flatShading: false,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: 0.25,
  })
}

function sphere(r: number, color: number, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), mat(color))
  m.castShadow = true
  return m
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  m.castShadow = true
  return m
}

function cone(r: number, h: number, color: number, seg = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color))
  m.castShadow = true
  return m
}

function cyl(r1: number, r2: number, h: number, color: number, seg = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat(color))
  m.castShadow = true
  return m
}

function addEyes(head: THREE.Group, y: number, z: number, spread: number, size = 0.057): void {
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3 })
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), eyeMat)
    eye.scale.set(0.88, 1.15, 0.7)
    eye.position.set(s * spread, y, z)
    head.add(eye)
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.35, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    glint.position.set(s * spread + size * 0.3, y + size * 0.3, z + size * 0.7)
    head.add(glint)
    const cheek = sphere(size * 0.7, 0xf5aaa5)
    cheek.scale.set(1.3, 0.5, 0.35)
    cheek.position.set(s * (spread + 0.055), y - 0.065, z - 0.005)
    head.add(cheek)
  }
}

function buildCat(): THREE.Group {
  const g = new THREE.Group()
  const orange = 0xffa63d
  const cream = 0xfff1d6
  const pink = 0xff9eaa

  const body = sphere(0.3, orange)
  body.scale.set(1, 0.85, 1.15)
  body.position.y = 0.32
  g.add(body)

  const belly = sphere(0.2, cream)
  belly.scale.set(0.8, 0.7, 0.9)
  belly.position.set(0, 0.26, 0.14)
  g.add(belly)

  const head = new THREE.Group()
  head.name = 'head'
  head.position.set(0, 0.62, 0.22)
  const skull = sphere(0.265, orange)
  skull.scale.set(1.08, 0.94, 1)
  head.add(skull)
  const muzzle = sphere(0.1, cream)
  muzzle.position.set(0, -0.06, 0.16)
  head.add(muzzle)
  // 三角耳
  for (const s of [-1, 1]) {
    const ear = cone(0.09, 0.16, orange, 4)
    ear.position.set(s * 0.17, 0.24, 0)
    ear.rotation.z = -s * 0.25
    head.add(ear)
    const inner = cone(0.05, 0.09, pink, 4)
    inner.position.set(s * 0.17, 0.23, 0.04)
    inner.rotation.z = -s * 0.25
    head.add(inner)
  }
  addEyes(head, 0.04, 0.235, 0.1)
  for (const s of [-1, 0, 1]) {
    const stripe = sphere(0.035, 0xcb732e)
    stripe.scale.set(0.6, 1.8, 0.35)
    stripe.position.set(s * 0.065, 0.17, 0.18)
    stripe.rotation.z = -s * 0.25
    head.add(stripe)
  }
  const nose = cone(0.03, 0.04, pink, 4)
  nose.position.set(0, -0.02, 0.24)
  nose.rotation.x = Math.PI
  head.add(nose)
  g.add(head)

  // 尾巴
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.24, -0.25),
    new THREE.Vector3(0.18, 0.38, -0.4),
    new THREE.Vector3(0.28, 0.62, -0.36),
    new THREE.Vector3(0.22, 0.7, -0.3),
  ]), 16, 0.045, 8, false), mat(orange))
  g.add(tail)
  const tailTip = sphere(0.05, cream, 8)
  tailTip.position.set(0.22, 0.7, -0.3)
  g.add(tailTip)

  // 腿
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = cyl(0.05, 0.06, 0.16, orange)
      leg.name = `paw-${sx}-${sz}`
      leg.position.set(sx * 0.14, 0.08, sz * 0.16)
      g.add(leg)
    }
  }
  return g
}

function buildDog(): THREE.Group {
  const g = new THREE.Group()
  const brown = 0xc98d5e
  const tan = 0xf0d3a8
  const dark = 0x8a5a33

  const body = sphere(0.3, brown)
  body.scale.set(1, 0.85, 1.2)
  body.position.y = 0.32
  g.add(body)

  const chest = sphere(0.2, tan)
  chest.scale.set(0.85, 0.75, 0.8)
  chest.position.set(0, 0.28, 0.16)
  g.add(chest)

  const head = new THREE.Group()
  head.name = 'head'
  head.position.set(0, 0.6, 0.24)
  const skull = sphere(0.26, brown)
  head.add(skull)
  const snout = sphere(0.12, tan)
  snout.scale.set(1.15, 0.7, 0.85)
  snout.position.set(0, -0.055, 0.22)
  head.add(snout)
  const nose = sphere(0.04, 0x2b2b2b, 8)
  nose.position.set(0, -0.025, 0.325)
  head.add(nose)
  // 垂耳
  for (const s of [-1, 1]) {
    const ear = sphere(0.1, dark)
    ear.scale.set(0.8, 1.65, 0.65)
    ear.position.set(s * 0.24, 0.015, 0.015)
    ear.rotation.z = s * 0.35
    head.add(ear)
  }
  addEyes(head, 0.055, 0.235, 0.1)
  g.add(head)

  const tail = cyl(0.03, 0.045, 0.3, dark)
  tail.position.set(0, 0.5, -0.34)
  tail.rotation.x = -1.1
  g.add(tail)

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = cyl(0.055, 0.065, 0.16, brown)
      leg.name = `paw-${sx}-${sz}`
      leg.position.set(sx * 0.14, 0.08, sz * 0.17)
      g.add(leg)
    }
  }
  return g
}

function buildRabbit(): THREE.Group {
  const g = new THREE.Group()
  const white = 0xfdfdfd
  const pink = 0xffb3c1

  const body = sphere(0.3, white)
  body.scale.set(1, 0.9, 1.05)
  body.position.y = 0.32
  g.add(body)

  const head = new THREE.Group()
  head.name = 'head'
  head.position.set(0, 0.64, 0.18)
  const skull = sphere(0.245, white)
  head.add(skull)
  // 长耳朵
  for (const s of [-1, 1]) {
    const ear = new THREE.Group()
    const outer = cyl(0.045, 0.06, 0.34, white)
    outer.position.y = 0.17
    ear.add(outer)
    const tip = sphere(0.045, white, 8)
    tip.position.y = 0.34
    ear.add(tip)
    const inner = cyl(0.02, 0.028, 0.24, pink)
    inner.position.set(0, 0.15, 0.03)
    ear.add(inner)
    ear.position.set(s * 0.09, 0.16, -0.02)
    ear.rotation.z = -s * 0.18
    head.add(ear)
  }
  addEyes(head, 0.05, 0.22, 0.09)
  const nose = sphere(0.025, pink, 6)
  nose.position.set(0, -0.03, 0.265)
  head.add(nose)
  g.add(head)

  // 圆尾巴
  const tail = sphere(0.09, white, 8)
  tail.position.set(0, 0.3, -0.32)
  g.add(tail)

  for (const sx of [-1, 1]) {
    const foot = sphere(0.07, white, 8)
    foot.name = `paw-${sx}-1`
    foot.scale.set(1, 0.6, 1.5)
    foot.position.set(sx * 0.13, 0.05, 0.14)
    g.add(foot)
    const back = sphere(0.08, white, 8)
    back.name = `paw-${sx}--1`
    back.scale.set(1, 0.6, 1.6)
    back.position.set(sx * 0.15, 0.06, -0.12)
    g.add(back)
  }
  return g
}

function buildLizard(): THREE.Group {
  const g = new THREE.Group()
  const green = 0x7ed957
  const lime = 0xc1f27a
  const darkGreen = 0x4da63d

  const body = sphere(0.3, green)
  body.scale.set(1, 0.7, 1.35)
  body.position.y = 0.26
  g.add(body)

  const belly = sphere(0.22, lime)
  belly.scale.set(0.85, 0.5, 1.15)
  belly.position.set(0, 0.18, 0.02)
  g.add(belly)

  const head = new THREE.Group()
  head.name = 'head'
  head.position.set(0, 0.4, 0.36)
  const skull = sphere(0.235, green)
  skull.scale.set(1, 0.8, 1.2)
  head.add(skull)
  const snout = sphere(0.1, lime, 8)
  snout.scale.set(0.9, 0.6, 1)
  snout.position.set(0, -0.03, 0.14)
  head.add(snout)
  // 头顶凸起眼
  for (const s of [-1, 1]) {
    const bump = sphere(0.08, green)
    bump.position.set(s * 0.14, 0.16, 0.06)
    head.add(bump)
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.046, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3 }),
    )
    eye.position.set(s * 0.14, 0.18, 0.12)
    head.add(eye)
    const glint = sphere(0.015, 0xffffff)
    glint.position.set(s * 0.14 + 0.01, 0.2, 0.15)
    head.add(glint)
  }
  g.add(head)

  // 背刺
  for (let i = 0; i < 4; i++) {
    const spike = cone(0.045, 0.12, darkGreen, 4)
    spike.position.set(0, 0.42 - Math.abs(i - 1.5) * 0.03, 0.18 - i * 0.16)
    g.add(spike)
  }

  // 长尾巴
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.23, -0.24),
    new THREE.Vector3(0.24, 0.22, -0.43),
    new THREE.Vector3(0.46, 0.27, -0.39),
    new THREE.Vector3(0.52, 0.38, -0.23),
  ]), 16, 0.06, 8, false), mat(green))
  g.add(tail)
  const tip = cone(0.06, 0.18, green)
  tip.position.set(0.52, 0.45, -0.21)
  tip.rotation.x = 0.4
  g.add(tip)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const spot = sphere(0.036, darkGreen)
      spot.scale.set(0.35, 0.8, 1)
      spot.position.set(s * 0.27, 0.31, 0.08 - i * 0.13)
      g.add(spot)
    }
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = cyl(0.04, 0.05, 0.14, darkGreen)
      leg.name = `paw-${sx}-${sz}`
      leg.position.set(sx * 0.2, 0.1, sz * 0.18)
      leg.rotation.z = sx * 0.7
      g.add(leg)
    }
  }
  return g
}

const BUILDERS: Record<PetKind, () => THREE.Group> = {
  cat: buildCat,
  dog: buildDog,
  rabbit: buildRabbit,
  lizard: buildLizard,
}

export function buildPet(kind: PetKind): THREE.Group {
  const g = BUILDERS[kind]()
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
    if (o.name.startsWith('paw-')) o.userData.restY = o.position.y
  })
  return g
}

export function posePet(pet: THREE.Group, phase: number, pushing: boolean, facingY = 0, dx = 0, dz = 0): void {
  const effort = Math.sin(phase * Math.PI)
  pet.rotation.set(pushing ? dz * effort * 0.065 : 0, facingY, pushing ? -dx * effort * 0.065 : 0)
  pet.scale.set(1 + (pushing ? effort * 0.025 : 0), 1 - (pushing ? effort * 0.045 : 0), 1)
  pet.children.forEach((part) => {
    if (!part.name.startsWith('paw-')) return
    const alternate = part.name === 'paw--1--1' || part.name === 'paw-1-1' ? 1 : -1
    part.position.y = part.userData.restY + Math.max(0, Math.sin(phase * Math.PI * 2) * alternate) * (pushing ? 0.018 : 0.045)
  })
}

export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry)
      const list = Array.isArray(object.material) ? object.material : [object.material]
      list.forEach((material) => materials.add(material))
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}
