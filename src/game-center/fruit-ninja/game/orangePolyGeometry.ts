import * as THREE from 'three'

/**
 * Orange-shaped polyhedron: nearly spherical with slight oblate (wider than tall)
 * profile and a small navel indent at the top.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (navel), v = 1 → bottom pole.
 */

/** Higher segment count for smooth dimpled sphere. */
const LON_SEGMENTS = 56

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/** Orange profile deformation for a unit-sphere vertex at normalised height h in [-1, +1]. */
function orangeDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: nearly spherical, wiki orange is quite round ---
  const scaleXZ = 1.02
  const scaleY = 0.99

  // --- Equatorial bulge: subtle, oranges are nearly spherical ---
  const bulge = 0.01 * Math.exp(-((h) * (h)) / (0.40 * 0.40))
  const totalXZ = scaleXZ + bulge

  // --- Top navel indent: shallow concavity where the navel sits ---
  let topDY = 0
  let topDR = 1.0
  if (h > 0.88) {
    const t = (h - 0.88) / 0.12
    topDY = -0.08 * t * t * radius
    topDR = 1.0 - 0.15 * t * t
  }

  // --- Bottom: very slight flatten (not as pronounced as top) ---
  let bottomDY = 0
  let bottomDR = 1.0
  if (h < -0.90) {
    const t = (-0.90 - h) / 0.10
    bottomDY = 0.04 * t * t * radius
    bottomDR = 1.0 - 0.08 * t * t
  }

  const finalXZ = totalXZ * topDR * bottomDR
  x *= finalXZ
  z *= finalXZ

  y = y * scaleY + topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the top pole (navel indent zone) for sharper detail.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries
  const topZoneEnd = Math.acos(0.85)       // ~0.555 rad (navel zone)
  const bottomZoneStart = Math.acos(-0.88)  // ~2.583 rad

  const topRings = 16
  const midRings = 32
  const bottomRings = 12

  const allThetas: number[] = []

  // Top zone: 0 to topZoneEnd
  for (let i = 0; i <= topRings; i++) {
    allThetas.push((i / topRings) * topZoneEnd)
  }
  // Middle zone: topZoneEnd to bottomZoneStart
  for (let i = 1; i <= midRings; i++) {
    allThetas.push(topZoneEnd + (i / midRings) * (bottomZoneStart - topZoneEnd))
  }
  // Bottom zone: bottomZoneStart to PI
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

function buildOrangeCustomGeometry(
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

      const [dx, dy, dz] = orangeDeform(nx, ny, nz, radius)

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

  return geo
}

export function getOrangeBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildOrangeCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getOrangeHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildOrangeCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const ORANGE_MAX_XZ = 1.03
