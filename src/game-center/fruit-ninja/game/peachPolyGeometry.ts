import * as THREE from 'three'

/**
 * Peach-shaped polyhedron: slightly oblate with a characteristic cleft/indent
 * at the top (heart-shaped when viewed from above) and a subtle vertical
 * suture groove along one meridian.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem cleft), v = 1 → bottom pole.
 */

const LON_SEGMENTS = 56

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/** Peach profile deformation for a unit-sphere vertex at normalised height h in [-1, +1]. */
function peachDeform(nx: number, ny: number, nz: number, radius: number, phi: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: slightly oblate but not too flat — wiki peach is quite round ---
  const scaleXZ = 1.03
  const scaleY = 0.97

  // --- Equatorial bulge: subtle, peaches are nearly spherical ---
  const bulge = 0.02 * Math.exp(-((h) * (h)) / (0.35 * 0.35))
  const totalXZ = scaleXZ + bulge

  // --- Top cleft: the distinctive heart-shaped indent at the top of a peach ---
  // This creates two subtle bumps on either side of the stem, with a dip between them
  let cleftDY = 0
  let cleftDR = 1.0
  if (h > 0.75) {
    const t = (h - 0.75) / 0.25
    // The cleft runs along the suture line (phi ≈ 0 or π)
    // Push the center of the cleft down, leave the sides slightly raised
    const cleftDepth = 0.12 * t * t * radius
    // Create a subtle vertical groove: deeper at the very top, tapering down
    cleftDY = -cleftDepth
    // Narrow slightly at the very top
    cleftDR = 1.0 - 0.10 * t * t
  }

  // --- Suture line: subtle groove running from top to bottom along one meridian ---
  // The suture is a subtle indent running along the azimuth direction
  // phi is the azimuth angle (0 to 2π). The suture runs along phi ≈ 0 (and wraps to π)
  let sutureDent = 0
  {
    // Distance from suture line (at phi = 0, which is same as phi = 2π)
    const sutureDist = Math.min(Math.abs(phi), Math.abs(phi - Math.PI * 2))
    const sutureMask = Math.exp(-(sutureDist * sutureDist) / (0.15 * 0.15))
    // Suture runs full height but is most visible in the middle
    const sutureVertical = 1.0 - 0.5 * h * h // strongest at equator
    sutureDent = -0.035 * radius * sutureMask * Math.max(0, sutureVertical)
  }

  // --- Bottom: slight taper to a small point ---
  let bottomDY = 0
  let bottomDR = 1.0
  if (h < -0.85) {
    const t = (-0.85 - h) / 0.15
    bottomDY = 0.03 * t * t * radius
    bottomDR = 1.0 - 0.06 * t * t
  }

  const finalXZ = totalXZ * cleftDR * bottomDR
  x *= finalXZ
  z *= finalXZ

  // Apply suture dent in the radial direction
  const radialDist = Math.sqrt(nx * nx + nz * nz)
  if (radialDist > 1e-6) {
    x += (nx / radialDist) * sutureDent
    z += (nz / radialDist) * sutureDent
  }

  y = y * scaleY + cleftDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near top pole (cleft zone) for sharper detail.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries
  const topZoneEnd = Math.acos(0.72)         // ~0.77 rad (cleft zone)
  const bottomZoneStart = Math.acos(-0.82)   // ~2.53 rad

  const topRings = 20
  const midRings = 30
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

function buildPeachCustomGeometry(
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

      const [dx, dy, dz] = peachDeform(nx, ny, nz, radius, phi)

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

export function getPeachBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildPeachCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getPeachHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildPeachCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const PEACH_MAX_XZ = 1.05

/**
 * Y-coordinate of the top pole (cleft floor) after geometry re-centring.
 * Used by stem positioning code in `meshes.ts`.
 */
export const PEACH_TOP_POLE_Y_RATIO = 0.88
