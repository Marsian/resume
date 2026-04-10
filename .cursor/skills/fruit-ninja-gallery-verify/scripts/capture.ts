/**
 * Screenshot the fruit-ninja gallery canvas for one fruit (solo + static pose).
 * Requires a running dev server unless --base-url points elsewhere.
 *
 * From repo root:
 *   npx tsx .cursor/skills/fruit-ninja-gallery-verify/scripts/capture.ts --fruit apple --out /tmp/gallery-apple.png
 *
 * Env: FN_BASE_URL (default http://127.0.0.1:5173)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { chromium } from '@playwright/test'

function parseArgs(): { fruit: string; out: string; baseUrl: string; headed: boolean } {
  const a = process.argv.slice(2)
  let fruit = ''
  let out = ''
  let baseUrl = process.env.FN_BASE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:5173'
  let headed = false
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--headed') {
      headed = true
      continue
    }
    if (a[i] === '--fruit' && a[i + 1]) {
      fruit = a[++i]!
      continue
    }
    if (a[i] === '--out' && a[i + 1]) {
      out = a[++i]!
      continue
    }
    if (a[i] === '--base-url' && a[i + 1]) {
      baseUrl = a[++i]!.replace(/\/$/, '')
      continue
    }
  }
  if (!fruit || !out) {
    console.error(
      'Usage: npx tsx .cursor/skills/fruit-ninja-gallery-verify/scripts/capture.ts --fruit <kind> --out <path.png> [--base-url <url>] [--headed]',
    )
    process.exit(1)
  }
  return { fruit: fruit.toLowerCase(), out: resolve(out), baseUrl, headed }
}

/** Helps WebGL in headless Chromium (SwiftShader/ANGLE); harmless on most desktops. */
const GL_CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
] as const

async function main() {
  const { fruit, out, baseUrl, headed } = parseArgs()
  const url = new URL(`/games/fruit-ninja/gallery?fruit=${encodeURIComponent(fruit)}&static=1`, `${baseUrl}/`)

  const browser = await chromium.launch({ headless: !headed, args: [...GL_CHROMIUM_ARGS] })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  })
  try {
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('[data-testid="fruit-gallery-canvas"]', { state: 'attached', timeout: 60_000 })
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="fruit-gallery-canvas"]') as HTMLCanvasElement | null
        return !!(el && el.width > 32 && el.height > 32)
      },
      { timeout: 30_000 },
    )
    // Let WebGL settle (static mode)
    await page.waitForTimeout(400)

    const buf = await page.locator('[data-testid="fruit-gallery-canvas"]').screenshot({ type: 'png' })
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, buf)
    console.log(`Wrote ${out}`)
    console.log(`Source URL: ${url.href}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
