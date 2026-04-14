import * as THREE from 'three'

/**
 * Pear-shaped polyhedron with non-uniform latitude distribution.
 *
 * The pear has a classic pyriform shape: a wide rounded bottom that
 * tapers smoothly into a narrow elongated neck. The profile is built
 * by deforming a unit sphere with multiple overlapping Gaussian bulges
 * and tapers.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem), v = 1 → bottom pole (blossom end).
 */

const LON_SEGMENTS = 56

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/**
 * Pear profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 *
 * The shape is defined by:
 * - A wide bottom (lower body) that occupies ~60% of the fruit height
 * - A smooth transition zone (concave curve from bottom to neck)
 * - A narrow neck/shoulder area (upper body)
 * - A slight flare at the very top where the stem attaches
 * - A subtle bottom indent (blossom end)
 */
function pearDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Bottom body bulge: moderate, centered around h = -0.15 ---
  // Wiki pear bottom is round but not overly wide — proportionate
  const bottomBulge = 0.30 * Math.exp(-((h + 0.15) * (h + 0.15)) / (0.40 * 0.40))

  // --- Upper body: the neck taper ---
  // Wiki has a clearly narrow neck with smooth transition
  const neckSqueeze = 0.28 * Math.exp(-((h - 0.50) * (h - 0.50)) / (0.28 * 0.28))

  // --- No top flare — top should converge inward toward the stem, not flare out ---

  // --- Base ellipsoid proportions ---
  // Wiki pear is notably taller than wide — elongated elegant shape
  const scaleXZ = 0.82
  const scaleY = 1.34

  // Combine all XZ modifications (no topFlare)
  const totalXZ = scaleXZ + bottomBulge - neckSqueeze

  // --- Bottom: wide flat rounded base, not pointy ---
  // Wiki pear has a very blunt, rounded bottom — like it could sit on a table
  let bottomDY = 0
  let bottomDR = 1.0
  if (h < -0.75) {
    const t = (-0.75 - h) / 0.25
    // Push bottom UP strongly to flatten, keep width — blunt rounded base
    bottomDY = 0.18 * t * t * radius
    bottomDR = 1.0 - 0.05 * t * t   // minimal XZ pinching — stays round and blunt
  }

  // --- Top: converge inward toward stem (no flare) ---
  // The surface should smoothly gather toward the stem point, not bulge outward
  let topDY = 0
  let topDR = 1.0
  if (h > 0.80) {
    const t = (h - 0.80) / 0.20
    // Gentle Y depression for stem cavity
    topDY = -0.08 * t * t * radius
    // Smooth progressive XZ contraction — surface gathers inward toward the top
    topDR = 1.0 - 0.40 * t * t
  }

  const finalXZ = totalXZ * topDR * bottomDR
  x *= finalXZ
  z *= finalXZ

  y = y * scaleY + topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 *
 * Extra rings are packed at:
 * - Top (stem cavity): dense for smooth indent
 * - Neck transition zone: dense for smooth taper
 * - Bottom (blossom end): dense for indent
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries (in theta)
  const topZoneEnd = Math.acos(0.82)         // ~0.61 rad
  const neckZoneEnd = Math.acos(0.40)         // ~1.16 rad
  const bottomZoneStart = Math.acos(-0.82)    // ~2.52 rad

  const topRings = 16
  const neckRings = 24  // Extra density in the transition zone
  const midRings = 24
  const bottomRings = 14

  const allThetas: number[] = []

  // Top zone: stem cavity
  for (let i = 0; i <= topRings; i++) {
    allThetas.push((i / topRings) * topZoneEnd)
  }
  // Neck transition zone: dense for smooth taper
  for (let i = 1; i <= neckRings; i++) {
    allThetas.push(topZoneEnd + (i / neckRings) * (neckZoneEnd - topZoneEnd))
  }
  // Mid body zone
  for (let i = 1; i <= midRings; i++) {
    allThetas.push(neckZoneEnd + (i / midRings) * (bottomZoneStart - neckZoneEnd))
  }
  // Bottom zone: blossom end indent
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

function buildPearCustomGeometry(
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

      // Apply pear deformation
      const [dx, dy, dz] = pearDeform(nx, ny, nz, radius)

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

      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  // Centre the geometry on its bounding-box midpoint
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

  // Compute the actual top Y after centering, store for stem positioning
  const maxY = geo.boundingBox!.max.y
  ;(geo as any)._topY = maxY

  return geo
}

export function getPearBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildPearCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getPearHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildPearCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const PEAR_MAX_XZ = 1.20

/**
 * Y-coordinate of the top pole (cavity floor) after geometry re-centring.
 * Used by stem/leaf positioning code in `meshes.ts`.
 */
export const PEAR_TOP_POLE_Y_RATIO = 0.92
