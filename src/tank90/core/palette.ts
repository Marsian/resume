export interface RenderPalette {
  bg: string
  checker: string
  brickOuter: string
  brickInner: string
  steelOuter: string
  steelInner: string
  grass: string
  ice: string
  waterOuter: string
  waterInner: string
  baseAliveOuter: string
  baseAliveInner: string
  baseAliveAccent: string
  baseDead: string
  playerTank: [string, string, string]
  enemyHeavy: [string, string, string]
  enemySniper: [string, string, string]
  enemyRaider: [string, string, string]
  enemyGrunt: [string, string, string]
  bulletPlayer: string
  bulletEnemy: string
  overlayDim: string
  overlayText: string
  bannerBg: string
  bannerText: string
  shieldStroke: string
  shieldText: string
  hpStrip: string
}

/** Single fixed canvas palette for the playfield (no in-game theme switching). */
export const RENDER_PALETTE: RenderPalette = {
  bg: '#161922',
  checker: '#22293a',
  brickOuter: '#b45d34',
  brickInner: '#d38654',
  steelOuter: '#8f9cb2',
  steelInner: '#6d778b',
  grass: '#4b8f42',
  ice: '#9ecae8',
  waterOuter: '#2f5b9b',
  waterInner: '#4f80c0',
  baseAliveOuter: '#d8c35e',
  baseAliveInner: '#3b2f20',
  baseAliveAccent: '#e8d890',
  baseDead: '#6c3a3a',
  playerTank: ['#53a857', '#2e6f37', '#172518'],
  enemyHeavy: ['#7a4750', '#582a31', '#1f1718'],
  enemySniper: ['#a77d45', '#74552a', '#2a1c0d'],
  enemyRaider: ['#8d5959', '#683737', '#2b1818'],
  enemyGrunt: ['#b85f5f', '#7e3939', '#2b1818'],
  bulletPlayer: '#f8ebbf',
  bulletEnemy: '#ffb178',
  overlayDim: 'rgba(0,0,0,0.52)',
  overlayText: '#f3e0ad',
  bannerBg: 'rgba(0,0,0,0.45)',
  bannerText: '#ffe5a1',
  shieldStroke: '#f4e39e',
  shieldText: '#f4e39e',
  hpStrip: '#f2dd96',
}
