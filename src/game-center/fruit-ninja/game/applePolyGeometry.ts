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

/** Slightly higher than 48 so gallery captures show a smoother silhouette next to wiki art. */
const LON_SEGMENTS = 56

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/** Apple profile deformation for a unit-sphere vertex at normalised height h in [-1, +1]. */
function appleDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: nearly spherical, slightly taller than wide ---
  // Wiki apple is quite round; keep modest height.
  const scaleXZ = 0.98
  const scaleY = 1.06

  // --- Upper body bulge: widest near equator (wiki apple is round) ---
  const bulge = 0.04 * Math.exp(-((h - 0.05) * (h - 0.05)) / (0.32 * 0.32))
  const totalXZ = scaleXZ + bulge

  // --- Top indent (stem cavity) — wiki-style shallow dent ---
  let topDY = 0
  let topDR = 1.0
  if (h > 0.80) {
    const t = (h - 0.80) / 0.20
    topDY = -0.18 * t * t * radius
    topDR = 1.0 - 0.45 * t * t
  }

  // --- Bottom indent — shallow, like wiki reference ---
  let bottomDY = 0
  let bottomDR = 1.0
  if (h < -0.80) {
    const t = (-0.80 - h) / 0.20
    bottomDY = 0.14 * t * t * radius
    bottomDR = 1.0 - 0.40 * t * t
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
 * Top indent zone:    theta 0    -> ~0.64  (h > 0.80) : dense rings
 * Middle body zone:   theta ~0.64 -> ~2.50 : normal density
 * Bottom indent zone: theta ~2.50 -> pi   (h < -0.80) : dense rings
 *
 * thetaStart/thetaLength restrict the range for half-geometry.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries (in theta)
  const topZoneEnd = Math.acos(0.80)    // ~0.6435 rad
  const bottomZoneStart = Math.acos(-0.80) // ~2.498 rad

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

  // Centre the geometry on its bounding-box midpoint so rotation looks natural.
  // The cavity dents pull the top down asymmetrically, shifting the visual centre
  // away from the origin; re-centring eliminates the "stem lags the body" effect.
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

/**
 * Y-coordinate of the top pole (cavity floor) after geometry re-centring.
 * Used by stem/leaf positioning code in `meshes.ts`.
 */
export const APPLE_TOP_POLE_Y_RATIO = 0.89
