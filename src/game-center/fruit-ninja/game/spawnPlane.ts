import * as THREE from 'three'

import { SPAWN } from './spawn'

/** Matches slice / trail play focus — plane faces the camera through this point */
export const PLAY_CENTER = new THREE.Vector3(0, 0.55, 0)

const _n = new THREE.Vector3()
const _up = new THREE.Vector3()
const _right = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _vel = new THREE.Vector3()

/**
 * Orthonormal basis on the camera-facing play plane:
 * - `normal`: center → camera (plane faces viewer)
 * - `up`: screen-up projected onto the plane (toss “height” matches canvas vertical)
 * - `right`: screen-right on the plane
 */
function playPlaneAxes(camera: THREE.PerspectiveCamera) {
  _n.copy(camera.position).sub(PLAY_CENTER).normalize()
  _up.copy(camera.up).normalize()
  _up.addScaledVector(_n, -_up.dot(_n))
  if (_up.lengthSq() < 1e-10) {
    _up.set(0, 1, 0).addScaledVector(_n, -_n.y)
  }
  _up.normalize()
  _right.crossVectors(_up, _n).normalize()
  return { n: _n, up: _up, right: _right }
}

/**
 * Spawn below the visible board along `-up`, launch along `+up` (+ lateral + slight `+normal` pop).
 * Uses world gravity (Y only) but initial impulse is aligned with the screen-parallel play plane.
 */
export function sampleSpawnKinematics(camera: THREE.PerspectiveCamera): {
  position: THREE.Vector3
  velocity: THREE.Vector3
} {
  const { n, up, right } = playPlaneAxes(camera)

  const lateral = (Math.random() - 0.5) * 2 * SPAWN.spawnLateralRange
  const below = SPAWN.spawnBelowMin + Math.random() * (SPAWN.spawnBelowMax - SPAWN.spawnBelowMin)
  _pos.copy(PLAY_CENTER).addScaledVector(right, lateral).addScaledVector(up, -below)
  _pos.addScaledVector(n, (Math.random() - 0.5) * 2 * SPAWN.spawnDepthJitter)

  const upSpeed = SPAWN.upVelMin + Math.random() * (SPAWN.upVelMax - SPAWN.upVelMin)
  const sideSpeed = (Math.random() - 0.5) * 2 * SPAWN.sideVelRange
  const pop = SPAWN.normalPopMin + Math.random() * (SPAWN.normalPopMax - SPAWN.normalPopMin)
  _vel.copy(up).multiplyScalar(upSpeed).addScaledVector(right, sideSpeed).addScaledVector(n, pop)

  return { position: _pos.clone(), velocity: _vel.clone() }
}
