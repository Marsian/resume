import * as CANNON from 'cannon-es'
import * as THREE from 'three'

import { computeGameOverLayout, computeHomeRingLayout } from '../homeMenuLayout'
import { createBombMesh, createFruitMesh } from './meshes'
import { screenToCameraFacingPlane } from './slice'
import type { FruitHalf, WholeEntity } from './types'

export type DecorContext = {
  world: CANNON.World
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera | null
  cachedLayoutRect: DOMRect | null
  playPlaneCenter: THREE.Vector3
  entities: WholeEntity[]
  halves: FruitHalf[]
  allocId: () => number
  removeWhole: (e: WholeEntity) => void
  removeHalf: (h: FruitHalf) => void
  syncCanvasLayout: () => void
  isDisposed: () => boolean
  isGameOver: () => boolean
  setGameOverDecorReady: (v: boolean) => void
  setGameOverFxUntil: (t: number) => void
  retrySpawnGameOverDecor: () => void
}

export function clearHomeDecor(ctx: DecorContext) {
  for (let i = ctx.entities.length - 1; i >= 0; i--) {
    const e = ctx.entities[i]!
    if (e.isHomeDecor) ctx.removeWhole(e)
  }
}

export function clearGameOverDecor(ctx: DecorContext) {
  for (let i = ctx.entities.length - 1; i >= 0; i--) {
    const e = ctx.entities[i]!
    if (e.isGameOverDecor) ctx.removeWhole(e)
  }
}

/** Clear flying fruit/bombs/halves and show game-over ring props (Classic-style). */
export function clearGameplayAndSpawnGameOverDecor(ctx: DecorContext) {
  clearGameOverDecor(ctx)
  for (const h of [...ctx.halves]) {
    ctx.removeHalf(h)
  }
  for (let i = ctx.entities.length - 1; i >= 0; i--) {
    ctx.removeWhole(ctx.entities[i]!)
  }
  // Ensure we have a fresh layout rect so props don't spawn at fallback positions then “fly in”.
  ctx.syncCanvasLayout()
  spawnGameOverDecor(ctx, true)
}

export function spawnGameOverDecor(ctx: DecorContext, forceRelayout = false) {
  if (!ctx.isGameOver()) return
  if (!forceRelayout && ctx.entities.some((e) => e.isGameOverDecor)) return
  clearGameOverDecor(ctx)
  ctx.setGameOverDecorReady(false)
  ctx.setGameOverFxUntil(0)

  const rect = ctx.cachedLayoutRect
  const camera = ctx.camera
  if (!rect || !camera) {
    // We'll retry on the next resize/layout sync.
    requestAnimationFrame(() => {
      if (ctx.isDisposed()) return
      ctx.syncCanvasLayout()
      ctx.retrySpawnGameOverDecor()
    })
    return
  }

  const placeOnPlayPlane = (u: number, v: number, out: THREE.Vector3) => {
    const clientX = rect.left + rect.width * u
    const clientY = rect.top + rect.height * v
    return screenToCameraFacingPlane(clientX, clientY, rect, camera, ctx.playPlaneCenter, out) != null
  }

  const { uRetry, uQuit, vButtons, ringPx } = computeGameOverLayout(rect?.width ?? 800, rect?.height ?? 500)

  const worldRadiusAt = (u: number, v: number, px: number): number => {
    const c = new THREE.Vector3()
    const p = new THREE.Vector3()
    const okC = screenToCameraFacingPlane(
      rect.left + rect.width * u,
      rect.top + rect.height * v,
      rect,
      camera,
      ctx.playPlaneCenter,
      c,
    )
    const okP = screenToCameraFacingPlane(
      rect.left + rect.width * u + px,
      rect.top + rect.height * v,
      rect,
      camera,
      ctx.playPlaneCenter,
      p,
    )
    if (!okC || !okP) return 0.6
    return c.distanceTo(p)
  }

  const innerHoleRatio = 92 / 320
  const wmRadius = worldRadiusAt(uRetry, vButtons, (ringPx * innerHoleRatio) * 0.62)
  const bombRadius = worldRadiusAt(uQuit, vButtons, (ringPx * innerHoleRatio) * 0.52)

  const wmPos = new THREE.Vector3()
  const okWm = placeOnPlayPlane(uRetry, vButtons, wmPos)
  const bombPos = new THREE.Vector3()
  const okB = placeOnPlayPlane(uQuit, vButtons, bombPos)
  // If layout/camera are not stable yet, do not render or allow interaction.
  // Retry next frame so props appear only once they have a fixed anchor.
  if (!okWm || !okB || wmRadius <= 0.001 || bombRadius <= 0.001 || rect.width < 2 || rect.height < 2) {
    requestAnimationFrame(() => {
      if (ctx.isDisposed()) return
      ctx.syncCanvasLayout()
      ctx.retrySpawnGameOverDecor()
    })
    return
  }
  const wmRoot = createFruitMesh(wmRadius, 'watermelon', 0x3aa44a)
  wmRoot.position.copy(wmPos)
  wmRoot.visible = false
  ctx.scene.add(wmRoot)
  const wmBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Sphere(wmRadius),
    position: new CANNON.Vec3(wmPos.x, wmPos.y, wmPos.z),
    collisionFilterGroup: 0,
    collisionFilterMask: 0,
  })
  wmBody.collisionResponse = false
  ctx.world.addBody(wmBody)
  ctx.entities.push({
    id: ctx.allocId(),
    root: wmRoot,
    body: wmBody,
    radius: wmRadius,
    color: new THREE.Color(0x3aa44a),
    fleshColor: new THREE.Color(0xff3a5c),
    fruitType: 'watermelon',
    kind: 'fruit',
    missTracked: true,
    isStarter: false,
    isGameOverDecor: true,
    homeAnchor: { u: uRetry, v: vButtons },
    _anchorLastPos: new THREE.Vector3(wmPos.x, wmPos.y, wmPos.z),
    _anchorStableFrames: 0,
  })
  const bombRoot = createBombMesh(bombRadius)
  bombRoot.position.copy(bombPos)
  bombRoot.visible = false
  ctx.scene.add(bombRoot)
  const bombBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Sphere(bombRadius),
    position: new CANNON.Vec3(bombPos.x, bombPos.y, bombPos.z),
    collisionFilterGroup: 0,
    collisionFilterMask: 0,
  })
  bombBody.collisionResponse = false
  ctx.world.addBody(bombBody)
  ctx.entities.push({
    id: ctx.allocId(),
    root: bombRoot,
    body: bombBody,
    radius: bombRadius,
    color: new THREE.Color(0xff3300),
    fleshColor: new THREE.Color(0xff3300),
    kind: 'bomb',
    missTracked: true,
    isGameOverDecor: true,
    homeAnchor: { u: uQuit, v: vButtons },
    _anchorLastPos: new THREE.Vector3(bombPos.x, bombPos.y, bombPos.z),
    _anchorStableFrames: 0,
  })

  // Debug aid for automated tests / diagnosis.
  try {
    ;(globalThis as any).__fnGameOverDecor = {
      at: performance.now(),
      watermelon: { u: uRetry, v: vButtons, r: wmRadius, ok: okWm, pos: { x: wmPos.x, y: wmPos.y, z: wmPos.z } },
      bomb: { u: uQuit, v: vButtons, r: bombRadius, ok: okB, pos: { x: bombPos.x, y: bombPos.y, z: bombPos.z } },
    }
  } catch {
    /* ignore */
  }
}

export function spawnHomeDecor(ctx: DecorContext, forceRelayout = false) {
  if (!forceRelayout) {
    // If decor already exists, don't respawn.
    if (ctx.entities.some((e) => e.isHomeDecor)) return
  }
  clearHomeDecor(ctx)

  const rect = ctx.cachedLayoutRect
  const camera = ctx.camera
  const placeOnPlayPlane = (u: number, v: number, out: THREE.Vector3) => {
    if (!camera || !rect) return false
    const clientX = rect.left + rect.width * u
    const clientY = rect.top + rect.height * v
    return screenToCameraFacingPlane(clientX, clientY, rect, camera, ctx.playPlaneCenter, out) != null
  }

  const { uStart, uSettings, vStart, vSettings, startRingPx, settingsRingPx } = computeHomeRingLayout(
    rect?.width ?? 800,
    rect?.height ?? 500,
  )

  // Convert an on-screen pixel radius to a world-space radius at the play plane.
  const worldRadiusAt = (u: number, v: number, px: number): number => {
    if (!camera || !rect) return 0.6
    const c = new THREE.Vector3()
    const p = new THREE.Vector3()
    const okC = screenToCameraFacingPlane(
      rect.left + rect.width * u,
      rect.top + rect.height * v,
      rect,
      camera,
      ctx.playPlaneCenter,
      c,
    )
    const okP = screenToCameraFacingPlane(
      rect.left + rect.width * u + px,
      rect.top + rect.height * v,
      rect,
      camera,
      ctx.playPlaneCenter,
      p,
    )
    if (!okC || !okP) return 0.6
    return c.distanceTo(p)
  }

  // Inner hole radius in the SVG: 92 on a 320 viewbox.
  const innerHoleRatio = 92 / 320
  // Fruits should be clearly smaller than the ring hole (match Classic menu proportions).
  const wmRadius = worldRadiusAt(uStart, vStart, (startRingPx * innerHoleRatio) * 0.62)
  const apRadius = worldRadiusAt(uSettings, vSettings, (settingsRingPx * innerHoleRatio) * 0.58)

  // Center start ring: watermelon (slice to start).
  const wmPos = new THREE.Vector3()
  const okWm = placeOnPlayPlane(uStart, vStart, wmPos)
  if (!okWm) {
    wmPos.set(ctx.playPlaneCenter.x, ctx.playPlaneCenter.y + 0.25, ctx.playPlaneCenter.z)
  }
  // Brighter skin so it reads like the Classic menu watermelon.
  const wmRoot = createFruitMesh(wmRadius, 'watermelon', 0x3aa44a)
  wmRoot.position.copy(wmPos)
  ctx.scene.add(wmRoot)
  const wmBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Sphere(wmRadius),
    position: new CANNON.Vec3(wmPos.x, wmPos.y, wmPos.z),
    collisionFilterGroup: 0,
    collisionFilterMask: 0,
  })
  wmBody.collisionResponse = false
  ctx.world.addBody(wmBody)
  ctx.entities.push({
    id: ctx.allocId(),
    root: wmRoot,
    body: wmBody,
    radius: wmRadius,
    color: new THREE.Color(0x3aa44a),
    fleshColor: new THREE.Color(0xff3a5c),
    fruitType: 'watermelon',
    kind: 'fruit',
    missTracked: true,
    isStarter: true,
    isHomeDecor: true,
    homeAnchor: { u: uStart, v: vStart },
  })

  // Right settings ring: green apple (decorative).
  const apPos = new THREE.Vector3()
  const okAp = placeOnPlayPlane(uSettings, vSettings, apPos)
  if (!okAp) {
    apPos.set(ctx.playPlaneCenter.x + 1.85, ctx.playPlaneCenter.y + 0.18, ctx.playPlaneCenter.z)
  }
  const apSkin = 0x77c83c
  const apRoot = createFruitMesh(apRadius, 'apple', apSkin)
  apRoot.position.copy(apPos)
  ctx.scene.add(apRoot)
  const apBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Sphere(apRadius),
    position: new CANNON.Vec3(apPos.x, apPos.y, apPos.z),
    collisionFilterGroup: 0,
    collisionFilterMask: 0,
  })
  apBody.collisionResponse = false
  ctx.world.addBody(apBody)
  ctx.entities.push({
    id: ctx.allocId(),
    root: apRoot,
    body: apBody,
    radius: apRadius,
    color: new THREE.Color(apSkin),
    fleshColor: new THREE.Color(0xfff0ea),
    fruitType: 'apple',
    kind: 'fruit',
    missTracked: true,
    isHomeDecor: true,
    homeAnchor: { u: uSettings, v: vSettings },
  })
}

