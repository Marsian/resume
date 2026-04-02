import { findDefaultPlayerSpawnPixels, validateAllLevels } from '../src/game-center/tank90/levelValidation'
import { getLevelConfig } from '../src/game-center/tank90/levels'

validateAllLevels()
for (let level = 2; level <= 10; level += 1) {
  const c = getLevelConfig(level)
  const p = findDefaultPlayerSpawnPixels(c)
  console.log(`  ${c.name}: base U-brick + flush bottom OK; player spawn (${p.x}, ${p.y}) clear of all terrain`)
}
console.log('tank90: stages 1–10 OK (grid, enemy spawns, base layout, player spawn vs all terrain)')
