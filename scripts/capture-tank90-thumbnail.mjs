import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? 'public/images/tank90-thumb.png'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 900, height: 900 },
    deviceScaleFactor: 1,
  })

  await page.goto(`${BASE_URL}/games/tank90?e2e=1`, { waitUntil: 'domcontentloaded' })

  // Ensure the game starts so the canvas shows active gameplay.
  await page.getByRole('button', { name: 'START', exact: true }).click()
  await page.waitForTimeout(350)

  const canvas = page.locator('[data-testid="tank90-canvas"]')
  await canvas.waitFor({ state: 'visible', timeout: 10_000 })

  const absOut = path.isAbsolute(OUT) ? OUT : path.resolve(process.cwd(), OUT)
  fs.mkdirSync(path.dirname(absOut), { recursive: true })

  await canvas.screenshot({ path: absOut })
  await browser.close()

  // eslint-disable-next-line no-console
  console.log(`Wrote thumbnail: ${absOut}`)
}

await main()

