import { firefox } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT_DIR = process.env.OUT_DIR ?? 'test-results/fruit-ninja'

async function main() {
  const absDir = path.isAbsolute(OUT_DIR) ? OUT_DIR : path.resolve(process.cwd(), OUT_DIR)
  fs.mkdirSync(absDir, { recursive: true })

  const browser = await firefox.launch({ headless: false })
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1000 },
    deviceScaleFactor: 2,
  })

  // Collect browser console messages
  const logs = []
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => logs.push(`[ERROR] ${err.message}`))

  // 1) Gallery page — grid of all fruits (should match in-game mesh/material pipeline).
  await page.goto(`${BASE_URL}/games/fruit-ninja/gallery`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.locator('[data-testid="fruit-gallery-canvas"]').waitFor({ state: 'visible', timeout: 15_000 })
  await page.screenshot({ path: path.join(absDir, 'all-fruits.png'), fullPage: false })
  console.log('Captured all-fruits.png')

  // 2) Game page — capture the home screen render (starter fruit + dojo backdrop).
  await page.goto(`${BASE_URL}/games/fruit-ninja`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.locator('[data-testid="fruit-ninja-canvas"]').waitFor({ state: 'visible', timeout: 15_000 })
  await page.screenshot({ path: path.join(absDir, 'game-home.png'), fullPage: false })
  console.log('Captured game-home.png')

  // Print any browser console output
  if (logs.length) console.log('\nBrowser console:', logs.join('\n'))

  await browser.close()
  console.log(`\nDone — screenshots saved in ${absDir}`)
}

await main()
