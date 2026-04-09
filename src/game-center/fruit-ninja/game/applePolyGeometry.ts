import * as THREE from 'three'

/**
 * Apple-shaped polyhedron with non-uniform latitude distribution.
 *
 * Extra vertex rings are packed at the top (stem cavity) and bottom indent
 * zones so the concave shape is clearly visible through the silhouette,
 * even with unlit MeshBasicMaterial.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/** Apple profile deformation for a unit-sphere vertex at normalised height h in [-1, +1]. */
function appleDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: nearly spherical, slightly taller than wide ---
  // Reduce width/height ratio (less “flat”).
  const scaleXZ = 0.94
  const scaleY = 1.18

  // --- Upper body bulge: widest slightly above equator ---
  const bulge = 0.06 * Math.exp(-((h - 0.15) * (h - 0.15)) / (0.28 * 0.28))
  const totalXZ = scaleXZ + bulge

  // --- Top indent (stem cavity) ---
  let topDY = 0
  let topDR = 1.0
  if (h > 0.55) {
    const t = (h - 0.55) / 0.45
    topDY = -0.35 * t * t * radius
    topDR = 1.0 - 0.75 * t * t
  }

  // --- Bottom indent ---
  let bottomDY = 0
  let bottomDR = 1.0
  if (h < -0.65) {
    const t = (-0.65 - h) / 0.35
    bottomDY = 0.22 * t * t * radius
    bottomDR = 1.0 - 0.65 * t * t
  }

  // --- Lower body taper ---
  const taper = 1.0 - 0.12 * Math.max(0, -h)

  const finalXZ = totalXZ * topDR * bottomDR * taper
  x *= finalXZ
  z *= finalXZ

  y = y * scaleY + topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 *
 * Top indent zone:    theta 0    -> ~1.0  (h > 0.55) : dense rings
 * Middle body zone:   theta ~1.0 -> ~2.28 : normal density
 * Bottom indent zone: theta ~2.28 -> pi   (h < -0.65) : dense rings
 *
 * thetaStart/thetaLength restrict the range for half-geometry.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries (in theta)
  const topZoneEnd = Math.acos(0.55)    // ~0.988 rad
  const bottomZoneStart = Math.acos(-0.65) // ~2.279 rad

  // Full-sphere ring counts per zone
  const topRings = 20
  const midRings = 30
  const bottomRings = 16

  const steps: number[] = []

  // Generate all candidate theta values
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

  // Filter to requested range and ensure endpoints are included
  steps.push(thetaStart)
  for (const t of allThetas) {
    if (t > thetaStart + 1e-6 && t < thetaEnd - 1e-6) {
      steps.push(t)
    }
  }
  steps.push(thetaEnd)

  return steps
}

function buildAppleCustomGeometry(
  radius: number,
  lonSegments: number,
  thetaStart: number,
  thetaLength: number,
): THREE.BufferGeometry {
  const thetaSteps = buildThetaSteps(thetaStart, thetaLength)
  const latCount = thetaSteps.length // number of latitude rings

  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  // Generate vertices ring by ring
  for (let lat = 0; lat < latCount; lat++) {
    const theta = thetaSteps[lat]!
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)
    const v = theta / Math.PI

    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon / lonSegments) * Math.PI * 2
      const u = lon / lonSegments

      // Unit sphere position
      const nx = sinTheta * Math.cos(phi)
      const ny = cosTheta
      const nz = sinTheta * Math.sin(phi)

      // Apply apple deformation
      const [dx, dy, dz] = appleDeform(nx, ny, nz, radius)

      vertices.push(dx, dy, dz)
      uvs.push(u, v)
    }
  }

  // Generate triangle indices
  const stride = lonSegments + 1
  for (let lat = 0; lat < latCount - 1; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      const a = lat * stride + lon
      const b = a + stride
      const c = a + 1
      const d = b + 1

      // First triangle
      indices.push(a, b, c)
      // Second triangle
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

export function getAppleBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildAppleCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getAppleHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildAppleCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const APPLE_MAX_XZ = 1.12
