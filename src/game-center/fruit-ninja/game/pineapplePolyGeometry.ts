import * as THREE from 'three'

const BODY_RADIUS_RATIO = 0.55
const BODY_HEIGHT_RATIO = BODY_RADIUS_RATIO * 1.98
const TOP_RADIUS_RATIO = BODY_RADIUS_RATIO * 0.81
const BOTTOM_RADIUS_RATIO = BODY_RADIUS_RATIO * 0.83
const RADIAL_SEGMENTS = 28
const HEIGHT_SEGMENTS = 12

type PineappleHalf = 'top' | 'bottom'

const halfCache = new Map<string, THREE.BufferGeometry>()

function deformPineappleCylinderGeometry(
  geometry: THREE.BufferGeometry,
  radius: number,
): THREE.BufferGeometry {
  const bodyRadius = radius * BODY_RADIUS_RATIO
  const bodyHeight = radius * BODY_HEIGHT_RATIO
  const pos = geometry.attributes.position as THREE.BufferAttribute

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const nY = (y + bodyHeight * 0.5) / bodyHeight // 0=bottom, 1=top

    const bulge = 1.0 + 0.08 * Math.sin(nY * Math.PI)
    const topTaper = 1.0 - 0.05 * nY * nY
    const distFromCenter = Math.sqrt(x * x + z * z)
    const edgeFactor = bodyRadius > 0 ? distFromCenter / bodyRadius : 0
    let radScale = bulge * topTaper

    const capZone = 0.07
    if (nY < capZone || nY > 1.0 - capZone) {
      const poleN = nY < 0.5 ? nY / capZone : (1.0 - nY) / capZone
      radScale *= 1.0 - (1.0 - poleN) * edgeFactor * 0.17
    }

    pos.setX(i, x * radScale)
    pos.setY(i, y)
    pos.setZ(i, z * radScale)
  }

  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Source of truth for the pineapple body shape.
 *
 * This intentionally mirrors the original whole-pineapple CylinderGeometry setup:
 * same radii, height, segments, and vertex deformation. Keep whole and sliced
 * pineapple bodies going through this helper so their shapes do not drift apart.
 */
export function createPineappleBodyGeometry(radius: number): THREE.BufferGeometry {
  const bodyHeight = radius * BODY_HEIGHT_RATIO
  const geometry = new THREE.CylinderGeometry(
    radius * TOP_RADIUS_RATIO,
    radius * BOTTOM_RADIUS_RATIO,
    bodyHeight,
    RADIAL_SEGMENTS,
    HEIGHT_SEGMENTS,
    false,
  )
  return deformPineappleCylinderGeometry(geometry, radius)
}

function buildPineappleSlicedHalfGeometry(radius: number, half: PineappleHalf): THREE.BufferGeometry {
  const base = createPineappleBodyGeometry(radius)
  const source = base.toNonIndexed()
  base.dispose()
  const sourcePos = source.getAttribute('position') as THREE.BufferAttribute
  const sourceUv = source.getAttribute('uv') as THREE.BufferAttribute | undefined
  const keepTop = half === 'top'
  const eps = 1e-6

  const positions: number[] = []
  const uvs: number[] = []

  for (let i = 0; i < sourcePos.count; i += 3) {
    const y0 = sourcePos.getY(i)
    const y1 = sourcePos.getY(i + 1)
    const y2 = sourcePos.getY(i + 2)
    const keep =
      keepTop
        ? y0 >= -eps && y1 >= -eps && y2 >= -eps
        : y0 <= eps && y1 <= eps && y2 <= eps

    if (!keep) continue

    const order = keepTop ? [0, 1, 2] : [2, 1, 0]
    for (const offset of order) {
      const idx = i + offset
      positions.push(
        sourcePos.getX(idx),
        keepTop ? sourcePos.getY(idx) : -sourcePos.getY(idx),
        sourcePos.getZ(idx),
      )
      if (sourceUv) {
        uvs.push(sourceUv.getX(idx), sourceUv.getY(idx))
      }
    }
  }

  source.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (uvs.length > 0) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  }
  geometry.computeVertexNormals()
  return geometry
}

export function getPineappleBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  return createPineappleBodyGeometry(radius)
}

export function getPineappleHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  return getPineappleSlicedHalfPolyGeometry(radius, 'top')
}

export function getPineappleSlicedHalfPolyGeometry(radius: number, half: PineappleHalf): THREE.BufferGeometry {
  const key = `${radius}:${half}`
  let geometry = halfCache.get(key)
  if (!geometry) {
    geometry = buildPineappleSlicedHalfGeometry(radius, half)
    halfCache.set(key, geometry)
  }
  return geometry
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const PINEAPPLE_MAX_XZ = 0.49
