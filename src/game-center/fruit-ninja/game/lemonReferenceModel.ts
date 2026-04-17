import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import lemonReferenceUrl from '../assets/glb/lemon.glb?url'

const loader = new GLTFLoader()
const scratchBounds = new THREE.Box3()
const scratchCenter = new THREE.Vector3()
const scratchSize = new THREE.Vector3()

type PreparedLemonReference = {
  geometry: THREE.BufferGeometry
  material: THREE.MeshBasicMaterial
  sourceHeight: number
  sourceCutY: number
  sourceEquatorRadius: number
  sourceCapProfile: number[]
  topHalfGeometry: THREE.BufferGeometry
  bottomHalfGeometry: THREE.BufferGeometry
}

type CutVertex = {
  x: number
  y: number
  z: number
  u: number
  v: number
}

type BuiltHalfGeometry = {
  geometry: THREE.BufferGeometry
  cutProfile: number[]
  equatorRadius: number
}

let preparedReference: PreparedLemonReference | null = null
let loadStarted = false

function computeWaistCutY(geometry: THREE.BufferGeometry, sourceHeight: number): number {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  if (!pos) return 0

  const bins = 48
  const minY = -sourceHeight * 0.5
  const maxY = sourceHeight * 0.5
  const sums = Array.from({ length: bins }, () => 0)
  const counts = Array.from({ length: bins }, () => 0)

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const t = (y - minY) / Math.max(1e-5, maxY - minY)
    const slot = Math.max(0, Math.min(bins - 1, Math.floor(t * bins)))
    sums[slot] += Math.hypot(pos.getX(i), pos.getZ(i))
    counts[slot]++
  }

  let bestY = 0
  let bestScore = -Infinity
  for (let i = 0; i < bins; i++) {
    if (counts[i] === 0) continue
    const y = minY + ((i + 0.5) / bins) * (maxY - minY)
    const avgRadius = sums[i]! / counts[i]!
    // Prefer the fattest ring, but gently bias toward the center so we really cut at the waist.
    const centerBias = Math.abs(y) / sourceHeight
    const score = avgRadius - centerBias * 0.08
    if (score > bestScore) {
      bestScore = score
      bestY = y
    }
  }

  return bestY
}

function extractColorMap(material: THREE.Material | THREE.Material[]): THREE.Texture | null {
  const candidate = Array.isArray(material) ? material[0] : material
  if (!candidate) return null
  if (candidate instanceof THREE.MeshBasicMaterial) return candidate.map ?? null
  if (candidate instanceof THREE.MeshStandardMaterial) return candidate.map ?? null
  if (candidate instanceof THREE.MeshLambertMaterial) return candidate.map ?? null
  if (candidate instanceof THREE.MeshPhongMaterial) return candidate.map ?? null
  return null
}

function mergeCutProfiles(top: number[], bottom: number[], fallbackRadius: number): number[] {
  const segments = Math.max(top.length, bottom.length)
  const merged = Array.from({ length: segments }, (_, i) => Math.max(top[i] ?? 0, bottom[i] ?? 0))
  return fillAndSmoothProfile(merged, fallbackRadius)
}

function computeCutProfileFromPoints(
  points: Array<{ x: number; z: number }>,
  fallbackRadius: number,
  segments = 48,
): number[] {
  const profile = Array.from({ length: segments }, () => 0)
  if (points.length === 0) return Array.from({ length: segments }, () => fallbackRadius)

  for (const point of points) {
    const angle = Math.atan2(point.z, point.x)
    const normalized = angle >= 0 ? angle : angle + Math.PI * 2
    const slot = Math.min(segments - 1, Math.floor((normalized / (Math.PI * 2)) * segments))
    profile[slot] = Math.max(profile[slot]!, Math.hypot(point.x, point.z))
  }

  return fillAndSmoothProfile(profile, fallbackRadius)
}

function fillAndSmoothProfile(profile: number[], fallbackRadius: number): number[] {
  const segments = profile.length
  for (let i = 0; i < segments; i++) {
    if (profile[i]! > 1e-4) continue
    let sum = 0
    let count = 0
    for (let offset = 1; offset <= 3; offset++) {
      const left = profile[(i - offset + segments) % segments]!
      const right = profile[(i + offset) % segments]!
      if (left > 1e-4) {
        sum += left
        count++
      }
      if (right > 1e-4) {
        sum += right
        count++
      }
    }
    profile[i] = count > 0 ? sum / count : fallbackRadius
  }

  const smoothed = profile.map((_, i) => {
    const prev = profile[(i - 1 + segments) % segments]!
    const curr = profile[i]!
    const next = profile[(i + 1) % segments]!
    return (prev + curr * 2 + next) / 4
  })

  return smoothed.map((r) => Math.max(r, fallbackRadius * 0.82))
}

function readCutVertex(
  pos: THREE.BufferAttribute,
  uv: THREE.BufferAttribute | undefined,
  index: number,
): CutVertex {
  return {
    x: pos.getX(index),
    y: pos.getY(index),
    z: pos.getZ(index),
    u: uv ? uv.getX(index) : 0,
    v: uv ? uv.getY(index) : 0,
  }
}

function interpolateCutVertex(a: CutVertex, b: CutVertex, cutY: number): CutVertex {
  const dy = b.y - a.y
  const t = Math.abs(dy) < 1e-8 ? 0 : (cutY - a.y) / dy
  return {
    x: THREE.MathUtils.lerp(a.x, b.x, t),
    y: cutY,
    z: THREE.MathUtils.lerp(a.z, b.z, t),
    u: THREE.MathUtils.lerp(a.u, b.u, t),
    v: THREE.MathUtils.lerp(a.v, b.v, t),
  }
}

function clipTriangleToPlane(
  triangle: [CutVertex, CutVertex, CutVertex],
  keepTop: boolean,
  cutY: number,
): CutVertex[] {
  const kept: CutVertex[] = []

  for (let i = 0; i < triangle.length; i++) {
    const current = triangle[i]!
    const previous = triangle[(i + triangle.length - 1) % triangle.length]!
    const currentInside = keepTop ? current.y >= cutY : current.y <= cutY
    const previousInside = keepTop ? previous.y >= cutY : previous.y <= cutY

    if (currentInside !== previousInside) {
      kept.push(interpolateCutVertex(previous, current, cutY))
    }
    if (currentInside) {
      kept.push(current)
    }
  }

  return kept
}

function buildSlicedHalfGeometry(
  baseGeometry: THREE.BufferGeometry,
  half: 'top' | 'bottom',
  cutY: number,
  sourceHeight: number,
): BuiltHalfGeometry {
  const source = baseGeometry.toNonIndexed()
  const sourcePos = source.getAttribute('position') as THREE.BufferAttribute
  const sourceUv = source.getAttribute('uv') as THREE.BufferAttribute | undefined
  const keepTop = half === 'top'

  const positions: number[] = []
  const uvs: number[] = []
  const cutPoints: Array<{ x: number; z: number }> = []

  for (let i = 0; i < sourcePos.count; i += 3) {
    const triangle: [CutVertex, CutVertex, CutVertex] = [
      readCutVertex(sourcePos, sourceUv, i),
      readCutVertex(sourcePos, sourceUv, i + 1),
      readCutVertex(sourcePos, sourceUv, i + 2),
    ]
    const clipped = clipTriangleToPlane(triangle, keepTop, cutY)
    if (clipped.length < 3) continue

    for (const vertex of clipped) {
      if (Math.abs(vertex.y - cutY) < 1e-5) {
        cutPoints.push({ x: vertex.x, z: vertex.z })
      }
    }

    for (let fan = 1; fan < clipped.length - 1; fan++) {
      const verts = keepTop
        ? [clipped[0]!, clipped[fan]!, clipped[fan + 1]!]
        : [clipped[0]!, clipped[fan + 1]!, clipped[fan]!]
      for (const vertex of verts) {
        positions.push(
          vertex.x,
          keepTop ? vertex.y - cutY : cutY - vertex.y,
          vertex.z,
        )
        uvs.push(vertex.u, vertex.v)
      }
    }
  }

  source.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (uvs.length > 0 && sourceUv) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()

  const equatorRadius = cutPoints.reduce((max, point) => Math.max(max, Math.hypot(point.x, point.z)), 0)
  return {
    geometry,
    cutProfile: computeCutProfileFromPoints(cutPoints, equatorRadius || sourceHeight * 0.28),
    equatorRadius,
  }
}

function prepareReferenceMesh(sourceMesh: THREE.Mesh): PreparedLemonReference | null {
  const geometry = sourceMesh.geometry?.clone()
  if (!geometry) return null

  geometry.computeBoundingBox()
  if (!geometry.boundingBox) return null

  scratchBounds.copy(geometry.boundingBox)
  scratchBounds.getCenter(scratchCenter)
  scratchBounds.getSize(scratchSize)
  geometry.translate(-scratchCenter.x, -scratchCenter.y, -scratchCenter.z)
  // The reference lemon's long axis is along Z; rotate it upright so our Y-plane
  // slicing becomes a horizontal waist cut rather than a longitudinal split.
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  if (!geometry.boundingBox) return null
  scratchBounds.copy(geometry.boundingBox)
  scratchBounds.getSize(scratchSize)
  geometry.computeVertexNormals()

  const sourceCutY = computeWaistCutY(geometry, scratchSize.y)
  const topHalf = buildSlicedHalfGeometry(geometry, 'top', sourceCutY, scratchSize.y)
  const bottomHalf = buildSlicedHalfGeometry(geometry, 'bottom', sourceCutY, scratchSize.y)
  const sourceEquatorRadius = Math.max(topHalf.equatorRadius, bottomHalf.equatorRadius, 0.28)
  const sourceCapProfile = mergeCutProfiles(topHalf.cutProfile, bottomHalf.cutProfile, sourceEquatorRadius)

  const map = extractColorMap(sourceMesh.material)
  const colorMap = map ? map.clone() : null
  if (colorMap) {
    colorMap.colorSpace = THREE.SRGBColorSpace
    colorMap.anisotropy = 8
    colorMap.needsUpdate = true
  }

  return {
    geometry,
    material: new THREE.MeshBasicMaterial({
      map: colorMap ?? undefined,
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.08,
    }),
    sourceHeight: Math.max(1e-4, scratchSize.y),
    sourceCutY,
    sourceEquatorRadius,
    sourceCapProfile,
    topHalfGeometry: topHalf.geometry,
    bottomHalfGeometry: bottomHalf.geometry,
  }
}

export function primeLemonReferenceModel() {
  if (preparedReference || loadStarted) return
  loadStarted = true

  loader.load(
    lemonReferenceUrl,
    (gltf) => {
      let sourceMesh: THREE.Mesh | null = null
      gltf.scene.traverse((child) => {
        if (!sourceMesh && child instanceof THREE.Mesh) sourceMesh = child
      })

      if (!sourceMesh) {
        console.warn('[fruit-ninja] lemon reference GLB had no mesh')
        return
      }

      preparedReference = prepareReferenceMesh(sourceMesh)
      if (!preparedReference) {
        console.warn('[fruit-ninja] failed to prepare lemon reference mesh')
      }
    },
    undefined,
    (error) => {
      console.warn('[fruit-ninja] failed to load lemon reference GLB', error)
    },
  )
}

export function createLemonReferenceMesh(radius: number): THREE.Group | null {
  if (!preparedReference) return null

  const root = new THREE.Group()
  const mesh = new THREE.Mesh(preparedReference.geometry, preparedReference.material)
  const targetHeight = radius * 1.88
  const scale = targetHeight / preparedReference.sourceHeight

  mesh.scale.setScalar(scale)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.sharedPool = true
  root.add(mesh)
  return root
}

export function createLemonReferenceHalfMesh(
  radius: number,
  half: 'top' | 'bottom',
): { mesh: THREE.Mesh; capRadius: number; cutOffsetY: number } | null {
  if (!preparedReference) return null

  const geometry = half === 'top' ? preparedReference.topHalfGeometry : preparedReference.bottomHalfGeometry
  const mesh = new THREE.Mesh(geometry, preparedReference.material)
  const targetHeight = radius * 1.88
  const scale = targetHeight / preparedReference.sourceHeight

  mesh.scale.setScalar(scale)
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.userData.sharedPool = true
  mesh.renderOrder = 2

  return {
    mesh,
    capRadius: preparedReference.sourceEquatorRadius * scale * 0.99,
    cutOffsetY: preparedReference.sourceCutY * scale,
  }
}

export function createLemonReferenceCapGeometry(radius: number): THREE.ShapeGeometry | null {
  if (!preparedReference) return null

  const targetHeight = radius * 1.88
  const scale = targetHeight / preparedReference.sourceHeight
  const profile = preparedReference.sourceCapProfile
  const shape = new THREE.Shape()
  let maxRadius = 0

  profile.forEach((baseRadius, index) => {
    const angle = (index / profile.length) * Math.PI * 2
    const r = baseRadius * scale * 1.01
    maxRadius = Math.max(maxRadius, r)
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (index === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  })
  shape.closePath()

  const geometry = new THREE.ShapeGeometry(shape)
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const uv = new Float32Array(position.count * 2)
  const invRadius = maxRadius > 1e-5 ? 1 / (maxRadius * 2) : 1

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    uv[i * 2] = x * invRadius + 0.5
    uv[i * 2 + 1] = y * invRadius + 0.5
  }

  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.computeBoundingBox()
  return geometry
}

if (typeof window !== 'undefined') {
  primeLemonReferenceModel()
}
