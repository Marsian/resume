import * as THREE from 'three'

/**
 * TubeGeometry uses constant radius; we rescale rings for a pointed bell profile.
 */
export function applyTubeRadiusProfile(
  geometry: THREE.TubeGeometry,
  path: THREE.Curve<THREE.Vector3>,
  baseRadius: number,
  scaleAtT: (t: number) => number,
): void {
  const { tubularSegments, radialSegments } = geometry.parameters
  const pos = geometry.attributes.position as THREE.BufferAttribute
  const tmpP = new THREE.Vector3()
  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    path.getPointAt(t, tmpP)
    const targetR = baseRadius * scaleAtT(t)
    for (let j = 0; j <= radialSegments; j++) {
      const k = i * (radialSegments + 1) + j
      const x = pos.getX(k)
      const y = pos.getY(k)
      const z = pos.getZ(k)
      const vx = x - tmpP.x
      const vy = y - tmpP.y
      const vz = z - tmpP.z
      const len = Math.hypot(vx, vy, vz)
      if (len < 1e-8) continue
      const f = targetR / len
      pos.setXYZ(k, tmpP.x + vx * f, tmpP.y + vy * f, tmpP.z + vz * f)
    }
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

/**
 * Wiki: long body mostly straight with slight bend; pointed ends, slightly thicker mid-body.
 * sin(πt) peaks at t=0.5 → narrow at t=0 and t=1.
 */
export function bananaGirthScale(t: number): number {
  const bell = Math.sin(t * Math.PI)
  return 0.32 + 0.68 * Math.pow(Math.max(0, bell), 0.78)
}

/**
 * Long spine, nearly straight in Y with a gentle arc in +X (slight bend only).
 */
export function createBananaSpineCurve(radius: number): THREE.CatmullRomCurve3 {
  const r = radius
  /** Only stretches spine along Y (body length); X/Z and all other banana params unchanged. */
  const ly = 1.14
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.08 * r, -1.42 * ly * r, 0.02 * r),
      new THREE.Vector3(-0.04 * r, -0.82 * ly * r, 0.04 * r),
      new THREE.Vector3(0.02 * r, -0.22 * ly * r, 0.05 * r),
      new THREE.Vector3(0.08 * r, 0.38 * ly * r, 0.05 * r),
      new THREE.Vector3(0.14 * r, 0.98 * ly * r, 0.03 * r),
      new THREE.Vector3(0.2 * r, 1.48 * ly * r, -0.02 * r),
    ],
    false,
    'centripetal',
    0.5,
  )
}

/**
 * Seals TubeGeometry open ends: sphere mostly inside the tube, overlapping the rim (closed volume).
 * `which`: blossom at t=0, stem at t=1.
 */
export function createBananaEndSeal(
  curve: THREE.CatmullRomCurve3,
  which: 'blossom' | 'stem',
  baseRadius: number,
  scaleAtEnd: number,
  material: THREE.Material,
): THREE.Mesh {
  const t = which === 'blossom' ? 0 : 1
  const p = new THREE.Vector3()
  const tan = new THREE.Vector3()
  curve.getPointAt(t, p)
  curve.getTangentAt(t, tan).normalize()
  const R = baseRadius * scaleAtEnd * 1.06
  const geom = new THREE.SphereGeometry(R, 14, 10)
  const mesh = new THREE.Mesh(geom, material)
  const inward = which === 'blossom' ? tan.clone() : tan.clone().multiplyScalar(-1)
  mesh.position.copy(p).addScaledVector(inward, R * 0.46)
  mesh.userData.sharedMaterial = true
  return mesh
}
