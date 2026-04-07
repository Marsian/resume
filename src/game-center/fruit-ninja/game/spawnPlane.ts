import * as THREE from 'three'

import { screenToCameraFacingPlane } from './slice'
import { SPAWN } from './spawn'

/** Matches slice / trail play focus — plane faces the camera through this point */
export const PLAY_CENTER = new THREE.Vector3(0, 0.55, 0)

const _n = new THREE.Vector3()
const _up = new THREE.Vector3()
const _right = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _vel = new THREE.Vector3()
const _lateralDelta = new THREE.Vector3()

/**
 * Orthonormal basis on the camera-facing play plane:
 * - `normal`: center → camera (plane faces viewer)
 * - `up`: screen-up projected onto the plane (toss “height” matches canvas vertical)
 * - `right`: screen-right on the plane
 */
export function fillPlayPlaneBasis(
  camera: THREE.PerspectiveCamera,
  planeCenter: THREE.Vector3,
  n: THREE.Vector3,
  up: THREE.Vector3,
  right: THREE.Vector3,
): void {
  n.copy(camera.position).sub(planeCenter).normalize()
  up.copy(camera.up).normalize()
  up.addScaledVector(n, -up.dot(n))
  if (up.lengthSq() < 1e-10) {
    up.set(0, 1, 0).addScaledVector(n, -n.y)
  }
  up.normalize()
  right.crossVectors(up, n).normalize()
}

function playPlaneAxes(camera: THREE.PerspectiveCamera, planeCenter: THREE.Vector3) {
  fillPlayPlaneBasis(camera, planeCenter, _n, _up, _right)
  return { n: _n, up: _up, right: _right }
}

function spawnPositionFromScreenBottom(
  camera: THREE.PerspectiveCamera,
  planeCenter: THREE.Vector3,
  layoutRect: DOMRect,
  { n, right }: { n: THREE.Vector3; right: THREE.Vector3 },
): boolean {
  const inset = SPAWN.screenBottomHorizontalInset
  const u = inset + Math.random() * Math.max(0.02, 1 - inset * 2)
  const clientX = layoutRect.left + u * layoutRect.width
  const insetPx =
    SPAWN.screenBottomInsetPxMin +
    Math.random() * (SPAWN.screenBottomInsetPxMax - SPAWN.screenBottomInsetPxMin)
  const clientY = layoutRect.bottom - insetPx
  const hit = screenToCameraFacingPlane(clientX, clientY, layoutRect, camera, planeCenter, _pos)
  if (!hit) return false
  _pos.addScaledVector(n, (Math.random() - 0.5) * 2 * SPAWN.spawnDepthJitter)
  _pos.addScaledVector(right, (Math.random() - 0.5) * 0.22)
  return true
}

function spawnPositionFallback(camera: THREE.PerspectiveCamera, planeCenter: THREE.Vector3) {
  const { n, up, right } = playPlaneAxes(camera, planeCenter)
  const lateral = (Math.random() - 0.5) * 2 * SPAWN.spawnLateralRange
  const below = SPAWN.spawnBelowMin + Math.random() * (SPAWN.spawnBelowMax - SPAWN.spawnBelowMin)
  _pos.copy(planeCenter).addScaledVector(right, lateral).addScaledVector(up, -below)
  _pos.addScaledVector(n, (Math.random() - 0.5) * 2 * SPAWN.spawnDepthJitter)
}

/**
 * Spawn on the play plane at the screen-bottom edge (camera ray through canvas bottom), toss along `+up`.
 * Falls back to a deep “below center” offset if the canvas rect or ray/plane hit is unavailable.
 */
export function sampleSpawnKinematics(
  camera: THREE.PerspectiveCamera,
  planeCenter: THREE.Vector3,
  layoutRect: DOMRect | null,
): {
  position: THREE.Vector3
  velocity: THREE.Vector3
} {
  const axes = playPlaneAxes(camera, planeCenter)
  const { n, up, right } = axes

  const okRect =
    layoutRect != null && layoutRect.width > 4 && layoutRect.height > 4 && layoutRect.bottom > layoutRect.top
  if (!okRect || !spawnPositionFromScreenBottom(camera, planeCenter, layoutRect, axes)) {
    spawnPositionFallback(camera, planeCenter)
  }

  const upSpeed =
    Math.random() < SPAWN.peakArcChance
      ? SPAWN.upVelPeakMin + Math.random() * (SPAWN.upVelPeakMax - SPAWN.upVelPeakMin)
      : SPAWN.upVelMin + Math.random() * (SPAWN.upVelMax - SPAWN.upVelMin)
  _lateralDelta.copy(_pos).sub(planeCenter)
  const lateralSigned = _lateralDelta.dot(right)
  const towardCenter =
    -lateralSigned * SPAWN.sideTowardCenterPerWorldUnit
  const sideSpeed = towardCenter + (Math.random() - 0.5) * 2 * SPAWN.sideVelRange
  const nJ = (Math.random() - 0.5) * 2 * SPAWN.normalVelJitter
  _vel.copy(up).multiplyScalar(upSpeed).addScaledVector(right, sideSpeed).addScaledVector(n, nJ)

  return { position: _pos.clone(), velocity: _vel.clone() }
}
