import * as THREE from 'three'

/**
 * Coconut-shaped polyhedron: slightly oblate sphere with a flattened top where
 * the "eyes" sit and a subtly flattened bottom. The shape is slightly wider
 * than tall (like a real coconut), with a gentle equatorial bulge.
 *
 * Wiki coconut is a round-to-ovoid brown fruit with three characteristic
 * "eyes" at one end (the germ pores) and a fibrous husk texture covering
 * the entire surface. The top pole area is flatter where the eyes cluster.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (eyes area), v = 1 → bottom pole.
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/**
 * Coconut profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 */
function coconutDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top (eyes)

  // --- Base ellipsoid: nearly spherical ---
  // Wiki coconut is a very round ball — almost perfectly spherical
  const scaleXZ = 0.96
  const scaleY = 0.96

  // --- Subtle equatorial bulge: coconuts are widest at the middle ---
  const bulge = 0.02 * Math.exp(-(h * h) / (0.45 * 0.45))
  const totalXZ = scaleXZ + bulge

  x *= totalXZ
  z *= totalXZ
  y *= scaleY

  // --- Top flattening: very subtle — wiki coconut is quite round at top ---
  let topDR = 1.0
  let topDY = 0
  if (h > 0.88) {
    const t = (h - 0.88) / 0.12
    // Minimal flattening — the eye face is barely noticeable in shape
    topDR = 1.0 - 0.03 * t * t
    topDY = -0.005 * t * t * radius
  }

  // --- Bottom: very slight flattening ---
  let bottomDR = 1.0
  let bottomDY = 0
  if (h < -0.88) {
    const t = (-0.88 - h) / 0.12
    bottomDR = 1.0 - 0.03 * t * t
    bottomDY = 0.003 * t * t * radius
  }

  x *= topDR * bottomDR
  z *= topDR * bottomDR
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the top pole (eyes area) for sharper features.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries
  const topZoneEnd = Math.acos(0.70)       // top pole / eyes area
  const bottomZoneStart = Math.acos(-0.75)  // bottom pole

  const topRings = 16
  const midRings = 30
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

function buildCoconutCustomGeometry(
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

      const [dx, dy, dz] = coconutDeform(nx, ny, nz, radius)

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

export function getCoconutBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildCoconutCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getCoconutHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildCoconutCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const COCONUT_MAX_XZ = 0.98
