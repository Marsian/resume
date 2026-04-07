/**
 * Resize viewport 500..1900 (step 100), screenshot home, assert rings stay inside playfield and do not overlap.
 * Run: npx tsx scripts/fn-home-layout-sweep.ts
 * Requires dev server: npm run dev (vite default port 5173) or set FN_BASE_URL.
 */
import { chromium } from '@playwright/test'

import { computeGameOverLayout, computeHomeRingLayout } from '../src/game-center/fruit-ninja/homeMenuLayout'

const BASE = process.env.FN_BASE_URL ?? 'http://127.0.0.1:5173/games/fruit-ninja'
const EPS = 2

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(a.x + a.width <= b.x + EPS || b.x + b.width <= a.x + EPS || a.y + a.height <= b.y + EPS || b.y + b.height <= a.y + EPS)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const out: string[] = []

  for (let vw = 500; vw <= 1900; vw += 100) {
    const page = await browser.newPage({ viewport: { width: vw, height: 960 } })
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('[data-testid="fruit-ninja-home-start-ring"]', { timeout: 30_000 })
    await page.waitForTimeout(400)

    const pf = await page.locator('[data-testid="fruit-ninja-playfield"]').boundingBox()
    const start = await page.locator('[data-testid="fruit-ninja-home-start-ring"]').boundingBox()
    const settings = await page.locator('[data-testid="fruit-ninja-home-settings-ring"]').boundingBox()

    if (!pf || !start || !settings) {
      out.push(`${vw} FAIL missing box pf=${!!pf} start=${!!start} settings=${!!settings}`)
      await page.screenshot({ path: `test-results/fn-sweep/w-${vw}.png`, fullPage: true })
      await page.close()
      continue
    }

    const rel = (r: NonNullable<typeof start>) => ({
      x: r.x - pf.x,
      y: r.y - pf.y,
      width: r.width,
      height: r.height,
    })
    const s = rel(start)
    const g = rel(settings)

    const issues: string[] = []
    if (s.x < -EPS) issues.push(`start left overflow ${s.x}`)
    if (s.x + s.width > pf.width + EPS) issues.push(`start right overflow ${s.x + s.width} > ${pf.width}`)
    if (g.x < -EPS) issues.push(`settings left overflow ${g.x}`)
    if (g.x + g.width > pf.width + EPS) issues.push(`settings right overflow ${g.x + g.width} > ${pf.width}`)

    if (rectsOverlap(s, g)) issues.push('rings AABB overlap')

    const math = computeHomeRingLayout(pf.width, pf.height)
    const duStart = Math.abs(s.x + s.width / 2 - math.uStart * pf.width)
    const duSet = Math.abs(g.x + g.width / 2 - math.uSettings * pf.width)
    if (duStart > 2.5) issues.push(`start cx drift ${duStart}px vs math`)
    if (duSet > 2.5) issues.push(`settings cx drift ${duSet}px vs math`)

    const dwS = Math.abs(s.width - math.startRingPx)
    const dwG = Math.abs(g.width - math.settingsRingPx)
    if (dwS > 2.5) issues.push(`start size drift ${dwS}px`)
    if (dwG > 2.5) issues.push(`settings size drift ${dwG}px`)

    await page.screenshot({ path: `test-results/fn-sweep/w-${vw}.png`, fullPage: true })
    await page.close()

    out.push(`${vw}w viewport playfield=${pf.width.toFixed(0)}x${pf.height.toFixed(0)} ${issues.length ? 'FAIL ' + issues.join('; ') : 'OK'}`)
  }

  for (let vw = 500; vw <= 1900; vw += 100) {
    const page = await browser.newPage({ viewport: { width: vw, height: 960 } })
    await page.goto(`${BASE}?debugGameOver=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('[data-testid="fruit-ninja-gameover-retry"]', { timeout: 30_000 })
    await page.waitForTimeout(400)

    const pf = await page.locator('[data-testid="fruit-ninja-playfield"]').boundingBox()
    const retryRing = await page.locator('[data-testid="fruit-ninja-gameover-retry-ring"]').boundingBox()
    const quitRing = await page.locator('[data-testid="fruit-ninja-gameover-quit-ring"]').boundingBox()
    const scoreBoard = await page.locator('[data-testid="fruit-ninja-gameover-score-board"]').boundingBox()

    if (!pf || !retryRing || !quitRing || !scoreBoard) {
      out.push(
        `${vw} GO FAIL missing box pf=${!!pf} retryRing=${!!retryRing} quitRing=${!!quitRing} board=${!!scoreBoard}`,
      )
      await page.screenshot({ path: `test-results/fn-sweep/gameover-w-${vw}.png`, fullPage: true })
      await page.close()
      continue
    }

    const rel = (r: NonNullable<typeof retryRing>) => ({
      x: r.x - pf.x,
      y: r.y - pf.y,
      width: r.width,
      height: r.height,
    })
    const a = rel(retryRing)
    const b = rel(quitRing)
    const boardRel = rel(scoreBoard)
    const issues: string[] = []
    if (a.x < -EPS) issues.push(`retry left overflow ${a.x}`)
    if (a.x + a.width > pf.width + EPS) issues.push(`retry right overflow ${a.x + a.width} > ${pf.width}`)
    if (b.x < -EPS) issues.push(`quit left overflow ${b.x}`)
    if (b.x + b.width > pf.width + EPS) issues.push(`quit right overflow ${b.x + b.width} > ${pf.width}`)
    if (rectsOverlap(a, b)) issues.push('gameover rings AABB overlap')

    const boardBottom = boardRel.y + boardRel.height
    const ringTop = Math.min(a.y, b.y)
    if (boardBottom > ringTop - 6) {
      issues.push(`score panel overlaps rings bottom=${boardBottom.toFixed(1)} ringTop=${ringTop.toFixed(1)}`)
    }

    const mathGo = computeGameOverLayout(pf.width, pf.height)
    const duR = Math.abs(a.x + a.width / 2 - mathGo.uRetry * pf.width)
    const duQ = Math.abs(b.x + b.width / 2 - mathGo.uQuit * pf.width)
    if (duR > 2.5) issues.push(`retry ring cx drift ${duR}px`)
    if (duQ > 2.5) issues.push(`quit ring cx drift ${duQ}px`)
    const dwR = Math.abs(a.width - mathGo.ringPx)
    if (dwR > 2.5) issues.push(`ring size drift ${dwR}px`)

    await page.screenshot({ path: `test-results/fn-sweep/gameover-w-${vw}.png`, fullPage: true })
    await page.close()

    out.push(`${vw}w GO viewport playfield=${pf.width.toFixed(0)}x${pf.height.toFixed(0)} ${issues.length ? 'FAIL ' + issues.join('; ') : 'OK'}`)
  }

  await browser.close()
  console.log(out.join('\n'))
  if (out.some((l) => l.includes('FAIL'))) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
