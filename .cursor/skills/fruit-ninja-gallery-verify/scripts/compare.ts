/**
 * Compare a gallery render PNG to a wiki reference PNG using Playwright + browser Canvas
 * (no extra npm dependencies beyond @playwright/test).
 *
 * From repo root:
 *   npx tsx .cursor/skills/fruit-ninja-gallery-verify/scripts/compare.ts \
 *     --render /tmp/gallery-apple.png \
 *     --wiki src/game-center/fruit-ninja/assets/wiki/apple.png \
 *     --out-diff /tmp/apple-diff.png \
 *     --out-report /tmp/apple-report.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

type Report = {
  fruit?: string
  renderPath: string
  wikiPath: string
  compareWidth: number
  compareHeight: number
  totalPixelsCompared: number
  differingPixels: number
  mismatchPercent: number
  diffPath: string
  note: string
}

function parseArgs(): {
  render: string
  wiki: string
  outDiff: string
  outReport: string
  fruit: string | undefined
} {
  const a = process.argv.slice(2)
  let render = ''
  let wiki = ''
  let outDiff = ''
  let outReport = ''
  let fruit: string | undefined
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--render' && a[i + 1]) {
      render = a[++i]!
      continue
    }
    if (a[i] === '--wiki' && a[i + 1]) {
      wiki = a[++i]!
      continue
    }
    if (a[i] === '--out-diff' && a[i + 1]) {
      outDiff = a[++i]!
      continue
    }
    if (a[i] === '--out-report' && a[i + 1]) {
      outReport = a[++i]!
      continue
    }
    if (a[i] === '--fruit' && a[i + 1]) {
      fruit = a[++i]!
      continue
    }
  }
  if (!render || !wiki || !outDiff || !outReport) {
    console.error(
      'Usage: npx tsx .../compare.ts --render <render.png> --wiki <wiki.png> --out-diff <diff.png> --out-report <report.json> [--fruit <kind>]',
    )
    process.exit(1)
  }
  return {
    render: resolve(render),
    wiki: resolve(wiki),
    outDiff: resolve(outDiff),
    outReport: resolve(outReport),
    fruit,
  }
}

async function main() {
  const { render, wiki, outDiff, outReport, fruit } = parseArgs()
  const renderB64 = readFileSync(render).toString('base64')
  const wikiB64 = readFileSync(wiki).toString('base64')

  const { default: compareInBrowser } = await import(
    new URL('./compare-browser.mjs', import.meta.url).href
  )

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto('about:blank')
    const metrics = (await page.evaluate(compareInBrowser, [
      renderB64,
      wikiB64,
    ])) as {
      mismatchPercent: number
      compareWidth: number
      compareHeight: number
      totalPixelsCompared: number
      differingPixels: number
      diffPngBase64: string
    }

    writeFileSync(outDiff, Buffer.from(metrics.diffPngBase64, 'base64'))

    const report: Report = {
      ...(fruit ? { fruit } : {}),
      renderPath: render,
      wikiPath: wiki,
      compareWidth: metrics.compareWidth,
      compareHeight: metrics.compareHeight,
      totalPixelsCompared: metrics.totalPixelsCompared,
      differingPixels: metrics.differingPixels,
      mismatchPercent: Math.round(metrics.mismatchPercent * 100) / 100,
      diffPath: outDiff,
      note:
        'Pixel diff at 512² after scaling both images; threshold 14 per RGBA channel. Use as a rough signal; multimodal review decides perceived fidelity.',
    }
    writeFileSync(outReport, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
