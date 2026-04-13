import * as THREE from 'three'

/**
 * Passionfruit-shaped polyhedron: nearly spherical, slightly oblate
 * (wider than tall). The surface has subtle undulations to support
 * the wrinkled skin appearance. A small dimple at the top where
 * the calyx/stem attaches.
 *
 * Wiki passionfruit is a small round fruit, slightly wider than tall,
 * with a distinctive wrinkled purple-brown skin when ripe.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (stem area), v = 1 → bottom pole.
 */

const LON_SEGMENTS = 40

const bodyCache = new Map<number, THREE.BufferGeometry>()

/**
 * Passionfruit profile deformation for a unit-sphere vertex.
 */
function passionfruitDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom, +1 top (stem)

  // --- Base shape: nearly spherical — wiki passionfruit is round, not squashed ---
  const scaleXZ = 1.00
  const scaleY = 1.00

  x *= scaleXZ
  z *= scaleXZ
  y *= scaleY

  // --- Equatorial bulge: slight, nearly round ---
  const bulgeAmount = 0.02
  const bulge = bulgeAmount * (1.0 - h * h)
  x += nx * bulge * radius
  z += nz * bulge * radius

  // --- Top dimple: noticeable indent at stem end (wiki shows a clear depression) ---
  let topDR = 1.0
  let topDY = 0
  if (h > 0.75) {
    const t = (h - 0.75) / 0.25
    topDR = 1.0 - 0.18 * t * t
    topDY = -0.06 * t * t * radius
  }

  // --- Bottom slight flattening ---
  let bottomDR = 1.0
  let bottomDY = 0
  if (h < -0.80) {
    const t = (-0.80 - h) / 0.20
    bottomDR = 1.0 - 0.08 * t * t
    bottomDY = 0.02 * t * t * radius
  }

  x *= topDR * bottomDR
  z *= topDR * bottomDR
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the poles for dimple details.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  const topZoneEnd = Math.acos(0.78)
  const bottomZoneStart = Math.acos(-0.80)

  const topRings = 12
  const midRings = 28
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

function buildPassionfruitCustomGeometry(
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

      const [dx, dy, dz] = passionfruitDeform(nx, ny, nz, radius)

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

export function getPassionfruitBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildPassionfruitCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}
