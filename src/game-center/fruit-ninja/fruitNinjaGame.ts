import * as CANNON from 'cannon-es'
import * as THREE from 'three'

import { GameAudio } from './audio/gameAudio'
import { GAME } from './game/constants'
import { createBombMesh, createFruitMesh, disposeObject3D } from './game/meshes'
import { pickFruitKind, randomAngularImpulse, SPAWN } from './game/spawn'
import { sampleSpawnKinematics } from './game/spawnPlane'
import { createFruitHalfMesh, disposeFruitHalfRoot, fleshColorFromSkin } from './game/fruitHalfMesh'
import {
  distPointSegmentSq2,
  projectWorldToScreen,
  screenSliceHitSqThreshold,
  screenToCameraFacingPlane,
} from './game/slice'
import { JuiceBurst } from './fx/juice'
import { BladeTrailOverlay2d } from './fx/trailOverlay2d'
import { createPhysicsWorld } from './physics/world'
import {
  addDefaultLights,
  addDojoBackdrop,
  addStage,
  createCamera,
  createRenderer,
  createScene,
  fitRendererToContainer,
} from './three/engine'

export type GameUiState = {
  score: number
  combo: number
  paused: boolean
  lives: number
  gameOver: boolean
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
  kind: 'fruit' | 'bomb'
  /** True once we counted a “miss” for this fruit */
  missTracked: boolean
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
  private lives: number = GAME.livesStart
  private missStreak = 0
  private gameOver = false
  private shakeUntil = 0

  private pointerDown = false
  private stroke: Array<{ x: number; y: number }> = []
  private readonly scratchProj = new THREE.Vector3()
  private readonly scratchWorld = new THREE.Vector3()
  /** Shared with trail: camera-facing plane anchor */
  private readonly playPlaneCenter = new THREE.Vector3(0, 0.55, 0)
  private resizeObserver: ResizeObserver | null = null
  /** Avoid getBoundingClientRect() on every coalesced pointer sample (forces layout). */
  private cachedLayoutRect: DOMRect | null = null

  constructor(container: HTMLElement, opts: FruitNinjaGameOptions) {
    this.container = container
    this.opts = opts
    this.reducedMotion = opts.reducedMotion ?? false
  }

  private emitUi() {
    this.opts.onUi({
      score: this.score,
      combo: this.combo,
      paused: this.paused,
      lives: this.lives,
      gameOver: this.gameOver,
    })
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
      addStage(scene)

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
      this.trail.resize(clientWidth, clientHeight)

      this.bindResize()
      this.bindPointer()
      this.lastT = performance.now()
      this.spawnAcc = 0
      this.scheduleNextSpawn()
      this.emitUi()
      requestAnimationFrame(() => {
        if (this.disposed || !this.renderer || !this.camera) return
        const w = this.container.clientWidth
        const h = this.container.clientHeight
        if (w > 2 && h > 2) {
          fitRendererToContainer(this.renderer, this.camera, w, h)
          this.trail?.resize(w, h)
        }
        this.syncCanvasLayout()
      })
      if (!this.disposed) this.raf = requestAnimationFrame(this.tick)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.opts.onUi({
        score: 0,
        combo: 0,
        paused: false,
        lives: GAME.livesStart,
        gameOver: false,
        error: msg,
      })
    }
  }

  setPaused(p: boolean) {
    if (this.gameOver) return
    this.paused = p
    this.emitUi()
  }

  restart() {
    if (!this.world || !this.scene) return
    for (const e of [...this.entities]) this.removeWhole(e)
    this.entities = []
    for (const h of [...this.halves]) this.removeHalf(h)
    this.halves = []
    this.score = 0
    this.combo = 0
    this.lastSliceAt = 0
    this.spawnAcc = 0
    this.lives = GAME.livesStart
    this.missStreak = 0
    this.gameOver = false
    this.shakeUntil = 0
    this.paused = false
    if (this.camera) this.camera.position.copy(this.cameraHome)
    this.scheduleNextSpawn()
    this.emitUi()
  }

  dispose() {
    this.disposed = true
    if (this.raf != null) cancelAnimationFrame(this.raf)
    this.raf = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown)
      this.canvas.removeEventListener('pointermove', this.onPointerMove)
      this.canvas.removeEventListener('pointerup', this.onPointerUp)
      this.canvas.removeEventListener('pointercancel', this.onPointerUp)
      this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    }

    for (const e of [...this.entities]) this.removeWhole(e)
    this.entities = []
    for (const h of [...this.halves]) this.removeHalf(h)
    this.halves = []

    this.trail?.dispose()
    this.trail = null
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

  private syncCanvasLayout() {
    if (!this.canvas) return
    const r = this.canvas.getBoundingClientRect()
    this.cachedLayoutRect = r
    this.trail?.setLayoutRect(r)
  }

  private bindResize() {
    if (!this.canvas || !this.renderer || !this.camera) return
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.canvas || !this.renderer || !this.camera || !this.trail) return
      const w = this.container.clientWidth
      const h = this.container.clientHeight
      fitRendererToContainer(this.renderer, this.camera, w, h)
      this.trail.resize(w, h)
      this.syncCanvasLayout()
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

    const hit: WholeEntity[] = []
    for (const ent of [...this.entities]) {
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
    const p0 = new THREE.Vector3()
    const p1 = new THREE.Vector3()
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
    const normal = new THREE.Vector3(nx, 0, nz)

    const bombs = hit.filter((e) => e.kind === 'bomb')
    const fruits = hit.filter((e) => e.kind === 'fruit')

    for (const b of bombs) this.sliceBomb(b)
    for (const f of fruits) {
      const now = performance.now()
      if (now - this.lastSliceAt < GAME.comboWindowMs) this.combo = Math.min(GAME.comboCap, this.combo + 1)
      else this.combo = 1
      this.lastSliceAt = now
      this.audio.playSlice()
      this.sliceFruit(f, normal)
      this.score += GAME.sliceScoreBase * Math.min(this.combo, GAME.scoreComboMultCap)
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
    const origin = new THREE.Vector3(t.x, t.y, t.z)
    this.juice.burstAt(origin, new THREE.Color(0xff4400), 72)
    this.removeWhole(ent)
    this.audio.playBomb()
    this.combo = 0
    this.lastSliceAt = 0
    this.score = Math.max(0, this.score - GAME.bombPenaltyScore)
    this.lives = Math.max(0, this.lives - 1)
    this.shakeUntil = performance.now() + 240
    if (this.lives <= 0) {
      this.gameOver = true
      this.paused = true
      this.audio.playGameOver()
    }
  }

  private sliceFruit(ent: WholeEntity, normal: THREE.Vector3) {
    if (!this.world || !this.scene || !this.juice) return
    const t = ent.body.position
    const origin = new THREE.Vector3(t.x, t.y, t.z)
    this.juice.burstAt(origin, ent.color, this.reducedMotion ? 32 : 56)
    this.removeWhole(ent)

    const n = normal.clone()
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0)
    n.y = 0
    n.normalize()

    const r = ent.radius
    const flesh = fleshColorFromSkin(ent.color)
    const phyR = r * 0.52
    const impulse = 5.5 + Math.random() * 3.2
    const now = performance.now()

    for (const sign of [-1, 1] as const) {
      const outward = n.clone().multiplyScalar(sign)
      const x = t.x + n.x * sign * r * 0.48
      const y = t.y + 0.04
      const z = t.z + n.z * sign * r * 0.48

      const root = createFruitHalfMesh(r, outward, ent.color, flesh)
      root.position.set(x, y, z)
      this.scene.add(root)

      const mass = fruitMassFromRadius(phyR) * 0.58
      const body = new CANNON.Body({
        mass,
        shape: new CANNON.Sphere(phyR),
        position: new CANNON.Vec3(x, y, z),
        angularVelocity: new CANNON.Vec3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
        ),
      })
      const q = root.quaternion
      body.quaternion.set(q.x, q.y, q.z, q.w)
      this.world.addBody(body)

      const ix = n.x * sign * impulse
      const iy = 1.8 + Math.random() * 1.2
      const iz = n.z * sign * impulse
      body.applyImpulse(new CANNON.Vec3(ix, iy, iz), new CANNON.Vec3(0, 0, 0))

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
    this.missStreak++
    this.audio.playMiss()
    if (this.missStreak >= GAME.missesPerLife) {
      this.missStreak = 0
      this.combo = 0
      this.lives = Math.max(0, this.lives - 1)
      this.audio.playLifeLost()
      this.shakeUntil = performance.now() + 160
      if (this.lives <= 0) {
        this.gameOver = true
        this.paused = true
        this.audio.playGameOver()
      }
    }
    this.emitUi()
  }

  private spawnEntity() {
    if (!this.world || !this.scene || !this.camera || this.gameOver) return
    if (this.entities.length >= GAME.maxWholeEntities) return

    const isBomb = Math.random() < GAME.bombSpawnChance
    const radius =
      SPAWN.radiusMin + Math.random() * (SPAWN.radiusMax - SPAWN.radiusMin)
    const { position: p0, velocity: v0 } = sampleSpawnKinematics(this.camera)
    const x = p0.x
    const y = p0.y
    const z = p0.z

    let root: THREE.Group
    let color: THREE.Color
    let kind: 'fruit' | 'bomb'

    if (isBomb) {
      root = createBombMesh(radius)
      color = new THREE.Color(0xff3300)
      kind = 'bomb'
    } else {
      const k = pickFruitKind()
      root = createFruitMesh(radius, k.color)
      color = new THREE.Color(k.color)
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
      this.spawnAcc += dt * 1000
      if (this.spawnAcc >= this.nextSpawnIn) {
        this.spawnAcc = 0
        this.scheduleNextSpawn()
        this.spawnEntity()
      }
    }

    for (const ent of [...this.entities]) {
      const { x: fx, y: fy, z: fz } = ent.body.position
      ent.root.position.set(fx, fy, fz)
      const q = ent.body.quaternion
      ent.root.quaternion.set(q.x, q.y, q.z, q.w)

      if (ent.kind === 'fruit' && !ent.missTracked && ent.body.velocity.y < -0.35 && fy < GAME.missY) {
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
  }
}
