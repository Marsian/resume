import * as THREE from 'three'

/**
 * Lemon-shaped polyhedron: elongated ellipsoid with pointed nipple protrusions
 * at both ends.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (nub), v = 1 → bottom pole (nub).
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<string, THREE.BufferGeometry>()

/** Lemon profile deformation for a unit-sphere vertex at normalised height h in [-1, +1]. */
function lemonDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: rounder, wider body (wiki lemon is plump but still elongated) ---
  const scaleXZ = 0.94
  const scaleY = 1.10

  // --- Top flat platform: protrudes slightly, stays wide (not pointed) ---
  let topDY = 0
  let topDR = 1.0
  if (h > 0.78) {
    const t = (h - 0.78) / 0.22
    // Slight protrusion upward
    topDY = 0.14 * t * t * radius
    // Barely narrow — flat platform, not a cone
    topDR = 1.0 - 0.28 * t * t
  }

  // --- Bottom flat platform: mirror of top ---
  let bottomDY = 0
  let bottomDR = 1.0
  if (h < -0.78) {
    const t = (-0.78 - h) / 0.22
    bottomDY = -0.12 * t * t * radius
    bottomDR = 1.0 - 0.25 * t * t
  }

  // --- Subtle bulge at equator ---
  const bulge = 0.03 * Math.exp(-((h) * (h)) / (0.30 * 0.30))
  const totalXZ = scaleXZ + bulge

  const finalXZ = totalXZ * topDR * bottomDR
  x *= finalXZ
  z *= finalXZ

  y = y * scaleY + topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the poles (nub zones) for sharper tips.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries
  const topZoneEnd = Math.acos(0.75)     // ~0.7227 rad
  const bottomZoneStart = Math.acos(-0.75) // ~2.4189 rad

  const topRings = 18
  const midRings = 28
  const bottomRings = 14

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

function buildLemonCustomGeometry(
  radius: number,
  lonSegments: number,
  thetaStart: number,
  thetaLength: number,
): THREE.BufferGeometry {
  return buildLemonGeometryFromThetaSteps(radius, lonSegments, buildThetaSteps(thetaStart, thetaLength))
}

function buildLemonGeometryFromThetaSteps(
  radius: number,
  lonSegments: number,
  thetaSteps: number[],
  mirrorY = false,
): THREE.BufferGeometry {
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

      const [dx, dy, dz] = lemonDeform(nx, ny, nz, radius)

      vertices.push(dx, mirrorY ? -dy : dy, dz)
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

export function getLemonBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildLemonCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getLemonHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  return getLemonSlicedHalfPolyGeometry(radius, 'top')
}

export function getLemonSlicedHalfPolyGeometry(radius: number, half: 'top' | 'bottom'): THREE.BufferGeometry {
  const key = `${radius}:${half}`
  let g = halfCache.get(key)
  if (!g) {
    if (half === 'top') {
      g = buildLemonCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    } else {
      const bottomThetaSteps = buildThetaSteps(Math.PI / 2, Math.PI / 2).reverse()
      g = buildLemonGeometryFromThetaSteps(radius, LON_SEGMENTS, bottomThetaSteps, true)
    }
    halfCache.set(key, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const LEMON_MAX_XZ = 0.97
