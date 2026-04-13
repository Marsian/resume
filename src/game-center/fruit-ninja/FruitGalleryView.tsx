import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as THREE from 'three'
import { createBombMesh, createFruitMesh } from './game/meshes'
import { FRUIT_RADIUS } from './game/entityParams'
import type { FruitArchetype } from './game/spawn'
import { addDefaultLights, createCamera, createRenderer, createScene, fitRendererToContainer } from './three/engine'

const FRUIT_KINDS: { kind: FruitArchetype }[] = [
  { kind: 'watermelon' },
  { kind: 'apple' },
  { kind: 'banana' },
  { kind: 'lemon' },
  { kind: 'lime' },
  { kind: 'mango' },
  { kind: 'pineapple' },
  { kind: 'coconut' },
  { kind: 'strawberry' },
  { kind: 'kiwi' },
  { kind: 'orange' },
  { kind: 'plum' },
  { kind: 'pear' },
  { kind: 'peach' },
  { kind: 'passionfruit' },
  { kind: 'cherry' },
]

const SKIN_BY_KIND: Record<FruitArchetype, number> = {
  watermelon: 0x287a38,
  apple: 0xcc2228,
  banana: 0xf0c830,
  lemon: 0xf5e050,
  lime: 0x4a8f2e,
  mango: 0xff8820,
  pineapple: 0xd4a020,
  coconut: 0x5a4030,
  strawberry: 0xe8202a,
  kiwi: 0x7a5a1a,
  orange: 0xff8c00,
  plum: 0x6a2078,
  pear: 0xb8c840,
  peach: 0xff9a6a,
  passionfruit: 0x6b3828,
  cherry: 0xa81028,
}

const COLS = 4

const VALID_FRUIT = new Set(FRUIT_KINDS.map((x) => x.kind))

function createTextSprite(text: string, isBomb: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!

  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Shadow for readability
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

export default function FruitGalleryView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()

  const soloKind = useMemo((): FruitArchetype | null => {
    const raw = searchParams.get('fruit')?.trim().toLowerCase()
    if (!raw || !VALID_FRUIT.has(raw as FruitArchetype)) return null
    return raw as FruitArchetype
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
    canvas.setAttribute('data-testid', 'fruit-gallery-canvas')
    container.appendChild(canvas)

    const scene = createScene()
    // Gallery verification view: use solid black background to make color/shape comparison easier.
    scene.background = new THREE.Color(0x000000)
    addDefaultLights(scene)

    const { clientWidth, clientHeight } = container
    const camera = createCamera(clientWidth / Math.max(1, clientHeight))

    const renderer = createRenderer(canvas)
    // Gallery / wiki comparison: avoid ACES crushing saturated fruit albedos in captures.
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1
    fitRendererToContainer(renderer, camera, clientWidth, clientHeight)

    const gridRoot = new THREE.Group()
    scene.add(gridRoot)

    const groups: THREE.Group[] = []
    const allNames: string[] = []

    const centerY = 0.55

    if (soloKind) {
      const radius = FRUIT_RADIUS[soloKind]
      const mesh = createFruitMesh(radius, soloKind, SKIN_BY_KIND[soloKind])
      mesh.position.set(0, centerY, 0)
      gridRoot.add(mesh)
      groups.push(mesh)
      allNames.push(soloKind)
    } else {
      const rows = Math.ceil((FRUIT_KINDS.length + 1) / COLS) // +1 for bomb
      const cellW = 3.2
      const cellH = 3.2
      const totalW = COLS * cellW
      const totalH = rows * cellH

      for (let i = 0; i < FRUIT_KINDS.length; i++) {
        const { kind } = FRUIT_KINDS[i]!
        const radius = FRUIT_RADIUS[kind]
        const mesh = createFruitMesh(radius, kind, SKIN_BY_KIND[kind])
        const col = i % COLS
        const row = Math.floor(i / COLS)
        mesh.position.set(
          -totalW / 2 + col * cellW + cellW / 2,
          centerY + (totalH / 2 - row * cellH - cellH / 2),
          0,
        )
        gridRoot.add(mesh)
        groups.push(mesh)
        allNames.push(kind)
      }

      const bombMesh = createBombMesh(0.5)
      const bombIdx = FRUIT_KINDS.length
      const bombCol = bombIdx % COLS
      const bombRow = Math.floor(bombIdx / COLS)
      bombMesh.position.set(
        -totalW / 2 + bombCol * cellW + cellW / 2,
        centerY + (totalH / 2 - bombRow * cellH - cellH / 2),
        0,
      )
      gridRoot.add(bombMesh)
      groups.push(bombMesh)
      allNames.push('bomb')

      const labelOffset = cellH * 0.38
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
        const y = centerY + (totalH / 2 - r * cellH)
        gridPoints.push(-totalW / 2, y, 0.01, totalW / 2, y, 0.01)
      }
      for (let c = 0; c <= COLS; c++) {
        const x = -totalW / 2 + c * cellW
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
