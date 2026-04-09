/**
 * Saves wiki banana PNG + full gallery screenshot under assets/verify/ for comparison.
 * Start dev server first: npx vite --host 127.0.0.1 --port 5173
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const verify = join(root, 'src/game-center/fruit-ninja/assets/verify')
mkdirSync(verify, { recursive: true })
copyFileSync(
  join(root, 'src/game-center/fruit-ninja/assets/wiki/banana.png'),
  join(verify, 'wiki-banana-reference.png'),
)

let browser
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
} catch {
  browser = await chromium.launch({ headless: true })
}

const galleryUrl =
  process.env.VITE_GALLERY_URL || 'http://127.0.0.1:5173/games/fruit-ninja/gallery'

const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(galleryUrl, {
  waitUntil: 'networkidle',
  timeout: 90000,
})
await page.waitForTimeout(10000)
await page.screenshot({ path: join(verify, 'gallery-fruit-ninja.png'), fullPage: true })
await browser.close()
console.log('Wrote:', join(verify, 'wiki-banana-reference.png'))
console.log('Wrote:', join(verify, 'gallery-fruit-ninja.png'))
