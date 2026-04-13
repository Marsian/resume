import * as THREE from 'three'

/**
 * Peach-shaped polyhedron: nearly spherical with a subtle cleft at the top
 * and a vertical suture groove along one meridian.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem cleft), v = 1 → bottom pole.
 *
 * The suture line sits at phi ≈ 0 (u ≈ 0 / u ≈ 1), which is the texture
 * seam. This way the suture groove hides the UV seam.
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

  // --- Base ellipsoid: nearly spherical — wiki peach is quite round ---
  const scaleXZ = 1.02
  const scaleY = 0.98

  // --- Subtle equatorial width ---
  const bulge = 0.015 * Math.exp(-((h) * (h)) / (0.40 * 0.40))
  const totalXZ = scaleXZ + bulge

  // --- Top cleft: the distinctive indent at the top of a peach ---
  // The cleft is a shallow depression running along the suture line at the very top
  let cleftDY = 0
  let cleftDR = 1.0
  if (h > 0.82) {
    const t = (h - 0.82) / 0.18
    cleftDY = -0.10 * t * t * radius
    cleftDR = 1.0 - 0.08 * t * t
  }

  // --- Suture line: real groove running along phi = 0 (the UV seam) ---
  // Wiki peach has a clearly visible suture cleft — a real physical groove,
  // not just a painted line. The geometry dent creates natural shadow.
  let sutureDent = 0
  {
    // phi ranges 0..2π. Suture at phi=0 (same as phi=2π).
    // Wrap-around distance:
    const d = Math.min(phi, Math.PI * 2 - phi)
    const sutureMask = Math.exp(-(d * d) / (0.08 * 0.08))
    // Suture runs full height but is most visible in the equatorial region
    const sutureVertical = 1.0 - 0.4 * h * h
    sutureDent = -0.12 * radius * sutureMask * Math.max(0, sutureVertical)
  }

  // --- Bottom: very slight taper ---
  let bottomDY = 0
  let bottomDR = 1.0
  if (h < -0.88) {
    const t = (-0.88 - h) / 0.12
    bottomDY = 0.02 * t * t * radius
    bottomDR = 1.0 - 0.04 * t * t
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

  const topZoneEnd = Math.acos(0.78)         // ~0.68 rad
  const bottomZoneStart = Math.acos(-0.85)   // ~2.54 rad

  const topRings = 18
  const midRings = 32
  const bottomRings = 12

  const allThetas: number[] = []

  for (let i = 0; i <= topRings; i++) {
    allThetas.push((i / topRings) * topZoneEnd)
  }
  for (let i = 1; i <= midRings; i++) {
    allThetas.push(topZoneEnd + (i / midRings) * (bottomZoneStart - topZoneEnd))
  }
  for (let i = 1; i <= bottomRings; i++) {
    allThetas.push(bottomZoneStart + (i / bottomRings) * (Math.PI - bottomZoneStart))
  }

  const steps: number[] = [thetaStart]
  for (const t of allThetas) {
    if (t > thetaStart + 1e-6 && t < thetaEnd - 1e-6) {
      steps.push(t)
    }
  }
  steps.push(thetaEnd)

  return steps
}

/**
 * Build non-uniform phi (longitude) steps.
 * Dense segments near the suture groove (phi ≈ 0 / 2π) for sharper crease.
 * The rest of the sphere uses normal density.
 */
function buildPhiSteps(lonSegments: number): number[] {
  // Suture zone: phi within ±0.3 rad of 0 (and 2π)
  // We allocate extra segments in this zone
  const sutureWidth = 0.35 // radians on each side
  const sutureSegs = 12    // extra density in suture zone
  const normalSegs = lonSegments - sutureSegs

  const steps: number[] = [0]

  // Suture zone: 0 to sutureWidth
  for (let i = 1; i <= sutureSegs / 2; i++) {
    steps.push((i / (sutureSegs / 2)) * sutureWidth)
  }
  // Normal zone: sutureWidth to 2π - sutureWidth
  for (let i = 1; i < normalSegs; i++) {
    steps.push(sutureWidth + (i / normalSegs) * (Math.PI * 2 - 2 * sutureWidth))
  }
  // Suture zone: 2π - sutureWidth to 2π
  for (let i = 1; i <= sutureSegs / 2; i++) {
    steps.push(Math.PI * 2 - sutureWidth + (i / (sutureSegs / 2)) * sutureWidth)
  }

  // Ensure last step is exactly 2π
  steps[steps.length - 1] = Math.PI * 2

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
  const phiSteps = buildPhiSteps(lonSegments)
  const phiCount = phiSteps.length

  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let lat = 0; lat < latCount; lat++) {
    const theta = thetaSteps[lat]!
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)
    const v = theta / Math.PI

    for (let lon = 0; lon < phiCount; lon++) {
      const phi = phiSteps[lon]!
      const u = phi / (Math.PI * 2)

      const nx = sinTheta * Math.cos(phi)
      const ny = cosTheta
      const nz = sinTheta * Math.sin(phi)

      const [dx, dy, dz] = peachDeform(nx, ny, nz, radius, phi)

      vertices.push(dx, dy, dz)
      uvs.push(u, v)
    }
  }

  const stride = phiCount
  for (let lat = 0; lat < latCount - 1; lat++) {
    for (let lon = 0; lon < phiCount - 1; lon++) {
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
export const PEACH_MAX_XZ = 1.04

/**
 * Y-coordinate of the top pole (cleft floor) after geometry re-centring.
 * Used by stem positioning code in `meshes.ts`.
 */
export const PEACH_TOP_POLE_Y_RATIO = 0.90
