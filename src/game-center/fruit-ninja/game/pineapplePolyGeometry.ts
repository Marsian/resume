import * as THREE from 'three'

/**
 * Pineapple-shaped polyhedron: elongated cylinder with rounded ends and a
 * subtle mid-body bulge. The shape is much taller than wide, with a slight
 * taper toward the top.
 *
 * Wiki pineapple is a near-cylinder with rounded ends, minimal mid-body
 * bulge, and a slight taper toward the leaf crown at the top.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 -> top pole (crown area), v = 1 -> bottom pole.
 */

const LON_SEGMENTS = 40

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/**
 * Pineapple profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 * Produces a cylinder-like shape with subtle bulge and top taper, matching the
 * original CylinderGeometry-based mesh in meshes.ts.
 */
function pineappleDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top (crown)

  // --- Base ellipsoid: very elongated cylinder shape ---
  // Original mesh: bodyRadius = radius * 0.55, bodyHeight = bodyRadius * 1.98
  // The cylinder radii are 0.81-0.83 * bodyRadius relative to bodyRadius,
  // so XZ scale relative to the radius param is approximately 0.55 * 0.83 = 0.457
  // Y scale: height is ~1.089 * radius, so relative to a unit sphere Y scale ~ 1.09
  const scaleXZ = 0.46
  const scaleY = 1.09

  x *= scaleXZ
  z *= scaleXZ
  y *= scaleY

  // --- Mid-body bulge: very subtle, wiki pineapple is nearly cylindrical ---
  const bulgeAmount = 0.03
  const bulge = bulgeAmount * Math.sin((h + 1) * Math.PI / 2) // max at equator (h=0)
  x *= (1 + bulge)
  z *= (1 + bulge)

  // --- Top taper: slight narrowing toward crown ---
  const topTaperAmount = 0.05
  if (h > 0) {
    const t = h // 0 at equator, 1 at top pole
    const taper = 1.0 - topTaperAmount * t * t
    x *= taper
    z *= taper
  }

  // --- Bottom: very slight widening at base ---
  if (h < -0.5) {
    const t = (-0.5 - h) / 0.5 // 0 at h=-0.5, 1 at bottom pole
    const bottomWiden = 1.0 + 0.02 * t * t
    x *= bottomWiden
    z *= bottomWiden
  }

  // --- Cap pinch: both poles pinch inward for rounded ends ---
  // Top cap
  let topDR = 1.0
  let topDY = 0
  if (h > 0.88) {
    const t = (h - 0.88) / 0.12
    topDR = 1.0 - 0.17 * t * t
    topDY = -0.04 * t * t * radius
  }

  // Bottom cap
  let bottomDR = 1.0
  let bottomDY = 0
  if (h < -0.88) {
    const t = (-0.88 - h) / 0.12
    bottomDR = 1.0 - 0.17 * t * t
    bottomDY = 0.04 * t * t * radius
  }

  x *= topDR * bottomDR
  z *= topDR * bottomDR
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the top (crown) and bottom poles for cap rounding.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries
  const topZoneEnd = Math.acos(0.88)       // top pole / crown area
  const bottomZoneStart = Math.acos(-0.88)  // bottom pole

  const topRings = 12
  const midRings = 24
  const bottomRings = 12

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

function buildPineappleCustomGeometry(
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

      const [dx, dy, dz] = pineappleDeform(nx, ny, nz, radius)

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

export function getPineappleBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildPineappleCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getPineappleHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildPineappleCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const PINEAPPLE_MAX_XZ = 0.49
