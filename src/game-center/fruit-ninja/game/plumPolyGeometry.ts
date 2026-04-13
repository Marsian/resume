import * as THREE from 'three'

/**
 * Plum-shaped polyhedron: nearly round with slight height > width,
 * a shallow stem cavity at the top and a gentle indent at the bottom.
 *
 * Wiki plum is close to spherical — just slightly taller than wide —
 * with a small depression where the stem attaches and a subtle
 * bottom indent. The widest point is at or just below the equator.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem area), v = 1 → bottom pole.
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/**
 * Plum profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 */
function plumDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: nearly spherical, just slightly taller ---
  const scaleXZ = 0.96
  const scaleY = 1.04

  // --- Equatorial bulge: widest at or just below center ---
  const bulgeCenter = -0.05
  const bulgeWidth = 0.50
  const bulgeAmount = 0.03
  const bulge = bulgeAmount * Math.exp(-((h - bulgeCenter) * (h - bulgeCenter)) / (2 * bulgeWidth * bulgeWidth))
  const totalXZ = scaleXZ + bulge

  x *= totalXZ
  z *= totalXZ
  y *= scaleY

  // --- Top indent: stem cavity — shallow depression ---
  let topDR = 1.0
  let topDY = 0
  if (h > 0.82) {
    const t = (h - 0.82) / 0.18
    topDR = 1.0 - 0.38 * t * t
    topDY = -0.10 * t * t * radius
  }

  // --- Bottom indent: shallow, similar to apple ---
  let bottomDR = 1.0
  let bottomDY = 0
  if (h < -0.84) {
    const t = (-0.84 - h) / 0.16
    bottomDR = 1.0 - 0.30 * t * t
    bottomDY = 0.08 * t * t * radius
  }

  x *= topDR * bottomDR
  z *= topDR * bottomDR
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the top (stem cavity) and bottom (indent).
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries (in theta)
  const topZoneEnd = Math.acos(0.82)       // ~0.608 rad (top pole / stem)
  const bottomZoneStart = Math.acos(-0.84)  // ~2.526 rad (bottom indent)

  const topRings = 18
  const midRings = 28
  const bottomRings = 14

  const allThetas: number[] = []

  // Top zone
  for (let i = 0; i <= topRings; i++) {
    allThetas.push((i / topRings) * topZoneEnd)
  }
  // Middle zone
  for (let i = 1; i <= midRings; i++) {
    allThetas.push(topZoneEnd + (i / midRings) * (bottomZoneStart - topZoneEnd))
  }
  // Bottom zone
  for (let i = 1; i <= bottomRings; i++) {
    allThetas.push(bottomZoneStart + (i / bottomRings) * (Math.PI - bottomZoneStart))
  }

  // Filter to requested range
  const steps: number[] = [thetaStart]
  for (const t of allThetas) {
    if (t > thetaStart + 1e-6 && t < thetaEnd - 1e-6) {
      steps.push(t)
    }
  }
  steps.push(thetaEnd)

  return steps
}

function buildPlumCustomGeometry(
  radius: number,
  lonSegments: number,
  thetaStart: number,
  thetaLength: number,
): THREE.BufferGeometry {
  const thetaSteps = buildThetaSteps(thetaStart, thetaLength)
  const latCount = thetaSteps.length

  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let lat = 0; lat < latCount; lat++) {
    const theta = thetaSteps[lat]!
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)
    const v = theta / Math.PI

    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon / lonSegments) * Math.PI * 2
      const u = lon / lonSegments

      const nx = sinTheta * Math.cos(phi)
      const ny = cosTheta
      const nz = sinTheta * Math.sin(phi)

      const [dx, dy, dz] = plumDeform(nx, ny, nz, radius)

      vertices.push(dx, dy, dz)
      uvs.push(u, v)
    }
  }

  const stride = lonSegments + 1
  for (let lat = 0; lat < latCount - 1; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      const a = lat * stride + lon
      const b = a + stride
      const c = a + 1
      const d = b + 1

      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  // Re-centre geometry
  geo.computeBoundingBox()
  const centre = new THREE.Vector3()
  geo.boundingBox!.getCenter(centre)
  if (Math.abs(centre.y) > 1e-5) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) - centre.y)
    }
    pos.needsUpdate = true
    geo.computeBoundingBox()
    geo.computeVertexNormals()
  }

  return geo
}

export function getPlumBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildPlumCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getPlumHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildPlumCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const PLUM_MAX_XZ = 0.99

/**
 * Y-coordinate of the top pole (cavity floor) after geometry re-centring.
 * Used by stem positioning code in `meshes.ts`.
 */
export const PLUM_TOP_POLE_Y_RATIO = 0.92
