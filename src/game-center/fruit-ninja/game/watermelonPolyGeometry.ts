import * as THREE from 'three'

/**
 * Adaptive lat–long “poly” melon: dense rings near poles (high curvature), coarse near the waist.
 * UV: u = azimuth around Y (long axis), v = colatitude / π so stripes (texture columns along u) run pole→pole.
 */

export const WATERMELON_AX = 0.94
export const WATERMELON_AY = 1.08
export const WATERMELON_AZ = 0.94

const NLON = 22

const bodyCache = new Map<number, THREE.BufferGeometry>()
const halfCache = new Map<string, THREE.BufferGeometry>()

/** Colatitude φ ∈ (0, π): 0 = north pole, π/2 = equator, π = south. Tight steps at ends, wide at waist. */
function colatitudesFullSphere(): number[] {
  const eps = 0.028
  const pi = Math.PI
  const north: number[] = []
  for (let i = 0; i <= 12; i++) north.push(eps + (i / 12) * (0.34 * pi - eps))
  const waist = [0.35 * pi, 0.42 * pi, 0.5 * pi, 0.58 * pi, 0.65 * pi]
  const south: number[] = []
  for (let i = 0; i <= 12; i++) south.push(0.66 * pi + (i / 12) * (pi - eps - 0.66 * pi))
  const merged = [...north, ...waist, ...south]
  return [...new Set(merged.map((x) => Math.round(x * 1e5) / 1e5))].sort((a, b) => a - b)
}

/** Upper shell only: φ from north to equator (π/2). */
function colatitudesUpperHalf(): number[] {
  const eps = 0.03
  const h = Math.PI / 2
  const cap: number[] = []
  for (let i = 0; i <= 11; i++) cap.push(eps + (i / 11) * (0.38 * h - eps))
  const belt = [0.42 * h, 0.55 * h, 0.72 * h, h - eps * 0.4]
  const merged = [...cap, ...belt]
  return [...new Set(merged.map((x) => Math.round(x * 1e5) / 1e5))].sort((a, b) => a - b)
}

function colatitudesSlicedHalf(half: 'top' | 'bottom'): number[] {
  const full = colatitudesFullSphere()
  if (half === 'top') {
    return full.filter((phi) => phi <= Math.PI / 2 + 1e-6)
  }
  return full.filter((phi) => phi >= Math.PI / 2 - 1e-6).reverse()
}

function buildLatLong(
  radius: number,
  phis: number[],
  mirrorY = false,
): THREE.BufferGeometry {
  const nRings = phis.length
  const vertsPerRing = NLON + 1
  const positions: number[] = []
  const uvs: number[] = []

  const ax = WATERMELON_AX * radius
  const ay = WATERMELON_AY * radius
  const az = WATERMELON_AZ * radius

  for (let i = 0; i < nRings; i++) {
    const phi = phis[i]!
    const sinP = Math.sin(phi)
    const cosP = Math.cos(phi)
    for (let j = 0; j <= NLON; j++) {
      const theta = (j / NLON) * Math.PI * 2
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      const nx = sinP * cosT
      const ny = cosP
      const nz = sinP * sinT
      positions.push(nx * ax, (mirrorY ? -ny : ny) * ay, nz * az)
      const u = j / NLON
      const v = phi / Math.PI
      uvs.push(u, v)
    }
  }

  const indices: number[] = []
  for (let i = 0; i < nRings - 1; i++) {
    const row = i * vertsPerRing
    const next = row + vertsPerRing
    for (let j = 0; j < NLON; j++) {
      const a = row + j
      const b = row + j + 1
      const c = next + j + 1
      const d = next + j
      indices.push(a, b, c)
      indices.push(a, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export function getWatermelonBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildLatLong(radius, colatitudesFullSphere())
    bodyCache.set(radius, g)
  }
  return g
}

export function getWatermelonHalfPolyGeometry(radius: number): THREE.BufferGeometry {
  return getWatermelonSlicedHalfPolyGeometry(radius, 'top')
}

export function getWatermelonSlicedHalfPolyGeometry(radius: number, half: 'top' | 'bottom'): THREE.BufferGeometry {
  const key = `${radius}:${half}`
  let g = halfCache.get(key)
  if (!g) {
    g = buildLatLong(radius, colatitudesSlicedHalf(half), half === 'bottom')
    halfCache.set(key, g)
  }
  return g
}
