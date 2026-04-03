import * as THREE from 'three'

export type ThreeContext = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
}

const DPR_CAP = 2

function createWoodGrainTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 512, 512)
  grd.addColorStop(0, '#4a3020')
  grd.addColorStop(0.35, '#6b4832')
  grd.addColorStop(0.55, '#5a3d28')
  grd.addColorStop(1, '#3d2618')
  g.fillStyle = grd
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(20,12,8,${0.04 + Math.random() * 0.08})`
    g.lineWidth = 1 + Math.random() * 2
    g.beginPath()
    const x = Math.random() * 512
    g.moveTo(x, 0)
    g.bezierCurveTo(x + 30, 170, x - 20, 340, x + 10, 512)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2.2, 2.2)
  return tex
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene()
  const wood = createWoodGrainTexture()
  scene.background = wood
  scene.fog = new THREE.FogExp2(0x2a1810, 0.045)
  return scene
}

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 120)
  camera.position.set(0, 2.05, 11.4)
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
  key.shadow.mapSize.set(2048, 2048)
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

/** Vertical backdrop panel — reinforces “dojo wall” depth */
export function addDojoBackdrop(scene: THREE.Scene): THREE.Mesh {
  const wood = createWoodGrainTexture()
  wood.repeat.set(1.4, 1.4)
  const geo = new THREE.PlaneGeometry(32, 18)
  const mat = new THREE.MeshStandardMaterial({
    map: wood,
    roughness: 0.85,
    metalness: 0,
    color: 0xcccccc,
  })
  const wall = new THREE.Mesh(geo, mat)
  wall.position.set(0, 2.5, -9.5)
  wall.receiveShadow = true
  scene.add(wall)
  return wall
}

export function addStage(scene: THREE.Scene): THREE.Mesh {
  const matTex = (() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#c9b896'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(90,70,50,${0.02 + Math.random() * 0.04})`
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(8, 8)
    return t
  })()

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(17, 72),
    new THREE.MeshStandardMaterial({
      map: matTex,
      color: 0xe8dcc4,
      roughness: 0.88,
      metalness: 0,
    }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -5.15
  ground.receiveShadow = true
  scene.add(ground)

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(5.5, 16.5, 64),
    new THREE.MeshStandardMaterial({
      color: 0x5c3d26,
      roughness: 0.75,
      metalness: 0.08,
      transparent: true,
      opacity: 0.92,
    }),
  )
  rim.rotation.x = -Math.PI / 2
  rim.position.y = -5.12
  rim.receiveShadow = true
  scene.add(rim)

  return ground
}
