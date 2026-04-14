import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as THREE from 'three'
import { createFruitHalfMesh } from './game/fruitHalfMesh'
import { FRUIT_RADIUS, BOMB_RADIUS } from './game/entityParams'
import type { FruitArchetype } from './game/spawn'
import { getBombBodyMaterial } from './game/bombSkin'
import { getBombHalfPolyGeometry, BOMB_MAX_XZ } from './game/bombPolyGeometry'
import { addDefaultLights, createCamera, createRenderer, createScene, fitRendererToContainer } from './three/engine'

const FRUIT_KINDS: { kind: FruitArchetype; skin: number; flesh: number }[] = [
  { kind: 'watermelon', skin: 0x287a38, flesh: 0xff2a4a },
  { kind: 'apple', skin: 0xcc2228, flesh: 0xfff5f0 },
  { kind: 'banana', skin: 0xf0c830, flesh: 0xfff8dc },
  { kind: 'lemon', skin: 0xf5e050, flesh: 0xfffff0 },
  { kind: 'lime', skin: 0x4a8f2e, flesh: 0xc8f0a0 },
  { kind: 'mango', skin: 0xff8820, flesh: 0xffcc70 },
  { kind: 'pineapple', skin: 0xd4a020, flesh: 0xfff5d0 },
  { kind: 'coconut', skin: 0x5a4030, flesh: 0xf8f4ea },
  { kind: 'strawberry', skin: 0xe8202a, flesh: 0xffa8b8 },
  { kind: 'kiwi', skin: 0x7a5a1a, flesh: 0xb8e060 },
  { kind: 'orange', skin: 0xff8c00, flesh: 0xffaa44 },
  { kind: 'plum', skin: 0x6a2078, flesh: 0xe0c0e0 },
  { kind: 'pear', skin: 0xb8c840, flesh: 0xfffff0 },
  { kind: 'peach', skin: 0xff9a6a, flesh: 0xffe0c8 },
  { kind: 'passionfruit', skin: 0x6b3828, flesh: 0xf0d890 },
  { kind: 'cherry', skin: 0xb81028, flesh: 0xff2848 },
]

const COLS = 4
const CELL_W = 3.2
const CELL_H = 4.0
const GAP_FACTOR = 0.7 // each half offset = radius * GAP_FACTOR along Y

const VALID_FRUIT = new Set(FRUIT_KINDS.map((x) => x.kind))

function createTextSprite(text: string, isBomb: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!

  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillText(text, 130, 34)

  ctx.fillStyle = isBomb ? '#f87171' : 'rgba(255,255,255,0.9)'
  ctx.fillText(text, 128, 32)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2.4, 0.6, 1)
  return sprite
}

function createBombHalfMesh(
  radius: number,
  outwardNormal: THREE.Vector3,
): THREE.Group {
  const g = new THREE.Group()
  const n = outwardNormal.clone().normalize()

  const curved = new THREE.Mesh(
    getBombHalfPolyGeometry(radius),
    getBombBodyMaterial(),
  )
  curved.userData.sharedPool = true
  g.add(curved)

  // Interior cap: dark with faint red ring
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#1a1a22'
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = 'rgba(200,40,20,0.4)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const capMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a22,
    map: tex,
    toneMapped: false,
    side: THREE.DoubleSide,
  })
  const capGeo = new THREE.CircleGeometry(radius * BOMB_MAX_XZ * 1.01, 20)
  const cap = new THREE.Mesh(capGeo, capMat)
  cap.rotation.x = -Math.PI / 2
  cap.position.y = -0.0015
  cap.userData.sharedPool = true
  g.add(cap)

  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  return g
}

function createSlicedFruitGroup(kind: FruitArchetype, skin: number, flesh: number): THREE.Group {
  const parent = new THREE.Group()
  const radius = FRUIT_RADIUS[kind]
  const gap = radius * GAP_FACTOR
  const skinColor = new THREE.Color(skin)
  const fleshColor = new THREE.Color(flesh)

  // Top half: outward normal points up
  const topHalf = createFruitHalfMesh(radius, new THREE.Vector3(0, 1, 0), skinColor, fleshColor, kind, -1)
  topHalf.position.y = gap
  parent.add(topHalf)

  // Bottom half: outward normal points down
  const bottomHalf = createFruitHalfMesh(radius, new THREE.Vector3(0, -1, 0), skinColor, fleshColor, kind, 1)
  bottomHalf.position.y = -gap
  parent.add(bottomHalf)

  return parent
}

function createSlicedBombGroup(): THREE.Group {
  const parent = new THREE.Group()
  const radius = BOMB_RADIUS
  const gap = radius * GAP_FACTOR

  const topHalf = createBombHalfMesh(radius, new THREE.Vector3(0, 1, 0))
  topHalf.position.y = gap
  parent.add(topHalf)

  const bottomHalf = createBombHalfMesh(radius, new THREE.Vector3(0, -1, 0))
  bottomHalf.position.y = -gap
  parent.add(bottomHalf)

  return parent
}

export default function FruitGallerySlicedView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()

  const soloKind = useMemo((): FruitArchetype | 'bomb' | null => {
    const raw = searchParams.get('fruit')?.trim().toLowerCase()
    if (!raw) return null
    if (raw === 'bomb') return 'bomb'
    if (VALID_FRUIT.has(raw as FruitArchetype)) return raw as FruitArchetype
    return null
  }, [searchParams])

  const staticMode = searchParams.get('static') === '1'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.setAttribute('data-testid', 'fruit-gallery-sliced-canvas')
    container.appendChild(canvas)

    const scene = createScene()
    scene.background = new THREE.Color(0x000000)
    addDefaultLights(scene)

    const { clientWidth, clientHeight } = container
    const camera = createCamera(clientWidth / Math.max(1, clientHeight))

    const renderer = createRenderer(canvas)
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1
    fitRendererToContainer(renderer, camera, clientWidth, clientHeight)

    const gridRoot = new THREE.Group()
    scene.add(gridRoot)

    const groups: THREE.Group[] = []
    const allNames: string[] = []

    const centerY = 0.55

    if (soloKind) {
      if (soloKind === 'bomb') {
        const mesh = createSlicedBombGroup()
        mesh.position.set(0, centerY, 0)
        gridRoot.add(mesh)
        groups.push(mesh)
        allNames.push('bomb')
      } else {
        const entry = FRUIT_KINDS.find((x) => x.kind === soloKind)
        const skin = entry?.skin ?? 0xffffff
        const flesh = entry?.flesh ?? 0xffffff
        const mesh = createSlicedFruitGroup(soloKind, skin, flesh)
        mesh.position.set(0, centerY, 0)
        gridRoot.add(mesh)
        groups.push(mesh)
        allNames.push(soloKind)
      }
    } else {
      const total = FRUIT_KINDS.length + 1 // +1 for bomb
      const rows = Math.ceil(total / COLS)
      const totalW = COLS * CELL_W
      const totalH = rows * CELL_H

      for (let i = 0; i < FRUIT_KINDS.length; i++) {
        const { kind, skin, flesh } = FRUIT_KINDS[i]!
        const mesh = createSlicedFruitGroup(kind, skin, flesh)
        const col = i % COLS
        const row = Math.floor(i / COLS)
        mesh.position.set(
          -totalW / 2 + col * CELL_W + CELL_W / 2,
          centerY + (totalH / 2 - row * CELL_H - CELL_H / 2),
          0,
        )
        gridRoot.add(mesh)
        groups.push(mesh)
        allNames.push(kind)
      }

      const bombIdx = FRUIT_KINDS.length
      const bombCol = bombIdx % COLS
      const bombRow = Math.floor(bombIdx / COLS)
      const bombMesh = createSlicedBombGroup()
      bombMesh.position.set(
        -totalW / 2 + bombCol * CELL_W + CELL_W / 2,
        centerY + (totalH / 2 - bombRow * CELL_H - CELL_H / 2),
        0,
      )
      gridRoot.add(bombMesh)
      groups.push(bombMesh)
      allNames.push('bomb')

      const labelOffset = CELL_H * 0.40
      for (let i = 0; i < groups.length; i++) {
        const isBomb = i === FRUIT_KINDS.length
        const sprite = createTextSprite(allNames[i]!, isBomb)
        sprite.position.set(
          groups[i]!.position.x,
          groups[i]!.position.y - labelOffset,
          0,
        )
        gridRoot.add(sprite)
      }

      const gridPoints: number[] = []
      const lineColor = 0x8aa4ff

      for (let r = 0; r <= rows; r++) {
        const y = centerY + (totalH / 2 - r * CELL_H)
        gridPoints.push(-totalW / 2, y, 0.01, totalW / 2, y, 0.01)
      }
      for (let c = 0; c <= COLS; c++) {
        const x = -totalW / 2 + c * CELL_W
        gridPoints.push(x, centerY + totalH / 2, 0.01, x, centerY - totalH / 2, 0.01)
      }

      const gridGeo = new THREE.BufferGeometry()
      gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3))
      const gridMat = new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: 0.82 })
      gridRoot.add(new THREE.LineSegments(gridGeo, gridMat))
    }

    const scratchBox = new THREE.Box3()
    const scratchSize = new THREE.Vector3()
    const scratchCenter = new THREE.Vector3()
    const fovRad = (camera.fov * Math.PI) / 180
    const fitCamera = (aspect: number) => {
      gridRoot.updateWorldMatrix(true, true)
      scratchBox.setFromObject(gridRoot)
      scratchBox.getSize(scratchSize)
      scratchBox.getCenter(scratchCenter)

      const sizeX = Math.max(0.01, scratchSize.x)
      const sizeY = Math.max(0.01, scratchSize.y)
      const margin = 1.18

      const halfY = (sizeY * 0.5) * margin
      const halfX = (sizeX * 0.5) * margin

      const fitZForH = halfY / Math.tan(fovRad / 2)
      const fitZForW = halfX / (Math.tan(fovRad / 2) * Math.max(0.01, aspect))
      const fitZ = Math.max(fitZForH, fitZForW)

      camera.position.set(scratchCenter.x, scratchCenter.y, fitZ + 2.2)
      camera.lookAt(scratchCenter.x, scratchCenter.y, 0)
    }
    fitCamera(clientWidth / Math.max(1, clientHeight))

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      fitRendererToContainer(renderer, camera, w, h)
      fitCamera(w / Math.max(1, h))
    }

    resize()

    const ro = new ResizeObserver(() => resize())
    ro.observe(container)

    let raf: number
    let disposed = false
    let prevT = -1

    const spinAxis = new THREE.Vector3(0, 1, 0.55).normalize()
    const speed = 0.0012 // rad per ms

    const animate = (t: number) => {
      if (disposed) return
      raf = requestAnimationFrame(animate)
      if (prevT < 0) {
        prevT = t
        return
      }
      const dt = t - prevT
      prevT = t
      const delta = staticMode ? 0 : dt * speed
      for (const g of groups) {
        g.rotateOnAxis(spinAxis, delta)
      }
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      canvas.remove()
    }
  }, [soloKind, staticMode])

  return (
    <div className="fixed inset-0 bg-black p-4">
      <div className="grid h-full w-full place-items-center">
        <div className="relative h-[min(900px,calc(100dvh-2rem))] w-[min(1200px,calc(100vw-2rem))]">
          <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
        </div>
      </div>
    </div>
  )
}
