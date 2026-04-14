import * as THREE from 'three'

/**
 * Bomb-shaped polyhedron: a near-perfect sphere.
 *
 * Wiki bomb is a simple sphere — no significant deformation needed.
 * The top has a very slight flat area where the fuse mounts.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (fuse area), v = 1 → bottom pole.
 */

const LON_SEGMENTS = 40

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<number, THREE.BufferGeometry>()

/**
 * Bomb profile deformation — nearly spherical with a tiny flat spot at top for the fuse.
 */
function bombDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top

  // Very slight top flat spot for fuse mount
  if (h > 0.92) {
    const t = (h - 0.92) / 0.08
    y -= t * t * radius * 0.04
  }

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Slightly denser at top for fuse area.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  const topZoneEnd = Math.acos(0.92) // ~0.403 rad

  const topRings = 10
  const midRings = 28
  const bottomRings = 10

  const allThetas: number[] = []

  for (let i = 0; i <= topRings; i++) {
    allThetas.push((i / topRings) * topZoneEnd)
  }
  for (let i = 1; i <= midRings; i++) {
    allThetas.push(topZoneEnd + (i / midRings) * (Math.PI - topZoneEnd))
  }
  // Bottom shares the last zone
  for (let i = 1; i <= bottomRings; i++) {
    allThetas.push(topZoneEnd + ((midRings + i) / (midRings + bottomRings)) * (Math.PI - topZoneEnd))
  }

  // Deduplicate and sort
  const unique = [...new Set(allThetas)].sort((a, b) => a - b)

  const steps: number[] = [thetaStart]
  for (const t of unique) {
    if (t > thetaStart + 1e-6 && t < thetaEnd - 1e-6) {
      steps.push(t)
    }
  }
  steps.push(thetaEnd)

  return steps
}

function buildBombCustomGeometry(
  radius: number,
  lonSegments: number,
  thetaStart: number,
  thetaLength: number,
): THREE.BufferGeometry {
  // Use uniform theta steps since bomb is nearly spherical
  const latCount = 50
  const thetaSteps: number[] = []
  for (let i = 0; i <= latCount; i++) {
    thetaSteps.push(thetaStart + (i / latCount) * thetaLength)
  }

  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let lat = 0; lat <= latCount; lat++) {
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

      const [dx, dy, dz] = bombDeform(nx, ny, nz, radius)

      vertices.push(dx, dy, dz)
      uvs.push(u, v)
    }
  }

  const stride = lonSegments + 1
  for (let lat = 0; lat < latCount; lat++) {
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

export function getBombBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildBombCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}

export function getBombHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = halfCache.get(radius)
  if (!g) {
    g = buildBombCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI / 2)
    halfCache.set(radius, g)
  }
  return g
}

/** Approximate max XZ radius for half-mesh cap scaling. */
export const BOMB_MAX_XZ = 1.0
