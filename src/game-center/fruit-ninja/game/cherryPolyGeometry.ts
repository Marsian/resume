import * as THREE from 'three'

/**
 * Cherry-shaped polyhedron: slightly oblate (wider than tall),
 * with a sharp dimple / stem cavity at the top.
 *
 * Wiki cherry has a clearly visible top depression where the stem
 * attaches. The body is nearly spherical but slightly wider than tall.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem area), v = 1 → bottom pole.
 */

const LON_SEGMENTS = 40

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<string, THREE.BufferGeometry>()

/**
 * Cherry profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 */
function cherryDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: slightly wider than tall (oblate) ---
  const scaleXZ = 1.08
  const scaleY = 0.96

  x *= scaleXZ
  z *= scaleXZ
  y *= scaleY

  // --- Top indent: sharp stem cavity ---
  let topDR = 1.0
  let topDY = 0
  if (h > 0.72) {
    const t = (h - 0.72) / 0.28
    topDR = 1.0 - 0.45 * t * t * t
    topDY = -0.12 * t * t * radius
  }

  // --- Bottom indent: very subtle ---
  let bottomDR = 1.0
  let bottomDY = 0
  if (h < -0.88) {
    const t = (-0.88 - h) / 0.12
    bottomDR = 1.0 - 0.15 * t * t
    bottomDY = 0.04 * t * t * radius
  }

  x *= topDR * bottomDR
  z *= topDR * bottomDR
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the top (stem cavity) and bottom (indent).
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  const topZoneEnd = Math.acos(0.72)        // ~0.767 rad
  const bottomZoneStart = Math.acos(-0.88)   // ~2.636 rad

  const topRings = 16
  const midRings = 22
  const bottomRings = 10

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

function buildCherryCustomGeometry(
  radius: number,
  lonSegments: number,
  thetaStart: number,
  thetaLength: number,
): THREE.BufferGeometry {
  const geo = buildCherryGeometryFromThetaSteps(radius, lonSegments, buildThetaSteps(thetaStart, thetaLength))

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

function buildCherryGeometryFromThetaSteps(
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

      const [dx, dy, dz] = cherryDeform(nx, ny, nz, radius)

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

export function getCherryBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildCherryCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getCherryHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  return getCherrySlicedHalfPolyGeometry(radius, 'top')
}

export function getCherrySlicedHalfPolyGeometry(radius: number, half: 'top' | 'bottom'): THREE.BufferGeometry {
  const key = `${radius}:${half}`
  let g = halfCache.get(key)
  if (!g) {
    if (half === 'top') {
      g = buildCherryCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    } else {
      const bottomThetaSteps = buildThetaSteps(Math.PI / 2, Math.PI / 2).reverse()
      g = buildCherryGeometryFromThetaSteps(radius, LON_SEGMENTS, bottomThetaSteps, true)
    }
    halfCache.set(key, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const CHERRY_MAX_XZ = 1.10

/**
 * Y-coordinate of the top pole (cavity floor) after geometry re-centring.
 * Used by stem positioning code in `meshes.ts`.
 */
export const CHERRY_TOP_POLE_Y_RATIO = 0.90
