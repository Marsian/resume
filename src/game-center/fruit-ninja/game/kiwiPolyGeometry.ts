import * as THREE from 'three'

/**
 * Kiwi-shaped polyhedron: elongated ovoid with a slightly wider "shoulder"
 * near the top and a gentle taper toward the bottom.
 *
 * Wiki kiwi is an oblong oval — distinctly taller than wide, with the widest
 * point slightly above the equator and a rounded taper at both ends. The top
 * has a small stem-attachment area that is slightly indented.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem area), v = 1 → bottom pole.
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/**
 * Kiwi profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 */
function kiwiDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: elongated oval, taller than wide ---
  // Wiki kiwi is distinctly oblong — egg-shaped, clearly taller than wide
  const scaleXZ = 0.72
  const scaleY = 1.18

  // --- Shoulder bulge: widest near center ---
  // Kiwi is widest around the middle, giving it the classic ovoid shape
  const bulgeCenter = 0.05
  const bulgeWidth = 0.48
  const bulgeAmount = 0.06
  const bulge = bulgeAmount * Math.exp(-((h - bulgeCenter) * (h - bulgeCenter)) / (2 * bulgeWidth * bulgeWidth))
  const totalXZ = scaleXZ + bulge

  x *= totalXZ
  z *= totalXZ
  y *= scaleY

  // --- Top indent: shallow stem cavity ---
  let topDR = 1.0
  let topDY = 0
  if (h > 0.85) {
    const t = (h - 0.85) / 0.15
    topDR = 1.0 - 0.18 * t * t
    topDY = -0.03 * t * t * radius
  }

  // --- Bottom: rounded, no taper ---
  // Wiki kiwi is rounded at both ends — the ellipsoid shape alone provides the natural rounding
  let bottomDR = 1.0
  let bottomDY = 0

  x *= topDR * bottomDR
  z *= topDR * bottomDR
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the top (stem cavity) and bottom (taper).
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries (in theta)
  const topZoneEnd = Math.acos(0.85)      // ~0.555 rad (top pole / stem)
  const bottomZoneStart = Math.acos(-0.85) // ~2.587 rad (bottom pole)

  const topRings = 14
  const midRings = 30
  const bottomRings = 10

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

function buildKiwiCustomGeometry(
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

      const [dx, dy, dz] = kiwiDeform(nx, ny, nz, radius)

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

  // Centre the geometry on its bounding-box midpoint so rotation looks natural.
  // Only re-centre for the whole fruit (thetaLength >= PI); half geometries must
  // keep the equator at y=0 so the flesh cap aligns correctly.
  if (thetaLength >= Math.PI) {
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
  }

  return geo
}

export function getKiwiBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildKiwiCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getKiwiHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildKiwiCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const KIWI_MAX_XZ = 0.80

/**
 * Y-coordinate of the top pole (stem area) after geometry re-centring.
 * Used by stem nub positioning code in `meshes.ts`.
 */
export const KIWI_TOP_POLE_Y_RATIO = 1.05
