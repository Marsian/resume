import * as CANNON from 'cannon-es'
import * as THREE from 'three'

import { GameAudio } from './audio/gameAudio'
import { GAME, SLICE } from './game/constants'
import { createBombMesh, createFruitMesh, disposeObject3D } from './game/meshes'
import { pickFruitKind, randomAngularImpulse, sampleBurstSpawnCount, SPAWN, type FruitArchetype } from './game/spawn'
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
import { computeGameOverLayout, computeHomeRingLayout } from './homeMenuLayout'

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
  /** Only present for fruits (not bombs). */
  fruitType?: FruitArchetype
  kind: 'fruit' | 'bomb'
  /** True once we counted a “miss” for this fruit */
  missTracked: boolean
  /** Opening watermelon — slice once to leave `home` phase; never counts as a miss. */
  isStarter?: boolean
  /** Decorative fruit used only on the home screen (never counts as miss / score). */
  isHomeDecor?: boolean
  /** Decorative objects on the game-over screen (watermelon + bomb); not sliceable while overlay is up. */
  isGameOverDecor?: boolean
  /** Anchor in screen space (0..1) for home decor placement. */
  homeAnchor?: { u: number; v: number }
  /** Decor visibility is gated until anchor position stabilizes. */
  _anchorLastPos?: THREE.Vector3
  _anchorStableFrames?: number
}

type FruitHalf = {
  root: THREE.Group
  body: CANNON.Body
  removeAt: number
}

type ExplosionFx = {
  mesh: THREE.Mesh
  startAt: number
  endAt: number
  baseScale: number
}

// Stable per-archetype radii (no randomness). Relative sizes: watermelon largest, cherry smallest.
const FRUIT_RADIUS: Record<FruitArchetype, number> = {
  watermelon: 0.58,
  pineapple: 0.56,
  coconut: 0.54,
  mango: 0.52,
  pear: 0.51,
  peach: 0.50,
  apple: 0.49,
  orange: 0.48,
  plum: 0.46,
  passionfruit: 0.45,
  lemon: 0.44,
  lime: 0.43,
  kiwi: 0.42,
  strawberry: 0.41,
  banana: 0.47,
  cherry: 0.38,
}

const BOMB_RADIUS = 0.50

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
  private menuActionPending = false
  private menuSliceCandidate: WholeEntity | null = null
  private gameOverDecorReady = false
  /** While game-over is up, briefly step physics to animate slice FX. */
  private gameOverFxUntil = 0
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
  private readonly explosions: ExplosionFx[] = []

  constructor(container: HTMLElement, opts: FruitNinjaGameOptions) {
    this.container = container
    this.opts = opts
    this.reducedMotion = opts.reducedMotion ?? false
  }

  private spawnExplosionAt(pos: THREE.Vector3, strength = 1) {
    if (!this.scene) return
    const startAt = performance.now()
    const dur = this.reducedMotion ? 240 : 420
    const endAt = startAt + dur

    const geom = new THREE.SphereGeometry(1, 24, 18)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffb020,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.copy(pos)
    mesh.renderOrder = 99
    this.scene.add(mesh)

    this.explosions.push({
      mesh,
      startAt,
      endAt,
      baseScale: 0.5 + 0.35 * strength,
    })
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
    this.menuActionPending = false
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
    this.menuActionPending = false
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

  /** Test-only helper (used by Playwright sweep via query param in `FruitNinjaView`). */
  debugForceGameOver() {
    if (this.disposed) return
    if (this.phase !== 'playing') this.phase = 'playing'
    this.gameOver = true
    this.paused = true
    this.misses = GAME.missLimit
    this.clearGameplayAndSpawnGameOverDecor()
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

  private clearGameOverDecor() {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]!
      if (e.isGameOverDecor) this.removeWhole(e)
    }
  }

  /** Clear flying fruit/bombs/halves and show game-over ring props (Classic-style). */
  private clearGameplayAndSpawnGameOverDecor() {
    this.clearGameOverDecor()
    for (const h of [...this.halves]) {
      this.removeHalf(h)
    }
    for (let i = this.entities.length - 1; i >= 0; i--) {
      this.removeWhole(this.entities[i]!)
    }
    // Ensure we have a fresh layout rect so props don't spawn at fallback positions then “fly in”.
    this.syncCanvasLayout()
    this.spawnGameOverDecor(true)
  }

  private spawnGameOverDecor(forceRelayout = false) {
    if (!this.world || !this.scene || !this.gameOver) return
    if (!forceRelayout && this.entities.some((e) => e.isGameOverDecor)) return
    this.clearGameOverDecor()
    this.gameOverDecorReady = false
    this.gameOverFxUntil = 0

    const rect = this.cachedLayoutRect
    if (!rect || !this.camera) {
      // We'll retry on the next resize/layout sync.
      requestAnimationFrame(() => {
        if (this.disposed) return
        this.syncCanvasLayout()
        this.spawnGameOverDecor(true)
      })
      return
    }
    const camera = this.camera
    const placeOnPlayPlane = (u: number, v: number, out: THREE.Vector3) => {
      const clientX = rect.left + rect.width * u
      const clientY = rect.top + rect.height * v
      return screenToCameraFacingPlane(clientX, clientY, rect, camera, this.playPlaneCenter, out) != null
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
        this.playPlaneCenter,
        c,
      )
      const okP = screenToCameraFacingPlane(
        rect.left + rect.width * u + px,
        rect.top + rect.height * v,
        rect,
        camera,
        this.playPlaneCenter,
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
        if (this.disposed) return
        this.syncCanvasLayout()
        this.spawnGameOverDecor(true)
      })
      return
    }
    const wmRoot = createFruitMesh(wmRadius, 'watermelon', 0x3aa44a)
    wmRoot.position.copy(wmPos)
    wmRoot.visible = false
    this.scene.add(wmRoot)
    const wmBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      shape: new CANNON.Sphere(wmRadius),
      position: new CANNON.Vec3(wmPos.x, wmPos.y, wmPos.z),
      collisionFilterGroup: 0,
      collisionFilterMask: 0,
    })
    wmBody.collisionResponse = false
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
      isStarter: false,
      isGameOverDecor: true,
      homeAnchor: { u: uRetry, v: vButtons },
      _anchorLastPos: new THREE.Vector3(wmPos.x, wmPos.y, wmPos.z),
      _anchorStableFrames: 0,
    })
    const bombRoot = createBombMesh(bombRadius)
    bombRoot.position.copy(bombPos)
    bombRoot.visible = false
    this.scene.add(bombRoot)
    const bombBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      shape: new CANNON.Sphere(bombRadius),
      position: new CANNON.Vec3(bombPos.x, bombPos.y, bombPos.z),
      collisionFilterGroup: 0,
      collisionFilterMask: 0,
    })
    bombBody.collisionResponse = false
    this.world.addBody(bombBody)
    this.entities.push({
      id: this.nextId++,
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

    const { uStart, uSettings, vStart, vSettings, startRingPx, settingsRingPx } = computeHomeRingLayout(
      rect?.width ?? 800,
      rect?.height ?? 500,
    )

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

    // Inner hole radius in the SVG: 92 on a 320 viewbox.
    const innerHoleRatio = 92 / 320
    // Fruits should be clearly smaller than the ring hole (match Classic menu proportions).
    const wmRadius = worldRadiusAt(uStart, vStart, (startRingPx * innerHoleRatio) * 0.62)
    const apRadius = worldRadiusAt(uSettings, vSettings, (settingsRingPx * innerHoleRatio) * 0.58)

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
      collisionFilterGroup: 0,
      collisionFilterMask: 0,
    })
    wmBody.collisionResponse = false
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
      collisionFilterGroup: 0,
      collisionFilterMask: 0,
    })
    apBody.collisionResponse = false
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
      if (this.gameOver) this.spawnGameOverDecor(true)
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
    // Allow slicing to select actions on the game-over screen.
    if ((!this.gameOver && this.paused) || !this.canvas) return
    this.pointerDown = true
    this.menuSliceCandidate = null
    this.stroke.length = 0
    this.syncCanvasLayout()
    this.canvas.setPointerCapture(e.pointerId)
    this.appendStroke(e.clientX, e.clientY)
    this.trail?.clear()
    this.trail?.pushScreenPoint(e.clientX, e.clientY)
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown) return
    if (!this.gameOver && this.paused) return
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

  private commitGameOverMenuSelection() {
    if (!this.gameOver) return
    if (this.menuActionPending) return
    if (!this.gameOverDecorReady) return
    const cand = this.menuSliceCandidate
    this.menuSliceCandidate = null
    if (!cand || !cand.isGameOverDecor) return
    if (this.stroke.length < 2) return
    const a0 = this.stroke[0]!
    const b0 = this.stroke[this.stroke.length - 1]!
    const { hits, okPlane, p0, p1 } = this.collectHitsForStrokeSegment(a0, b0)
    if (!okPlane || !p0 || !p1) return
    if (!hits.includes(cand)) return

    // Stable cut normal from the stroke direction on the play plane.
    const dx = p1.x - p0.x
    const dz = p1.z - p0.z
    let nx = -dz
    let nz = dx
    const nLen = Math.hypot(nx, nz) || 1
    nx /= nLen
    nz /= nLen
    this.sliceNormal.set(nx, 0, nz)

    this.menuActionPending = true
    if (cand.kind === 'fruit') {
      this.audio.playSlice()
      this.sliceFruit(cand, p0, p1, this.sliceNormal)
      // Game-over is paused; briefly step physics so halves fly out like the home screen.
      this.gameOverFxUntil = performance.now() + 650
    } else {
      if (this.juice) {
        const pos = cand.body.position
        this.scratchOrigin.set(pos.x, pos.y, pos.z)
        this.juice.burstAt(this.scratchOrigin, new THREE.Color(0xff4400), 72)
      }
      this.spawnExplosionAt(this.scratchOrigin, 1.15)
      this.removeWhole(cand)
      this.audio.playBomb()
      this.shakeUntil = performance.now() + (this.reducedMotion ? 160 : 240)
      this.gameOverFxUntil = performance.now() + 520
    }

    setTimeout(() => {
      if (this.disposed) return
      this.menuActionPending = false
      if (cand.kind === 'fruit') this.restart()
      else this.goToHomeScreen()
    }, 650)
  }

  private triggerGameOverAction(cand: WholeEntity, p0: THREE.Vector3, p1: THREE.Vector3) {
    if (!this.gameOver) return
    if (this.menuActionPending) return
    if (!this.gameOverDecorReady) return
    if (!cand.isGameOverDecor || !cand.root.visible) return

    // Stable cut normal from the stroke direction on the play plane.
    const dx = p1.x - p0.x
    const dz = p1.z - p0.z
    let nx = -dz
    let nz = dx
    const nLen = Math.hypot(nx, nz) || 1
    nx /= nLen
    nz /= nLen
    this.sliceNormal.set(nx, 0, nz)

    this.menuActionPending = true
    if (cand.kind === 'fruit') {
      this.audio.playSlice()
      this.sliceFruit(cand, p0, p1, this.sliceNormal)
      // Game-over is paused; briefly step physics so halves fly out like the home screen.
      this.gameOverFxUntil = performance.now() + 650
    } else {
      if (this.juice) {
        const pos = cand.body.position
        this.scratchOrigin.set(pos.x, pos.y, pos.z)
        this.juice.burstAt(this.scratchOrigin, new THREE.Color(0xff4400), 72)
      }
      this.spawnExplosionAt(this.scratchOrigin, 1.15)
      this.removeWhole(cand)
      this.audio.playBomb()
      this.shakeUntil = performance.now() + (this.reducedMotion ? 160 : 240)
      this.gameOverFxUntil = performance.now() + 520
    }

    setTimeout(() => {
      if (this.disposed) return
      this.menuActionPending = false
      if (cand.kind === 'fruit') this.restart()
      else this.goToHomeScreen()
    }, 650)
  }

  private readonly onPointerLeave = () => {
    if (!this.pointerDown) this.trail?.fade()
  }

  /**
   * Unified hit test used by all phases.
   * Project the stroke segment endpoints onto the camera-facing play plane and test
   * distance to each entity center against its physics radius.
   */
  private collectHitsForStrokeSegment(a: { x: number; y: number }, b: { x: number; y: number }) {
    const rect = this.cachedLayoutRect ?? this.canvas?.getBoundingClientRect() ?? null
    if (!rect) return { hits: [] as WholeEntity[], okPlane: false, p0: null as THREE.Vector3 | null, p1: null as THREE.Vector3 | null }

    const p0 = this.sliceEdgeWorld0
    const p1 = this.sliceEdgeWorld1
    const okA = rect.width > 0 && this.projectEdgeToPlayPlane(a, rect, p0)
    const okB = rect.width > 0 && this.projectEdgeToPlayPlane(b, rect, p1)
    if (!okA || !okB) return { hits: [] as WholeEntity[], okPlane: false, p0: null as THREE.Vector3 | null, p1: null as THREE.Vector3 | null }

    const hits: WholeEntity[] = []
    // Hit-test in SCREEN space so only a blade pass over the object can slice it.
    // Using a world-space segment on a play-plane can produce “far away hits” when objects have Y/depth offsets.
    if (!this.camera) return { hits, okPlane: true, p0, p1 }
    const cam = this.camera
    const w = rect.width
    const h = rect.height
    const ax = a.x
    const ay = a.y
    const bx = b.x
    const by = b.y
    const segLenSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay)
    if (segLenSq < 1e-4) return { hits, okPlane: true, p0, p1 }

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion).normalize()
    const cWorld = new THREE.Vector3()
    const cWorldR = new THREE.Vector3()
    const cScr = new THREE.Vector3()
    const rScr = new THREE.Vector3()

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i]!
      if (this.gameOver) {
        if (!ent.isGameOverDecor) continue
      } else {
        if (ent.isGameOverDecor) continue
      }
      if (!ent.root.visible) continue

      cWorld.set(ent.body.position.x, ent.body.position.y, ent.body.position.z)
      projectWorldToScreen(cWorld, cam, w, h, cScr)

      cWorldR.copy(cWorld).addScaledVector(camRight, ent.radius)
      projectWorldToScreen(cWorldR, cam, w, h, rScr)
      const rPx = Math.max(6, Math.hypot(rScr.x - cScr.x, rScr.y - cScr.y))

      // Slightly stricter for bombs to reduce accidental hits.
      const pad = ent.kind === 'bomb' ? 0.82 : 0.95
      const rr = rPx * pad
      const d2 = distPointSegmentSq2(cScr.x, cScr.y, ax, ay, bx, by)
      if (d2 <= rr * rr) hits.push(ent)
    }

    return { hits, okPlane: true, p0, p1 }
  }

  private collectHitsForStrokePoint(a: { x: number; y: number }) {
    const rect = this.cachedLayoutRect ?? this.canvas?.getBoundingClientRect() ?? null
    if (!rect) return { hits: [] as WholeEntity[], okPlane: false, p: null as THREE.Vector3 | null }
    const p = this.sliceEdgeWorld0
    const okA = rect.width > 0 && this.projectEdgeToPlayPlane(a, rect, p)
    if (!okA) return { hits: [] as WholeEntity[], okPlane: false, p: null as THREE.Vector3 | null }
    const hits: WholeEntity[] = []
    if (!this.camera) return { hits, okPlane: true, p }
    const cam = this.camera
    const w = rect.width
    const h = rect.height
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion).normalize()
    const cWorld = new THREE.Vector3()
    const cWorldR = new THREE.Vector3()
    const cScr = new THREE.Vector3()
    const rScr = new THREE.Vector3()
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i]!
      if (this.gameOver) {
        if (!ent.isGameOverDecor) continue
      } else {
        if (ent.isGameOverDecor) continue
      }
      if (!ent.root.visible) continue
      cWorld.set(ent.body.position.x, ent.body.position.y, ent.body.position.z)
      projectWorldToScreen(cWorld, cam, w, h, cScr)
      cWorldR.copy(cWorld).addScaledVector(camRight, ent.radius)
      projectWorldToScreen(cWorldR, cam, w, h, rScr)
      const rPx = Math.max(6, Math.hypot(rScr.x - cScr.x, rScr.y - cScr.y))
      const pad = ent.kind === 'bomb' ? 0.82 : 0.95
      const rr = rPx * pad
      const dx = cScr.x - a.x
      const dy = cScr.y - a.y
      if (dx * dx + dy * dy <= rr * rr) hits.push(ent)
    }
    return { hits, okPlane: true, p }
  }

  private appendStroke(clientX: number, clientY: number) {
    const rect = this.cachedLayoutRect ?? this.canvas?.getBoundingClientRect() ?? null
    if (!rect) return
    if (!this.cachedLayoutRect) this.cachedLayoutRect = rect
    const x = clientX - rect.left
    const y = clientY - rect.top
    this.stroke.push({ x, y })
    if (this.stroke.length > 120) this.stroke.shift()
  }

  private trySliceLatestSegment() {
    if (this.stroke.length < 2 || !this.world || !this.camera || !this.renderer) return
    const a = this.stroke[this.stroke.length - 2]!
    const b = this.stroke[this.stroke.length - 1]!
    const w = this.renderer.domElement.clientWidth
    const h = this.renderer.domElement.clientHeight
    const hit = this.sliceHitScratch
    hit.length = 0
    const { hits, okPlane, p0, p1 } = this.collectHitsForStrokeSegment(a, b)
    for (let i = 0; i < hits.length; i++) hit.push(hits[i]!)

    if (hit.length === 0) return
    if (this.gameOver) {
      if (!this.gameOverDecorReady) return
      if (!okPlane || !p0 || !p1) return
      // Match home/playing behavior: slice immediately on contact.
      const cand = hit.find((e) => e.kind === 'fruit') ?? hit[0]!
      if (cand && cand.isGameOverDecor) this.triggerGameOverAction(cand, p0, p1)
      return
    }

    const okA = okPlane && p0 != null
    const okB = okPlane && p1 != null
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
      this.clearGameplayAndSpawnGameOverDecor()
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

    const fruitType = ent.fruitType ?? 'apple'
    for (const sign of [-1, 1] as const) {
      this.sliceHalfOutward.copy(sep).multiplyScalar(sign)

      const x = t.x + sep.x * sign * off + planeUp.x * lift
      const y = t.y + sep.y * sign * off + planeUp.y * lift
      const z = t.z + sep.z * sign * off + planeUp.z * lift

      const root = createFruitHalfMesh(r, this.sliceHalfOutward, ent.color, flesh, fruitType, sign)
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
      this.clearGameplayAndSpawnGameOverDecor()
    }
    this.emitUi()
  }

  private spawnEntity() {
    if (!this.world || !this.scene || !this.camera || this.gameOver || this.phase !== 'playing') return
    if (this.entities.length >= GAME.maxWholeEntities) return

    const isBomb = Math.random() < GAME.bombSpawnChance
    const k = isBomb ? null : pickFruitKind()
    const radius = isBomb ? BOMB_RADIUS : FRUIT_RADIUS[k!.kind]
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
    let fruitType: FruitArchetype | undefined
    let kind: 'fruit' | 'bomb'

    if (isBomb) {
      root = createBombMesh(radius)
      color = new THREE.Color(0xff3300)
      fleshColor = color.clone()
      fruitType = undefined
      kind = 'bomb'
    } else {
      root = createFruitMesh(radius, k!.kind, k!.skin)
      color = new THREE.Color(k!.skin)
      fleshColor = new THREE.Color(k!.flesh)
      fruitType = k!.kind
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
      collisionFilterGroup: 0,
      collisionFilterMask: 0,
    })
    body.collisionResponse = false
    this.world.addBody(body)

    this.entities.push({
      id: this.nextId++,
      root,
      body,
      radius,
      color,
      fleshColor,
      fruitType,
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

    // Update transient explosion FX even while paused.
    if (this.explosions.length) {
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        const fx = this.explosions[i]!
        const life = (now - fx.startAt) / Math.max(1, fx.endAt - fx.startAt)
        if (life >= 1) {
          this.scene.remove(fx.mesh)
          fx.mesh.geometry.dispose()
          ;(fx.mesh.material as THREE.Material).dispose()
          this.explosions.splice(i, 1)
          continue
        }
        const s = fx.baseScale * (0.65 + 2.6 * life)
        fx.mesh.scale.setScalar(s)
        const m = fx.mesh.material as THREE.MeshBasicMaterial
        const flash = life < 0.12 ? 1 - life / 0.12 : Math.max(0, 1 - (life - 0.12) / 0.88)
        m.opacity = (this.reducedMotion ? 0.5 : 0.75) * flash
      }
    }
    if (this.camera && now < this.shakeUntil) {
      const a = (Math.random() - 0.5) * 0.14
      const b = (Math.random() - 0.5) * 0.08
      this.camera.position.set(this.cameraHome.x + a, this.cameraHome.y + b, this.cameraHome.z + a * 0.35)
    } else if (this.camera) {
      this.camera.position.copy(this.cameraHome)
    }

    const shouldStepPhysics = (!this.paused && !this.gameOver) || (this.gameOver && now < this.gameOverFxUntil)
    if (shouldStepPhysics) {
      this.world.step(1 / 60, dt, 3)
      // Never spawn during game-over even if we temporarily step physics for FX.
      if (!this.gameOver && this.phase === 'playing') {
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

    let gameOverDecorTotal = 0
    let gameOverDecorVisible = 0
    for (const ent of [...this.entities]) {
      const { x: fx, y: fy, z: fz } = ent.body.position
      if (
        ((this.phase === 'home' && ent.isHomeDecor) || (this.gameOver && ent.isGameOverDecor)) &&
        ent.homeAnchor &&
        this.camera &&
        this.cachedLayoutRect
      ) {
        // Keep home / game-over props anchored in screen space; slow rotation only (no bob).
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

          // Don't render until the anchored position stabilizes (prevents “fly in” during initial layout settle).
          const last = ent._anchorLastPos ?? (ent._anchorLastPos = new THREE.Vector3(pos.x, pos.y, pos.z))
          const dx = pos.x - last.x
          const dy = pos.y - last.y
          const dz = pos.z - last.z
          const stable = dx * dx + dy * dy + dz * dz < 1e-6
          if (stable) ent._anchorStableFrames = (ent._anchorStableFrames ?? 0) + 1
          else {
            ent._anchorStableFrames = 0
            last.set(pos.x, pos.y, pos.z)
          }
          const show = (ent._anchorStableFrames ?? 0) >= 2
          ent.root.visible = show
        } else {
          ent.root.position.set(fx, fy, fz)
          ent.body.position.set(fx, fy, fz)
          ent.root.visible = false
        }
        // Important: don't let body.quaternion overwrite this rotation later.
        const ry = (t * 0.00055 + ent.id * 0.8) % (Math.PI * 2)
        // Give a stable tilt like the Classic menu (slight pitch/roll) + slow yaw.
        const tiltX =
          ent.kind === 'bomb' ? -0.26 : ent.isStarter ? -0.22 : -0.18
        const tiltZ =
          ent.kind === 'bomb' ? 0.2 : ent.isStarter ? 0.18 : 0.22
        ent.root.rotation.set(tiltX, ry, tiltZ)
        ent.body.quaternion.setFromEuler(tiltX, ry, tiltZ, 'XYZ')

        if (this.gameOver && ent.isGameOverDecor) {
          gameOverDecorTotal++
          if (ent.root.visible) gameOverDecorVisible++
        }
      } else {
        ent.root.position.set(fx, fy, fz)
        const q = ent.body.quaternion
        ent.root.quaternion.set(q.x, q.y, q.z, q.w)
      }

      if (
        ent.kind === 'fruit' &&
        !ent.isStarter &&
        !ent.isHomeDecor &&
        !ent.isGameOverDecor &&
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

    if (this.gameOver) {
      this.gameOverDecorReady = gameOverDecorTotal > 0 && gameOverDecorVisible === gameOverDecorTotal
    } else if (this.gameOverDecorReady) {
      this.gameOverDecorReady = false
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
