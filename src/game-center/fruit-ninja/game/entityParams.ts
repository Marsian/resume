import type { FruitArchetype } from './spawn'

// Stable per-archetype radii (no randomness). Relative sizes: watermelon largest, cherry smallest.
export const FRUIT_RADIUS: Record<FruitArchetype, number> = {
  // Globally larger fruits; watermelon gets an extra bump.
  watermelon: 1.02,
  pineapple: 0.63,
  coconut: 0.6,
  mango: 0.58,
  pear: 0.57,
  peach: 0.56,
  apple: 0.55,
  orange: 0.54,
  plum: 0.40,
  passionfruit: 0.5,
  lemon: 0.44,
  lime: 0.48,
  kiwi: 0.47,
  strawberry: 0.30,
  banana: 0.53,
  cherry: 0.43,
}

export const BOMB_RADIUS = 0.5

export function fruitMassFromRadius(r: number) {
  return Math.max(0.4, r * r * r * 5.5)
}

