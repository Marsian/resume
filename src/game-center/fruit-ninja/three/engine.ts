import * as THREE from 'three'

export type ThreeContext = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
}

const DPR_CAP = 2

/** Pixel source drawn once; each material gets its own CanvasTexture so dispose stays safe. */
let plankCanvasSource: HTMLCanvasElement | null = null

function ensurePlankCanvas(): HTMLCanvasElement {
  if (plankCanvasSource) return plankCanvasSource
  const W = 512
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  // Vertical wood grain with only 3–5 big streaks (no horizontal plank seams).
  g.fillStyle = 'hsl(32, 40%, 43.5%)'
  g.fillRect(0, 0, W, H)

  const bigStreaks = 3 + Math.floor(Math.random() * 3) // 3..5
  const centers: number[] = []
  for (let i = 0; i < bigStreaks; i++) centers.push((i + 0.5) * (W / bigStreaks) + (Math.random() - 0.5) * 18)

  for (let x = 0; x < W; x++) {
    let influence = 0
    for (let i = 0; i < centers.length; i++) {
      const d = Math.abs(x - centers[i])
      influence += Math.exp(-(d * d) / (2 * 70 * 70))
    }
    // Modulate brightness subtly; keep it low-contrast and organic.
    const l = 43.5 + influence * 3.2 + (Math.random() - 0.5) * 0.9
    g.fillStyle = `hsl(32, 40%, ${l}%)`
    g.fillRect(x, 0, 1, H)
  }

  // Thin vertical fibers for texture, but keep them subtle.
  for (let i = 0; i < 140; i++) {
    const x0 = Math.random() * W
    const w = 0.8 + Math.random() * 1.6
    g.fillStyle = `rgba(40,28,18,${0.03 + Math.random() * 0.05})`
    g.fillRect(x0, 0, w, H)
  }

  // A few knots/imperfections.
  for (let k = 0; k < 8; k++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const r = 2.2 + Math.random() * 4.2
    g.fillStyle = 'rgba(35, 28, 22, 0.35)'
    g.beginPath()
    g.ellipse(x, y, r * (1.2 + Math.random()), r * (0.7 + Math.random() * 0.5), Math.random(), 0, Math.PI * 2)
    g.fill()
  }

  // Gentle vignette to keep edges from feeling too flat.
  const grd = g.createRadialGradient(W * 0.5, H * 0.55, W * 0.1, W * 0.5, H * 0.55, W * 0.8)
  grd.addColorStop(0, 'rgba(0,0,0,0)')
  grd.addColorStop(1, 'rgba(0,0,0,0.12)')
  g.fillStyle = grd
  g.fillRect(0, 0, W, H)

  plankCanvasSource = c
  return c
}

/** New texture instance (shared canvas pixels); set repeat on the returned texture. */
export function createPlankWoodTexture(): THREE.CanvasTexture {
  const c = ensurePlankCanvas()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene()
  // Solid fill only — plank texture lives on the single backdrop wall (see addDojoBackdrop).
  // Using the same texture on scene.background + a lit wall caused a visible “two-layer” seam.
  scene.background = new THREE.Color(0x2a1810)
  return scene
}

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 120)
  // Level the camera (no pitch) so vertical wood grain stays perfectly vertical on screen.
  // Keep the view centered near the gameplay plane at y=0.55.
  camera.position.set(0, 0.55, 11.4)
  camera.lookAt(0, 0.55, 0)
  return camera
}

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
  renderer.setPixelRatio(dpr)
  return renderer
}

export function fitRendererToContainer(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
) {
  camera.aspect = width / Math.max(1, height)
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}

export function addDefaultLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0xffe8d0, 0x2a1810, 0.62)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xfff6ee, 1.22)
  key.position.set(4.5, 15, 6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 42
  key.shadow.camera.left = -16
  key.shadow.camera.right = 16
  key.shadow.camera.top = 16
  key.shadow.camera.bottom = -16
  scene.add(key)

  const rim = new THREE.DirectionalLight(0xffaa77, 0.28)
  rim.position.set(-7, 5, -5)
  scene.add(rim)
}

/** Single full-frame wooden wall — only visible wood surface in the scene (no floor). */
export function addDojoBackdrop(scene: THREE.Scene): THREE.Mesh {
  const planks = createPlankWoodTexture()
  planks.repeat.set(3.2, 2.4)
  const geo = new THREE.PlaneGeometry(44, 28)
  // Basic material: lit StandardMaterial picks up hemi + directional and reads as a dark “upper”
  // band vs lighter “lower” band on this large vertical plane. Unlit keeps one consistent wood read.
  const mat = new THREE.MeshBasicMaterial({
    map: planks,
    color: 0xffffff,
  })
  const wall = new THREE.Mesh(geo, mat)
  wall.position.set(0, 2.2, -9.5)
  wall.receiveShadow = true
  scene.add(wall)
  return wall
}
