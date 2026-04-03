import * as THREE from 'three'

const MAX_PARTICLES = 720
const LIFE_MS = 560

export class JuiceBurst {
  private readonly scene: THREE.Scene
  private readonly particleMul: number
  private readonly geom: THREE.BufferGeometry
  private readonly mat: THREE.PointsMaterial
  private readonly points: THREE.Points
  private readonly positions: Float32Array
  private readonly velocities: Float32Array
  private readonly colors: Float32Array
  private count = 0
  private birth = 0

  constructor(scene: THREE.Scene, opts?: { particleMul?: number }) {
    this.scene = scene
    this.particleMul = opts?.particleMul ?? 1
    this.positions = new Float32Array(MAX_PARTICLES * 3)
    this.velocities = new Float32Array(MAX_PARTICLES * 3)
    this.colors = new Float32Array(MAX_PARTICLES * 3)
    this.geom = new THREE.BufferGeometry()
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geom.setDrawRange(0, 0)
    this.mat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    this.points = new THREE.Points(this.geom, this.mat)
    this.points.frustumCulled = false
  }

  burstAt(origin: THREE.Vector3, baseColor: THREE.Color, n = 48) {
    this.disposeCurrent()
    this.birth = performance.now()
    const c = baseColor.clone()
    const nClamped = Math.max(6, Math.min(Math.floor(n * this.particleMul), MAX_PARTICLES))
    for (let i = 0; i < nClamped; i++) {
      const i3 = i * 3
      this.positions[i3] = origin.x + (Math.random() - 0.5) * 0.06
      this.positions[i3 + 1] = origin.y + (Math.random() - 0.5) * 0.06
      this.positions[i3 + 2] = origin.z + (Math.random() - 0.5) * 0.06

      const speed = 2.2 + Math.random() * 5.5
      const ux = (Math.random() - 0.5) * 2
      const uy = Math.random() * 1.4 + 0.2
      const uz = (Math.random() - 0.5) * 2
      const len = Math.hypot(ux, uy, uz) || 1
      this.velocities[i3] = (ux / len) * speed
      this.velocities[i3 + 1] = (uy / len) * speed
      this.velocities[i3 + 2] = (uz / len) * speed

      const shade = 0.55 + Math.random() * 0.45
      const r = Math.min(1, c.r * shade + 0.15)
      const g = Math.min(1, c.g * shade + 0.08)
      const b = Math.min(1, c.b * shade + 0.06)
      this.colors[i3] = r
      this.colors[i3 + 1] = g
      this.colors[i3 + 2] = b
    }
    this.count = nClamped
    this.geom.setDrawRange(0, this.count)
    this.geom.attributes.position!.needsUpdate = true
    this.geom.attributes.color!.needsUpdate = true
    this.scene.add(this.points)
  }

  update(now: number) {
    if (this.count === 0) return
    const t = (now - this.birth) / LIFE_MS
    if (t >= 1) {
      this.disposeCurrent()
      return
    }
    const dt = 1 / 60
    const drag = 0.985
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      this.velocities[i3 + 1] -= 10 * dt
      this.velocities[i3] *= drag
      this.velocities[i3 + 1] *= drag
      this.velocities[i3 + 2] *= drag
      this.positions[i3] += this.velocities[i3] * dt
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt
    }
    this.geom.attributes.position!.needsUpdate = true
    this.mat.opacity = 0.92 * (1 - t) ** 0.6
  }

  private disposeCurrent() {
    if (this.count === 0) return
    this.scene.remove(this.points)
    this.count = 0
    this.geom.setDrawRange(0, 0)
  }

  dispose() {
    this.disposeCurrent()
    this.geom.dispose()
    this.mat.dispose()
  }
}
