import * as CANNON from 'cannon-es'

export type PhysicsBundle = {
  world: CANNON.World
}

/** Synchronous physics setup (no WASM init) — avoids Rapier browser aliasing issues in this stack. */
export function createPhysicsWorld(): PhysicsBundle {
  const world = new CANNON.World()
  world.gravity.set(0, -22, 0)
  world.defaultContactMaterial.friction = 0.42
  world.defaultContactMaterial.restitution = 0.08
  return { world }
}
