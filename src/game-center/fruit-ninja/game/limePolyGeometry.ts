import * as THREE from 'three'

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * Lime-shaped polyhedron: short rounded-cylinder body with a small nub
 * at the top. Wiki lime has a barrel/drum shape — sides are slightly
 * convex (not flat), top/bottom faces are rounded with a gentle fillet.
 * Taller than wide, but compact. Smaller than lemon.
 *
 * UV mapping: standard equirectangular (u = azimuth, v = colatitude/pi).
 * v = 0 → top pole (nub), v = 1 → bottom pole (nub).
 */

const LON_SEGMENTS = 48

const bodyCache = new Map<number, THREE.BufferGeometry>()

/**
 * Lime deformation: barrel/drum shape.
 * - Sides: slightly convex (barrel bulge), not flat cylinder walls
 * - Top/bottom: gentle rounding (large fillet radius)
 * - Top: small nub
 * - Overall: taller than wide, compact
 */
function limeDeform(nx: number, ny: number, nz: number, radius: number): [number, number, number] {
  // Smaller than lemon
  const r = radius * 0.88
  const h = ny // -1 bottom, +1 top

  // --- Base ellipsoid: slightly taller than wide ---
  const scaleXZ = 0.90
  const scaleY = 1.02

  let x = nx * r * scaleXZ
  let z = nz * r * scaleXZ
  let y = ny * r * scaleY

  // --- Flat waist: in the equatorial band, pull radius inward so it
  //     matches the ellipsoid value at the band edge — no protrusion,
  //     just a straight-sided drum with smooth transitions ---
  const absH = Math.abs(h)
  const bandHalf = 0.38
  const transWidth = 0.12 // transition zone width for smooth blend
  if (absH < bandHalf + transWidth) {
    // The ellipsoid radius at h=±bandHalf — this is our target flat radius
    const hEdge = bandHalf
    const drumR = r * scaleXZ * Math.sqrt(Math.max(0, 1 - hEdge * hEdge))
    const currentR = Math.sqrt(x * x + z * z)
    if (currentR > 1e-8) {
      // Inside the flat band: pull to drumR
      // In the transition zone: blend between drumR and natural ellipsoid
      let targetR: number
      if (absH <= bandHalf) {
        targetR = drumR
      } else {
        // Transition: blend from drumR to natural ellipsoid radius
        const blend = smoothstep(bandHalf, bandHalf + transWidth, absH)
        targetR = drumR * (1 - blend) + currentR * blend
      }
      const ratio = targetR / currentR
      x *= ratio
      z *= ratio
    }
  }

  // --- Flatten the top and bottom faces (drum-like: wider flat area) ---
  if (h > 0.65) {
    const t = (h - 0.65) / 0.35
    // Very gentle narrowing — keeps top face wide and flat
    const flatR = 1.0 - 0.08 * t * t
    x *= flatR
    z *= flatR
  }
  if (h < -0.65) {
    const t = (-0.65 - h) / 0.35
    const flatR = 1.0 - 0.06 * t * t
    x *= flatR
    z *= flatR
  }

  // --- Top nub: small pointed protrusion ---
  if (h > 0.90) {
    const t = (h - 0.90) / 0.10
    y += 0.03 * t * t * r
    const narrow = 1.0 - 0.50 * t * t
    x *= narrow
    z *= narrow
  }

  // --- Bottom: tiny indent, no nub ---
  if (h < -0.90) {
    const t = (-0.90 - h) / 0.10
    y -= 0.01 * t * t * r
    const narrow = 1.0 - 0.35 * t * t
    x *= narrow
    z *= narrow
  }

  return [x, y, z]
}

/**
 * Build non-uniform theta (latitude) steps.
 * Dense rings near the poles for smoother top/bottom rounding.
 */
function buildThetaSteps(thetaStart: number, thetaLength: number): number[] {
  const thetaEnd = thetaStart + thetaLength

  const topZoneEnd = Math.acos(0.78)
  const bottomZoneStart = Math.acos(-0.78)

  const topRings = 18
  const midRings = 30
  const bottomRings = 16

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

function buildLimeCustomGeometry(
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

      const [dx, dy, dz] = limeDeform(nx, ny, nz, radius)

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

export function getLimeBodyPolyGeometry(radius: number): THREE.BufferGeometry {
  let g = bodyCache.get(radius)
  if (!g) {
    g = buildLimeCustomGeometry(radius, LON_SEGMENTS, 0, Math.PI)
    bodyCache.set(radius, g)
  }
  return g
}
