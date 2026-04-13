import * as THREE from 'three'

/**
 * Strawberry-shaped polyhedron: plump conical/heart shape — wider at the top
 * (shoulders) tapering to a rounded point at the bottom. Has a subtle
 * longitudinal ridge/groove pattern characteristic of strawberries.
 *
 * Wiki strawberry is a rounded cone: wide at the top with a smooth taper to
 * a pointed bottom tip. Not as elongated as a real strawberry — more
 * cartoony and plump.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (calyx), v = 1 → bottom pole (tip).
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()

/**
 * Strawberry profile deformation for a unit-sphere vertex at normalised height h in [-1, +1].
 */
function strawberryDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  let x = nx * radius
  let y = ny * radius
  let z = nz * radius

  const h = ny // -1 bottom (tip), +1 top (calyx)

  // --- Base ellipsoid: wide and squat — like a rounded heart ---
  // Wiki strawberry is very plump and wide, not tall
  const scaleXZ = 1.03
  const scaleY = 0.86

  // --- Shoulder bulge: widest near upper-middle (h ≈ +0.2) ---
  // Wiki strawberry is wide at the top, rounding down to a tip
  const shoulderCenter = 0.22
  const shoulderWidth = 0.55
  const shoulderAmount = 0.12
  const shoulder = shoulderAmount * Math.exp(-((h - shoulderCenter) * (h - shoulderCenter)) / (2 * shoulderWidth * shoulderWidth))
  const totalXZ = scaleXZ + shoulder

  x *= totalXZ
  z *= totalXZ
  y *= scaleY

  // --- Longitudinal ridges: strawberries have subtle grooves running top to bottom ---
  const ridgeFreq = 8
  const phi = Math.atan2(nz, nx)
  const ridgePattern = 1.0 + 0.025 * Math.cos(ridgeFreq * phi)

  // --- Bottom taper: taper to a defined point ---
  let bottomDR = 1.0
  let bottomDY = 0
  if (h < -0.35) {
    const t = (-0.35 - h) / 0.65
    // Clear taper to a point
    bottomDR = 1.0 - 0.60 * t * t
    // Pull the tip down
    bottomDY = -0.08 * t * t * radius
  }

  // --- Top flattening: where the calyx sits, slightly wider and flatter ---
  let topDR = 1.0
  let topDY = 0
  if (h > 0.78) {
    const t = (h - 0.78) / 0.22
    topDR = 1.0 - 0.15 * t * t
    topDY = -0.02 * t * t * radius
  }

  x *= bottomDR * topDR * ridgePattern
  z *= bottomDR * topDR * ridgePattern
  y += topDY + bottomDY

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the bottom pole (tip) for sharper taper.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  // Zone boundaries
  const topZoneEnd = Math.acos(0.78)         // top pole / calyx area
  const bottomZoneStart = Math.acos(-0.30)    // bottom taper starts

  const topRings = 12
  const midRings = 30
  const bottomRings = 20  // more rings for smooth taper

  const allThetas: number[] = []

  // Top zone
  for (let i = 0; i <= topRings; i++) {
    allThetas.push((i / topRings) * topZoneEnd)
  }
  // Middle zone
  for (let i = 1; i <= midRings; i++) {
    allThetas.push(topZoneEnd + (i / midRings) * (bottomZoneStart - topZoneEnd))
  }
  // Bottom zone (taper to tip)
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

function buildStrawberryCustomGeometry(
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

      const [dx, dy, dz] = strawberryDeform(nx, ny, nz, radius)

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

export function getStrawberryBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildStrawberryCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}
