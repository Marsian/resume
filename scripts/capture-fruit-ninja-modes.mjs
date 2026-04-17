import { firefox } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const OUT_DIR = process.env.OUT_DIR ?? 'output/fruit-ninja-modes'

async function swipeCenter(page, locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('target box missing')
  const y = box.y + box.height * 0.5
  const x0 = box.x + box.width * 0.25
  const x1 = box.x + box.width * 0.75
  await page.mouse.move(x0, y)
  await page.mouse.down()
  await page.mouse.move(x1, y, { steps: 18 })
  await page.mouse.up()
}

async function main() {
  const out = path.resolve(process.cwd(), OUT_DIR)
  fs.mkdirSync(out, { recursive: true })

  const browser = await firefox.launch({ headless: false })
  const page = await browser.newPage({ viewport: { width: 1280, height: 980 }, deviceScaleFactor: 2 })

  // 1) Home
  await page.goto(`${BASE_URL}/games/fruit-ninja`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="fruit-ninja-home-start-ring"]').waitFor({ state: 'visible' })
  await page.locator('[data-testid="fruit-ninja-home-settings-ring"]').waitFor({ state: 'visible' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(out, '01-home.png') })

  // 2) Classic in-play (slice watermelon / start ring)
  const startRing = page.locator('[data-testid="fruit-ninja-home-start-ring"]')
  await swipeCenter(page, startRing)
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(out, '02-classic-playing.png') })

  // 3) Zen in-play (slice apple / right ring)
  await page.goto(`${BASE_URL}/games/fruit-ninja?debugZenDurationMs=2500`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="fruit-ninja-home-settings-ring"]').waitFor({ state: 'visible' })
  const zenRing = page.locator('[data-testid="fruit-ninja-home-settings-ring"]')
  await swipeCenter(page, zenRing)
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(out, '03-zen-playing.png') })

  // 4) Zen game over (auto time up)
  await page.waitForTimeout(3000)
  await page.locator('[data-testid="fruit-ninja-gameover-score-board"]').waitFor({ state: 'visible', timeout: 10000 })
  await page.screenshot({ path: path.join(out, '04-zen-gameover.png') })

  await browser.close()
  console.log(`saved screenshots to ${out}`)
}

await main()
