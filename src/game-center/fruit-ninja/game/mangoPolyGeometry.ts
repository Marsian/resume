import * as THREE from 'three'

/**
 * Mango-shaped polyhedron: elongated kidney/ovoid with a pointed tip at the
 * bottom and a slight indent at the top near the stem.
 *
 * Wiki mango is an asymmetric ovoid: wider at the "shoulder" (upper-middle),
 * tapering to a pointed curved tip at the bottom. The top is slightly
 * flattened where the stem attaches. One side (front) is more convex than the
 * other (back), giving it the classic mango kidney curve.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem area), v = 1 → bottom pole (tip).
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()

/**
 * Mango profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 */
function mangoDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom (tip), +1 top (stem)

  // --- Base ellipsoid: slender and elongated ---
  // Real mango is distinctly elongated and narrow — taller than wide with a slim profile
  const scaleXZ = 0.70
  const scaleY = 1.28

  // --- Subtle shoulder bulge (slightly wider above center) ---
  const bulgeCenter = 0.10
  const bulgeWidth = 0.55
  const bulgeAmount = 0.08
  const bulge = bulgeAmount * Math.exp(-((h - bulgeCenter) * (h - bulgeCenter)) / (2 * bulgeWidth * bulgeWidth))
  const totalXZ = scaleXZ + bulge

  x *= totalXZ
  z *= totalXZ
  y *= scaleY

  // --- Pronounced kidney/arc curve: mango has a clear curvature ---
  // The whole fruit curves like a bean — front bulges out, back is slightly concave
  if (Math.abs(z) > 1e-8) {
    const frontBias = 0.09 * Math.max(0, nz)
    const backBias = -0.04 * Math.max(0, -nz)
    z += (frontBias + backBias) * radius
  }
  // Global arc: shift the whole cross-section forward proportionally to distance from center
  // This creates the overall curved banana/mango shape
  const arcAmount = 0.06
  z += arcAmount * (1.0 - h * h) * radius

  // --- Top flattening: near the stem, narrow ---
  let topDR = 1.0
  let topDY = 0
  if (h > 0.72) {
    const t = (h - 0.72) / 0.28
    topDR = 1.0 - 0.22 * t * t
    topDY = -0.02 * t * t * radius
  }

  // --- Bottom pointed tip: taper to a curved point ---
  let bottomDR = 1.0
  let bottomDY = 0
  if (h < -0.50) {
    const t = (-0.50 - h) / 0.50
    bottomDR = 1.0 - 0.70 * t * t
    bottomDY = -0.14 * t * t * radius
    // Curve the tip — pull front z slightly
    if (nz > 0) {
      z += 0.03 * t * t * radius * nz
    }
  }

  x *= topDR * bottomDR
  z *= topDR * bottomDR
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the poles (tip and stem) for sharper features.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries
  const topZoneEnd = Math.acos(0.72)     // top pole / stem area
  const bottomZoneStart = Math.acos(-0.62) // bottom tip

  const topRings = 16
  const midRings = 32
  const bottomRings = 16

  const allThetas: number[] = []

  // Top zone
  for (let i = 0; i <= topRings; i++) {
    allThetas.push((i / topRings) * topZoneEnd)
  }
  // Middle zone
  for (let i = 1; i <= midRings; i++) {
    allThetas.push(topZoneEnd + (i / midRings) * (bottomZoneStart - topZoneEnd))
  }
  // Bottom zone (tip)
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

function buildMangoCustomGeometry(
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

      const [dx, dy, dz] = mangoDeform(nx, ny, nz, radius)

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

export function getMangoBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildMangoCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}
