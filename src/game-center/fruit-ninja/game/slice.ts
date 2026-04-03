import * as THREE from 'three'

/** Squared distance from point P to segment AB in 2D. */
export function distPointSegmentSq2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLenSq = abx * abx + aby * aby
  if (abLenSq < 1e-8) return apx * apx + apy * apy
  let t = (apx * abx + apy * aby) / abLenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * abx
  const cy = ay + t * aby
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy
}

export function projectWorldToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  target.copy(worldPos).project(camera)
  const sx = (target.x * 0.5 + 0.5) * width
  const sy = (-target.y * 0.5 + 0.5) * height
  target.set(sx, sy, 0)
  return target
}

export function screenSliceHitSqThreshold(radius: number): number {
  // Scale hit radius loosely with 3D size (arcade-tuned).
  const px = 48 + radius * 95
  return px * px
}

const _rayDir = new THREE.Vector3()
const _planeN = new THREE.Vector3()
const _toCenter = new THREE.Vector3()

/** Ray from camera through NDC to plane y = planeY; returns world point or null. */
export function screenToSlicePlane(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: THREE.PerspectiveCamera,
  planeY: number,
  target: THREE.Vector3,
): THREE.Vector3 | null {
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
  const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera)
  const dir = _rayDir.copy(v).sub(camera.position).normalize()
  if (Math.abs(dir.y) < 1e-5) return null
  const t = (planeY - camera.position.y) / dir.y
  if (t <= 0 || t > 80) return null
  target.copy(camera.position).addScaledVector(dir, t)
  return target
}

/**
 * Stable trail / stroke projection: ray vs plane through `planeCenter` facing the camera.
 * Falls back to horizontal y-plane when the ray is nearly parallel to the play plane.
 */
export function screenToCameraFacingPlane(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: THREE.PerspectiveCamera,
  planeCenter: THREE.Vector3,
  target: THREE.Vector3,
): THREE.Vector3 | null {
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
  const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera)
  const dir = _rayDir.copy(v).sub(camera.position).normalize()

  _planeN.copy(camera.position).sub(planeCenter).normalize()
  const denom = dir.dot(_planeN)
  if (Math.abs(denom) < 0.012) {
    return screenToSlicePlane(clientX, clientY, rect, camera, planeCenter.y, target)
  }
  _toCenter.copy(planeCenter).sub(camera.position)
  const t = _toCenter.dot(_planeN) / denom
  if (t <= 0 || t > 120) {
    return screenToSlicePlane(clientX, clientY, rect, camera, planeCenter.y, target)
  }
  target.copy(camera.position).addScaledVector(dir, t)
  return target
}
