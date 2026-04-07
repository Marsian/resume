import * as CANNON from 'cannon-es'
import * as THREE from 'three'

import { GameAudio } from './audio/gameAudio'
import { GAME, SLICE } from './game/constants'
import { createBombMesh, createFruitMesh, disposeObject3D } from './game/meshes'
import { pickFruitKind, randomAngularImpulse, sampleBurstSpawnCount, SPAWN } from './game/spawn'
import { fillPlayPlaneBasis, sampleSpawnKinematics } from './game/spawnPlane'
import { createFruitHalfMesh, disposeFruitHalfRoot } from './game/fruitHalfMesh'
import {
  distPointSegmentSq2,
  projectWorldToScreen,
  screenSliceHitSqThreshold,
  screenToCameraFacingPlane,
} from './game/slice'
import { ComboOverlay2d } from './fx/comboOverlay2d'
import { JuiceBurst } from './fx/juice'
import { BladeTrailOverlay2d } from './fx/trailOverlay2d'
import { createPhysicsWorld } from './physics/world'
import {
  addDefaultLights,
  addDojoBackdrop,
  createCamera,
  createRenderer,
  createScene,
  fitRendererToContainer,
} from './three/engine'

export type GameUiState = {
  score: number
  paused: boolean
  /** Total misses so far (0..GAME.missLimit). */
  misses: number
  gameOver: boolean
  /** `home`: slice the starter watermelon to begin; `playing`: normal waves. */
  phase: 'home' | 'playing'
  error?: string
}

export type FruitNinjaGameOptions = {
  onUi: (s: GameUiState) => void
  /** Fewer particles / calmer trail opacity handled in juice + UI */
  reducedMotion?: boolean
}

type WholeEntity = {
  id: number
  root: THREE.Group
  body: CANNON.Body
  radius: number
  color: THREE.Color
  /** Pulp color for sliced halves (may differ from skin, e.g. watermelon). */
  fleshColor: THREE.Color
  kind: 'fruit' | 'bomb'
  /** True once we counted a “miss” for this fruit */
  missTracked: boolean
  /** Opening watermelon — slice once to leave `home` phase; never counts as a miss. */
  isStarter?: boolean
  /** Decorative fruit used only on the home screen (never counts as miss / score). */
  isHomeDecor?: boolean
  /** Anchor in screen space (0..1) for home decor placement. */
  homeAnchor?: { u: number; v: number }
}

type FruitHalf = {
  root: THREE.Group
  body: CANNON.Body
  removeAt: number
}

function fruitMassFromRadius(r: number) {
  return Math.max(0.4, r * r * r * 5.5)
}

export class FruitNinjaGame {
  private readonly container: HTMLElement
  private readonly opts: FruitNinjaGameOptions
  private readonly audio = new GameAudio()
  private readonly reducedMotion: boolean

  private canvas: HTMLCanvasElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private cameraHome = new THREE.Vector3()

  private world: CANNON.World | null = null
  private juice: JuiceBurst | null = null
  private trail: BladeTrailOverlay2d | null = null
  private comboOverlay: ComboOverlay2d | null = null

  private entities: WholeEntity[] = []
  private halves: FruitHalf[] = []
  private nextId = 1
  private raf: number | null = null
  private lastT = 0
  private spawnAcc = 0
  private nextSpawnIn = 800
  private disposed = false

  private score = 0
  private combo = 0
  private lastSliceAt = 0
  private paused = false
  private misses = 0
  private gameOver = false
  private shakeUntil = 0
  private phase: 'home' | 'playing' = 'home'

  private pointerDown = false
  private stroke: Array<{ x: number; y: number }> = []
  private readonly scratchProj = new THREE.Vector3()
  private readonly scratchWorld = new THREE.Vector3()
  private readonly sliceHitScratch: WholeEntity[] = []
  private readonly sliceEdgeWorld0 = new THREE.Vector3()
  private readonly sliceEdgeWorld1 = new THREE.Vector3()
  private readonly sliceNormal = new THREE.Vector3(1, 0, 0)
  private readonly slicePlaneN = new THREE.Vector3()
  private readonly slicePlaneUp = new THREE.Vector3()
  private readonly slicePlaneRight = new THREE.Vector3()
  private readonly sliceCutTan = new THREE.Vector3()
  private readonly sliceSepDir = new THREE.Vector3()
  private readonly sliceImpulseVec = new THREE.Vector3()
  private readonly sliceAngVel = new THREE.Vector3()
  private readonly sliceHalfOutward = new THREE.Vector3()
  private readonly scratchOrigin = new THREE.Vector3()
  /** Shared with trail: camera-facing plane anchor */
  private readonly playPlaneCenter = new THREE.Vector3(0, 0.55, 0)
  private resizeObserver: ResizeObserver | null = null
  /** Avoid getBoundingClientRect() on every coalesced pointer sample (forces layout). */
  private cachedLayoutRect: DOMRect | null = null
  private uiDirty = false
  private uiRaf: number | null = null

  constructor(container: HTMLElement, opts: FruitNinjaGameOptions) {
    this.container = container
    this.opts = opts
    this.reducedMotion = opts.reducedMotion ?? false
  }

  private emitUi() {
    this.uiDirty = true
    if (this.uiRaf != null) return
    this.uiRaf = requestAnimationFrame(() => {
      this.uiRaf = null
      if (!this.uiDirty) return
      this.uiDirty = false
      this.opts.onUi({
        score: this.score,
        paused: this.paused,
        misses: this.misses,
        gameOver: this.gameOver,
        phase: this.phase,
      })
    })
  }

  private emitUiImmediate(payload: GameUiState) {
    this.uiDirty = false
    if (this.uiRaf != null) {
      cancelAnimationFrame(this.uiRaf)
      this.uiRaf = null
    }
    this.opts.onUi(payload)
  }

  bootstrap(): void {
    try {
      if (this.disposed) return
      const { world } = createPhysicsWorld()
      this.world = world

      this.canvas = document.createElement('canvas')
      this.canvas.className = 'absolute inset-0 h-full w-full touch-none'
      this.canvas.style.display = 'block'
      this.canvas.setAttribute('data-testid', 'fruit-ninja-canvas')
      this.container.appendChild(this.canvas)

      const scene = createScene()
      this.scene = scene
      addDojoBackdrop(scene)
      addDefaultLights(scene)

      const { clientWidth, clientHeight } = this.container
      const camera = createCamera(clientWidth / Math.max(1, clientHeight))
      this.camera = camera
      this.cameraHome.copy(camera.position)

      const renderer = createRenderer(this.canvas)
      this.renderer = renderer
      fitRendererToContainer(renderer, camera, clientWidth, clientHeight)

      const pMul = this.reducedMotion ? 0.45 : 1
      this.juice = new JuiceBurst(scene, { particleMul: pMul })
      this.trail = new BladeTrailOverlay2d(this.container)
      this.comboOverlay = new ComboOverlay2d(this.container)
      this.trail.resize(clientWidth, clientHeight)
      this.comboOverlay.resize(clientWidth, clientHeight)

      this.bindResize()
      this.bindPointer()
      this.lastT = performance.now()
      this.spawnAcc = 0
      this.phase = 'home'
      // Spawn home-screen decor once we have a layout rect; also safe to call now (it will fallback).
      this.spawnHomeDecor()
      this.emitUi()
      requestAnimationFrame(() => {
        if (this.disposed || !this.renderer || !this.camera) return
        const w = this.container.clientWidth
        const h = this.container.clientHeight
        if (w > 2 && h > 2) {
          fitRendererToContainer(this.renderer, this.camera, w, h)
          this.trail?.resize(w, h)
          this.comboOverlay?.resize(w, h)
        }
        this.syncCanvasLayout()
        // Ensure decor is placed correctly after first layout sync.
        if (this.phase === 'home') this.spawnHomeDecor(true)
      })
      if (!this.disposed) this.raf = requestAnimationFrame(this.tick)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.emitUiImmediate({
        score: 0,
        paused: false,
        misses: 0,
        gameOver: false,
        phase: 'home',
        error: msg,
      })
    }
  }

  setPaused(p: boolean) {
    if (this.gameOver) return
    if (this.phase === 'home') return
    this.paused = p
    this.emitUi()
  }

  restart() {
    if (!this.world || !this.scene) return
    for (let i = this.entities.length - 1; i >= 0; i--) {
      this.removeWhole(this.entities[i]!)
    }
    this.entities = []
    for (let i = this.halves.length - 1; i >= 0; i--) {
      this.removeHalf(this.halves[i]!)
    }
    this.halves = []
    this.score = 0
    this.combo = 0
    this.lastSliceAt = 0
    this.spawnAcc = 0
    this.misses = 0
    this.gameOver = false
    this.shakeUntil = 0
    this.paused = false
    this.phase = 'playing'
    if (this.camera) this.camera.position.copy(this.cameraHome)
    this.scheduleNextSpawn()
    this.emitUi()
  }

  /** Reset to the in-game home screen (starter watermelon), not the site game center. */
  goToHomeScreen() {
    if (!this.world || !this.scene) return
    for (let i = this.entities.length - 1; i >= 0; i--) {
      this.removeWhole(this.entities[i]!)
    }
    this.entities = []
    for (let i = this.halves.length - 1; i >= 0; i--) {
      this.removeHalf(this.halves[i]!)
    }
    this.halves = []
    this.score = 0
    this.combo = 0
    this.lastSliceAt = 0
    this.spawnAcc = 0
    this.misses = 0
    this.gameOver = false
    this.shakeUntil = 0
    this.paused = false
    this.phase = 'home'
    if (this.camera) this.camera.position.copy(this.cameraHome)
    this.spawnHomeDecor()
    this.emitUi()
  }

  dispose() {
    this.disposed = true
    if (this.raf != null) cancelAnimationFrame(this.raf)
    this.raf = null
    if (this.uiRaf != null) cancelAnimationFrame(this.uiRaf)
    this.uiRaf = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown)
      this.canvas.removeEventListener('pointermove', this.onPointerMove)
      this.canvas.removeEventListener('pointerup', this.onPointerUp)
      this.canvas.removeEventListener('pointercancel', this.onPointerUp)
      this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    }

    for (let i = this.entities.length - 1; i >= 0; i--) {
      this.removeWhole(this.entities[i]!)
    }
    this.entities = []
    for (let i = this.halves.length - 1; i >= 0; i--) {
      this.removeHalf(this.halves[i]!)
    }
    this.halves = []

    this.trail?.dispose()
    this.trail = null
    this.comboOverlay?.dispose()
    this.comboOverlay = null
    this.juice?.dispose()
    this.juice = null

    if (this.scene) {
      if (this.scene.background instanceof THREE.Texture) {
        this.scene.background.dispose()
        this.scene.background = null
      }
      this.scene.traverse((o: THREE.Object3D) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose()
          const m = o.material
          if (Array.isArray(m)) m.forEach((x) => x.dispose())
          else m.dispose()
        }
      })
    }

    this.renderer?.dispose()
    if (this.canvas?.parentElement) this.canvas.parentElement.removeChild(this.canvas)

    if (this.world) {
      const bodies = [...this.world.bodies]
      for (const b of bodies) this.world.removeBody(b)
    }
    this.world = null
    this.renderer = null
    this.scene = null
    this.camera = null
    this.canvas = null
  }

  private scheduleNextSpawn() {
    this.nextSpawnIn =
      SPAWN.intervalMinMs + Math.random() * (SPAWN.intervalMaxMs - SPAWN.intervalMinMs)
  }

  private clearHomeDecor() {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]!
      if (e.isHomeDecor) this.removeWhole(e)
    }
  }

  private spawnHomeDecor(forceRelayout = false) {
    if (!this.world || !this.scene) return
    if (!forceRelayout) {
      // If decor already exists, don't respawn.
      if (this.entities.some((e) => e.isHomeDecor)) return
    }
    this.clearHomeDecor()

    const rect = this.cachedLayoutRect
    const placeOnPlayPlane = (u: number, v: number, out: THREE.Vector3) => {
      if (!this.camera || !rect) return false
      const clientX = rect.left + rect.width * u
      const clientY = rect.top + rect.height * v
      return screenToCameraFacingPlane(clientX, clientY, rect, this.camera, this.playPlaneCenter, out) != null
    }

    // Anchors match `HomeOverlay` (percent-based, responsive).
    const uStart = 0.58
    const vStart = 0.60
    const uSettings = 0.82
    const vSettings = 0.46

    // Convert an on-screen pixel radius to a world-space radius at the play plane.
    const worldRadiusAt = (u: number, v: number, px: number): number => {
      if (!this.camera || !rect) return 0.6
      const c = new THREE.Vector3()
      const p = new THREE.Vector3()
      const okC = screenToCameraFacingPlane(
        rect.left + rect.width * u,
        rect.top + rect.height * v,
        rect,
        this.camera,
        this.playPlaneCenter,
        c,
      )
      const okP = screenToCameraFacingPlane(
        rect.left + rect.width * u + px,
        rect.top + rect.height * v,
        rect,
        this.camera,
        this.playPlaneCenter,
        p,
      )
      if (!okC || !okP) return 0.6
      return c.distanceTo(p)
    }

    // Ring sizes follow overlay sizing (as fraction of rect width, clamped).
    const startRingPx = Math.max(220, Math.min(320, rect ? rect.width * 0.42 : 260))
    const settingsRingPx = Math.max(140, Math.min(220, rect ? rect.width * 0.28 : 170))
    // Inner hole radius in the SVG: 92 on a 320 viewbox.
    const innerHoleRatio = 92 / 320
    // Fruits should be clearly smaller than the ring hole (match Classic menu proportions).
    const wmRadius = worldRadiusAt(uStart, vStart, (startRingPx * innerHoleRatio) * 0.74)
    const apRadius = worldRadiusAt(uSettings, vSettings, (settingsRingPx * innerHoleRatio) * 0.70)

    // Center start ring: watermelon (slice to start).
    const wmPos = new THREE.Vector3()
    const okWm = placeOnPlayPlane(uStart, vStart, wmPos)
    if (!okWm) {
      wmPos.set(this.playPlaneCenter.x, this.playPlaneCenter.y + 0.25, this.playPlaneCenter.z)
    }
    // Brighter skin so it reads like the Classic menu watermelon.
    const wmRoot = createFruitMesh(wmRadius, 'watermelon', 0x3aa44a)
    wmRoot.position.copy(wmPos)
    this.scene.add(wmRoot)
    const wmBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      shape: new CANNON.Sphere(wmRadius),
      position: new CANNON.Vec3(wmPos.x, wmPos.y, wmPos.z),
    })
    this.world.addBody(wmBody)
    this.entities.push({
      id: this.nextId++,
      root: wmRoot,
      body: wmBody,
      radius: wmRadius,
      color: new THREE.Color(0x3aa44a),
      fleshColor: new THREE.Color(0xff3a5c),
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
      apPos.set(this.playPlaneCenter.x + 1.85, this.playPlaneCenter.y + 0.18, this.playPlaneCenter.z)
    }
    const apSkin = 0x77c83c
    const apRoot = createFruitMesh(apRadius, 'apple', apSkin)
    apRoot.position.copy(apPos)
    this.scene.add(apRoot)
    const apBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      shape: new CANNON.Sphere(apRadius),
      position: new CANNON.Vec3(apPos.x, apPos.y, apPos.z),
    })
    this.world.addBody(apBody)
    this.entities.push({
      id: this.nextId++,
      root: apRoot,
      body: apBody,
      radius: apRadius,
      color: new THREE.Color(apSkin),
      fleshColor: new THREE.Color(0xfff0ea),
      kind: 'fruit',
      missTracked: true,
      isHomeDecor: true,
      homeAnchor: { u: uSettings, v: vSettings },
    })
  }

  private beginGameplayFromHome() {
    if (this.phase !== 'home') return
    // clear the remaining home fruit immediately when we begin.
    this.clearHomeDecor()
    this.phase = 'playing'
    this.spawnAcc = 0
    this.scheduleNextSpawn()
    this.emitUi()
  }

  private syncCanvasLayout() {
    if (!this.canvas) return
    const r = this.canvas.getBoundingClientRect()
    this.cachedLayoutRect = r
    this.trail?.setLayoutRect(r)
    this.comboOverlay?.setLayoutRect(r)
  }

  private bindResize() {
    if (!this.canvas || !this.renderer || !this.camera) return
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.canvas || !this.renderer || !this.camera || !this.trail) return
      const w = this.container.clientWidth
      const h = this.container.clientHeight
      fitRendererToContainer(this.renderer, this.camera, w, h)
      this.trail.resize(w, h)
      this.comboOverlay?.resize(w, h)
      this.syncCanvasLayout()
      if (this.phase === 'home') this.spawnHomeDecor(true)
    })
    this.resizeObserver.observe(this.container)
    queueMicrotask(() => {
      if (this.canvas && this.trail) this.syncCanvasLayout()
    })
  }

  private bindPointer() {
    if (!this.canvas) return
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.audio.resumeFromGesture()
    if (this.paused || this.gameOver || !this.canvas) return
    this.pointerDown = true
    this.stroke.length = 0
    this.syncCanvasLayout()
    this.canvas.setPointerCapture(e.pointerId)
    this.appendStroke(e.clientX, e.clientY)
    this.trail?.clear()
    this.trail?.pushScreenPoint(e.clientX, e.clientY)
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown || this.paused || this.gameOver) return
    const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
    for (const ev of coalesced) {
      this.appendStroke(ev.clientX, ev.clientY)
      this.trail?.pushScreenPoint(ev.clientX, ev.clientY)
    }
    this.trySliceLatestSegment()
  }

  private readonly onPointerUp = (e: PointerEvent) => {
    this.pointerDown = false
    this.stroke.length = 0
    try {
      this.canvas?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    this.trail?.fade()
  }

  private readonly onPointerLeave = () => {
    if (!this.pointerDown) this.trail?.fade()
  }

  private appendStroke(clientX: number, clientY: number) {
    const rect = this.cachedLayoutRect
    if (!rect) return
    const x = clientX - rect.left
    const y = clientY - rect.top
    const last = this.stroke[this.stroke.length - 1]
    if (last && Math.hypot(x - last.x, y - last.y) < 2) return
    this.stroke.push({ x, y })
    if (this.stroke.length > 120) this.stroke.shift()
  }

  private trySliceLatestSegment() {
    if (this.stroke.length < 2 || !this.world || !this.camera || !this.renderer || this.gameOver) return
    const a = this.stroke[this.stroke.length - 2]!
    const b = this.stroke[this.stroke.length - 1]!
    const w = this.renderer.domElement.clientWidth
    const h = this.renderer.domElement.clientHeight
    const threshBase = screenSliceHitSqThreshold(0.45)

    const hit = this.sliceHitScratch
    hit.length = 0
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i]!
      const t = ent.body.position
      this.scratchWorld.set(t.x, t.y, t.z)
      projectWorldToScreen(this.scratchWorld, this.camera, w, h, this.scratchProj)
      const px = this.scratchProj.x
      const py = this.scratchProj.y
      const th = screenSliceHitSqThreshold(ent.radius)
      const d2 = distPointSegmentSq2(px, py, a.x, a.y, b.x, b.y)
      if (d2 <= Math.max(threshBase, th)) hit.push(ent)
    }

    if (hit.length === 0) return

    const rect = this.cachedLayoutRect ?? this.canvas!.getBoundingClientRect()
    const p0 = this.sliceEdgeWorld0
    const p1 = this.sliceEdgeWorld1
    const okA = this.camera && rect.width > 0 && this.projectEdgeToPlayPlane(a, rect, p0)
    const okB = this.camera && rect.width > 0 && this.projectEdgeToPlayPlane(b, rect, p1)
    let nx = 1
    let nz = 0
    if (okA && okB) {
      const dx = p1.x - p0.x
      const dz = p1.z - p0.z
      if (dx * dx + dz * dz > 1e-5) {
        nx = -dz
        nz = dx
        const len = Math.hypot(nx, nz) || 1
        nx /= len
        nz /= len
      }
    }
    const normal = this.sliceNormal
    normal.set(nx, 0, nz)

    // Performance: avoid per-slice allocations from `hit.filter(...)`.
    // Important: bombs must update combo/score/lives before fruits.
    if (this.phase === 'playing') {
      for (let i = 0; i < hit.length; i++) {
        const ent = hit[i]!
        if (ent.kind === 'bomb') this.sliceBomb(ent)
      }
    }

    for (let i = 0; i < hit.length; i++) {
      const f = hit[i]!
      if (f.kind !== 'fruit') continue
      // On home screen: slicing ANY displayed fruit begins the game and clears both fruits.
      const homeSlice = this.phase === 'home' && f.isHomeDecor

      const now = performance.now()
      const wasStarter = f.isStarter === true
      if (wasStarter) {
        this.combo = 0
        this.lastSliceAt = 0
      } else {
        if (now - this.lastSliceAt < GAME.comboWindowMs) this.combo = Math.min(GAME.comboCap, this.combo + 1)
        else this.combo = 1
        this.lastSliceAt = now
      }
      this.audio.playSlice()

      // Capture screen-projection inputs before `sliceFruit` removes the entity.
      const { x: fx, y: fy, z: fz } = f.body.position
      this.sliceFruit(f, okA && okB ? p0 : null, okA && okB ? p1 : null, normal)
      if (!wasStarter) {
        this.score += GAME.sliceScoreBase * Math.min(this.combo, GAME.scoreComboMultCap)
      }

      if (!wasStarter && this.combo > 1 && this.camera && this.renderer) {
        this.scratchWorld.set(fx, fy, fz)
        projectWorldToScreen(this.scratchWorld, this.camera, w, h, this.scratchProj)
        this.comboOverlay?.pushCombo(this.scratchProj.x, this.scratchProj.y, this.combo, now)
      }

      if (homeSlice || wasStarter) {
        // Clear the other home fruit at the same time.
        this.clearHomeDecor()
        this.beginGameplayFromHome()
      }
    }

    this.emitUi()
  }

  private projectEdgeToPlayPlane(
    edge: { x: number; y: number },
    rect: DOMRect,
    target: THREE.Vector3,
  ): boolean {
    if (!this.camera) return false
    const clientX = rect.left + edge.x
    const clientY = rect.top + edge.y
    return (
      screenToCameraFacingPlane(clientX, clientY, rect, this.camera, this.playPlaneCenter, target) != null
    )
  }

  private sliceBomb(ent: WholeEntity) {
    if (!this.world || !this.scene || !this.juice) return
    const t = ent.body.position
    const origin = this.scratchOrigin
    origin.set(t.x, t.y, t.z)
    this.juice.burstAt(origin, new THREE.Color(0xff4400), 72)
    this.removeWhole(ent)
    this.audio.playBomb()
    this.combo = 0
    this.lastSliceAt = 0
    this.score = Math.max(0, this.score - GAME.bombPenaltyScore)
    // Bomb counts as a single miss.
    this.misses = Math.min(GAME.missLimit, this.misses + 1)
    this.shakeUntil = performance.now() + 240
    if (this.misses >= GAME.missLimit) {
      this.gameOver = true
      this.paused = true
      this.audio.playGameOver()
    }
  }

  private sliceFruit(
    ent: WholeEntity,
    cutP0: THREE.Vector3 | null,
    cutP1: THREE.Vector3 | null,
    fallbackNormal: THREE.Vector3,
  ) {
    if (!this.world || !this.scene || !this.juice || !this.camera) return
    const t = ent.body.position
    const origin = this.scratchOrigin
    origin.set(t.x, t.y, t.z)
    this.juice.burstAt(origin, ent.color, this.reducedMotion ? 26 : 44)
    this.removeWhole(ent)

    fillPlayPlaneBasis(
      this.camera,
      this.playPlaneCenter,
      this.slicePlaneN,
      this.slicePlaneUp,
      this.slicePlaneRight,
    )
    const planeN = this.slicePlaneN
    const planeUp = this.slicePlaneUp
    const sep = this.sliceSepDir
    const cutTan = this.sliceCutTan

    let haveEdge = false
    if (cutP0 && cutP1) {
      cutTan.copy(cutP1).sub(cutP0)
      cutTan.addScaledVector(planeN, -planeN.dot(cutTan))
      if (cutTan.lengthSq() > 1e-6) {
        cutTan.normalize()
        sep.crossVectors(planeN, cutTan).normalize()
        haveEdge = true
      }
    }
    if (!haveEdge) {
      sep.copy(fallbackNormal)
      if (sep.lengthSq() < 1e-6) sep.copy(this.slicePlaneRight)
      sep.addScaledVector(planeN, -planeN.dot(sep))
      if (sep.lengthSq() < 1e-6) sep.copy(this.slicePlaneRight)
      else sep.normalize()
      cutTan.crossVectors(sep, planeN).normalize()
    }

    const j = (Math.random() - 0.5) * 2 * SLICE.sepAngleJitter
    const cj = Math.cos(j)
    const sj = Math.sin(j)
    this.scratchWorld.copy(sep)
    this.scratchProj.copy(cutTan)
    sep.copy(this.scratchWorld).multiplyScalar(cj).addScaledVector(this.scratchProj, sj)
    cutTan.copy(this.scratchProj).multiplyScalar(cj).addScaledVector(this.scratchWorld, -sj)

    const r = ent.radius
    const flesh = ent.fleshColor
    const phyR = r * 0.52
    const impSep = SLICE.sepImpulseMin + Math.random() * (SLICE.sepImpulseMax - SLICE.sepImpulseMin)
    const impVertDiff =
      SLICE.vertDiffImpulseMin + Math.random() * (SLICE.vertDiffImpulseMax - SLICE.vertDiffImpulseMin)
    const impSharedUp =
      SLICE.sharedUpImpulseMin + Math.random() * (SLICE.sharedUpImpulseMax - SLICE.sharedUpImpulseMin)
    const spinBase =
      SLICE.cutAxisSpinMin + Math.random() * (SLICE.cutAxisSpinMax - SLICE.cutAxisSpinMin)
    const spinJitter = (Math.random() - 0.5) * 2 * (SLICE.cutAxisSpinMax - SLICE.cutAxisSpinMin) * 0.35
    const now = performance.now()
    const off = r * 0.48
    const lift = 0.034

    const bv = ent.body.velocity
    const planeRight = this.slicePlaneRight

    for (const sign of [-1, 1] as const) {
      this.sliceHalfOutward.copy(sep).multiplyScalar(sign)

      const x = t.x + sep.x * sign * off + planeUp.x * lift
      const y = t.y + sep.y * sign * off + planeUp.y * lift
      const z = t.z + sep.z * sign * off + planeUp.z * lift

      const root = createFruitHalfMesh(r, this.sliceHalfOutward, ent.color, flesh)
      root.position.set(x, y, z)
      this.scene.add(root)

      const spin = (spinBase + spinJitter * sign) * (0.88 + Math.random() * 0.28)
      this.sliceAngVel.copy(cutTan).multiplyScalar(spin * sign)
      this.sliceAngVel.addScaledVector(sep, (Math.random() - 0.5) * 2 * SLICE.angNoiseInPlane)
      this.sliceAngVel.addScaledVector(planeN, (Math.random() - 0.5) * 2 * SLICE.angNoiseDepth)
      this.sliceAngVel.addScaledVector(planeUp, (Math.random() - 0.5) * SLICE.angNoiseInPlane * 0.45)

      const mass = fruitMassFromRadius(phyR) * 0.58
      const body = new CANNON.Body({
        mass,
        shape: new CANNON.Sphere(phyR),
        position: new CANNON.Vec3(x, y, z),
        velocity: new CANNON.Vec3(bv.x, bv.y, bv.z),
        angularVelocity: new CANNON.Vec3(this.sliceAngVel.x, this.sliceAngVel.y, this.sliceAngVel.z),
        collisionFilterGroup: 0,
        collisionFilterMask: 0,
      })
      const q = root.quaternion
      body.quaternion.set(q.x, q.y, q.z, q.w)
      this.world.addBody(body)

      const halfSep =
        impSep *
        (SLICE.halfSepScaleMin + Math.random() * (SLICE.halfSepScaleMax - SLICE.halfSepScaleMin))
      const vertKick =
        impSharedUp +
        sign * impVertDiff +
        (Math.random() - 0.5) * 2 * SLICE.vertImpulseNoise
      const rightKick = (Math.random() - 0.5) * 2 * SLICE.planarRightJitter
      const depthKick = (Math.random() - 0.5) * 2 * SLICE.planarDepthJitter

      this.sliceImpulseVec.copy(sep).multiplyScalar(sign * halfSep)
      this.sliceImpulseVec.addScaledVector(planeUp, vertKick)
      this.sliceImpulseVec.addScaledVector(planeRight, rightKick)
      this.sliceImpulseVec.addScaledVector(planeN, depthKick)

      body.applyImpulse(
        new CANNON.Vec3(this.sliceImpulseVec.x, this.sliceImpulseVec.y, this.sliceImpulseVec.z),
        new CANNON.Vec3(0, 0, 0),
      )

      this.halves.push({ root, body, removeAt: now + 2800 })
    }
  }

  private removeWhole(ent: WholeEntity) {
    const idx = this.entities.indexOf(ent)
    if (idx >= 0) this.entities.splice(idx, 1)
    this.scene?.remove(ent.root)
    disposeObject3D(ent.root)
    if (this.world) this.world.removeBody(ent.body)
  }

  private removeHalf(h: FruitHalf) {
    const idx = this.halves.indexOf(h)
    if (idx >= 0) this.halves.splice(idx, 1)
    this.scene?.remove(h.root)
    disposeFruitHalfRoot(h.root)
    if (this.world) this.world.removeBody(h.body)
  }

  private registerMiss() {
    if (this.gameOver) return
    this.audio.playMiss()
    this.misses = Math.min(GAME.missLimit, this.misses + 1)
    this.combo = 0
    this.audio.playLifeLost()
    this.shakeUntil = performance.now() + 160
    if (this.misses >= GAME.missLimit) {
      this.gameOver = true
      this.paused = true
      this.audio.playGameOver()
    }
    this.emitUi()
  }

  private spawnEntity() {
    if (!this.world || !this.scene || !this.camera || this.gameOver || this.phase !== 'playing') return
    if (this.entities.length >= GAME.maxWholeEntities) return

    const isBomb = Math.random() < GAME.bombSpawnChance
    const radius =
      SPAWN.radiusMin + Math.random() * (SPAWN.radiusMax - SPAWN.radiusMin)
    const { position: p0, velocity: v0 } = sampleSpawnKinematics(
      this.camera,
      this.playPlaneCenter,
      this.cachedLayoutRect,
    )
    const x = p0.x
    const y = p0.y
    const z = p0.z

    let root: THREE.Group
    let color: THREE.Color
    let fleshColor: THREE.Color
    let kind: 'fruit' | 'bomb'

    if (isBomb) {
      root = createBombMesh(radius)
      color = new THREE.Color(0xff3300)
      fleshColor = color.clone()
      kind = 'bomb'
    } else {
      const k = pickFruitKind()
      root = createFruitMesh(radius, k.kind, k.skin)
      color = new THREE.Color(k.skin)
      fleshColor = new THREE.Color(k.flesh)
      kind = 'fruit'
    }

    root.position.set(x, y, z)
    this.scene.add(root)

    const ang = randomAngularImpulse()
    const mass = fruitMassFromRadius(radius) * (kind === 'bomb' ? 1.15 : 1)
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(x, y, z),
      velocity: new CANNON.Vec3(v0.x, v0.y, v0.z),
      angularVelocity: new CANNON.Vec3(ang.ax, ang.ay, ang.az),
    })
    this.world.addBody(body)

    this.entities.push({
      id: this.nextId++,
      root,
      body,
      radius,
      color,
      fleshColor,
      kind,
      missTracked: false,
    })
  }

  private readonly tick = (t: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)

    const dt = Math.min(0.05, (t - this.lastT) / 1000)
    this.lastT = t

    if (!this.world || !this.renderer || !this.scene || !this.camera) return

    this.juice?.update(t)

    const now = performance.now()
    if (this.camera && now < this.shakeUntil) {
      const a = (Math.random() - 0.5) * 0.14
      const b = (Math.random() - 0.5) * 0.08
      this.camera.position.set(this.cameraHome.x + a, this.cameraHome.y + b, this.cameraHome.z + a * 0.35)
    } else if (this.camera) {
      this.camera.position.copy(this.cameraHome)
    }

    if (!this.paused && !this.gameOver) {
      this.world.step(1 / 60, dt, 3)
      if (this.phase === 'playing') {
        this.spawnAcc += dt * 1000
        if (this.spawnAcc >= this.nextSpawnIn) {
          this.spawnAcc = 0
          this.scheduleNextSpawn()
          let n = sampleBurstSpawnCount()
          while (n-- > 0 && this.entities.length < GAME.maxWholeEntities) {
            this.spawnEntity()
          }
        }
      }
    }

    for (const ent of [...this.entities]) {
      const { x: fx, y: fy, z: fz } = ent.body.position
      if (this.phase === 'home' && ent.isHomeDecor && ent.homeAnchor && this.camera && this.cachedLayoutRect) {
        // Keep home fruits anchored in screen space; slow rotation only (no bob).
        const anchor = ent.homeAnchor
        const pos = this.scratchWorld
        const ok = screenToCameraFacingPlane(
          this.cachedLayoutRect.left + this.cachedLayoutRect.width * anchor.u,
          this.cachedLayoutRect.top + this.cachedLayoutRect.height * anchor.v,
          this.cachedLayoutRect,
          this.camera,
          this.playPlaneCenter,
          pos,
        )
        if (ok) {
          ent.root.position.set(pos.x, pos.y, pos.z)
          ent.body.position.set(pos.x, pos.y, pos.z)
        } else {
          ent.root.position.set(fx, fy, fz)
          ent.body.position.set(fx, fy, fz)
        }
        // Important: don't let body.quaternion overwrite this rotation later.
        const ry = (t * 0.00055 + ent.id * 0.8) % (Math.PI * 2)
        ent.root.rotation.set(0, ry, 0)
        ent.body.quaternion.setFromEuler(0, ry, 0, 'XYZ')
      } else {
        ent.root.position.set(fx, fy, fz)
        const q = ent.body.quaternion
        ent.root.quaternion.set(q.x, q.y, q.z, q.w)
      }

      if (
        ent.kind === 'fruit' &&
        !ent.isStarter &&
        !ent.isHomeDecor &&
        !ent.missTracked &&
        ent.body.velocity.y < -0.35 &&
        fy < GAME.missY
      ) {
        ent.missTracked = true
        this.registerMiss()
      }

      if (fy < GAME.cullY) {
        this.removeWhole(ent)
      }
    }

    for (const h of [...this.halves]) {
      const { x: hx, y: hy, z: hz } = h.body.position
      h.root.position.set(hx, hy, hz)
      const q = h.body.quaternion
      h.root.quaternion.set(q.x, q.y, q.z, q.w)
      if (now >= h.removeAt || hy < GAME.cullY - 1) {
        this.removeHalf(h)
      }
    }

    this.renderer.render(this.scene, this.camera)
    this.comboOverlay?.tick(now)
  }
}
