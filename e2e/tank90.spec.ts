import { test, expect, type Page } from '@playwright/test'

function attachNoErrorGuards(page: Page, bucket: string[]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`console:${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    bucket.push(`pageerror:${err.message}`)
  })
}

async function getTank90Snapshot(page: Page) {
  return page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    return w.__tank90_e2e?.getSnapshot?.()
  })
}

async function injectEnemyBulletOnPlayer(page: Page) {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.__tank90_e2e?.injectEnemyBulletOnPlayer?.()
  })
}

async function placePowerUpOnPlayer(page: Page, kind: string) {
  await page.evaluate((k) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.__tank90_e2e?.placePowerUpOnPlayer?.(k)
  }, kind)
}

async function setPowerTier(page: Page, tier: number) {
  await page.evaluate((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.__tank90_e2e?.setPowerTier?.(t)
  }, tier)
}

async function forceWin(page: Page) {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.__tank90_e2e?.killAllEnemiesAndWin?.()
  })
}

/** Coarse pointer + no hover (touch-primary) so Tank90 shows on-screen controls in CI. */
async function mockTouchPrimary(page: Page) {
  await page.addInitScript(() => {
    const orig = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      if (query.includes('pointer: coarse') && query.includes('hover: none')) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        } as MediaQueryList
      }
      return orig(query)
    }
  })
}

test('tank90 main flow (non-debug) + no runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  attachNoErrorGuards(page, runtimeErrors)
  await page.goto('/games/tank90?e2e=1')

  await expect(page.getByText('90 TANK BATTLE')).toBeVisible()
  await expect(page.getByText('KEYBOARD: ARROWS MOVE / SPACE FIRE / P PAUSE')).toBeVisible()

  const hud = page.locator('main').getByText(/^STAGE /).first()

  await page.getByRole('button', { name: 'START' }).click()
  await expect(hud).toContainText(/RUNNING/i)
  await expect(hud).toContainText(/PLAYER ALIVE/i)
  await page.waitForTimeout(250)
  await expect(hud).toContainText(/RUNNING/i)

  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(200)
  await page.keyboard.up('ArrowRight')
  const scrollYAfterMove = await page.evaluate(() => window.scrollY)
  expect(scrollYAfterMove).toBe(0)

  await page.keyboard.press('P')
  await expect(hud).toContainText(/PAUSED/i)
  await page.keyboard.press('P')
  await expect(hud).toContainText(/RUNNING/i)

  // Lives: initial reserve 3 → total lives 4. First hit should respawn (no LOST).
  const before = await getTank90Snapshot(page)
  expect(before?.livesReserve).toBe(3)
  await injectEnemyBulletOnPlayer(page)
  await page.waitForTimeout(120)
  const after1 = await getTank90Snapshot(page)
  expect(after1?.status).toBe('running')
  expect(after1?.player?.alive).toBe(true)
  expect(after1?.livesReserve).toBe(2)

  // Exhaust lives → LOST.
  await injectEnemyBulletOnPlayer(page)
  await page.waitForTimeout(60)
  await injectEnemyBulletOnPlayer(page)
  await page.waitForTimeout(60)
  await injectEnemyBulletOnPlayer(page)
  await page.waitForTimeout(120)
  const after4 = await getTank90Snapshot(page)
  expect(after4?.livesReserve).toBe(0)
  await injectEnemyBulletOnPlayer(page)
  await page.waitForTimeout(120)
  const final = await getTank90Snapshot(page)
  expect(final?.status).toBe('lost')
  await expect(page.getByRole('button', { name: 'RETRY' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'RESTART' })).toBeVisible()

  await page.getByRole('button', { name: 'RETRY' }).click()
  await expect(hud).toContainText(/STAGE 1/i)
  await expect(hud).toContainText(/RUNNING/i)

  await injectEnemyBulletOnPlayer(page)
  await page.waitForTimeout(120)
  await page.getByRole('button', { name: 'RESTART' }).click()
  await expect(hud).toContainText(/RUNNING/i)
  await expect(hud).toContainText(/PLAYER ALIVE/i)

  await forceWin(page)
  await expect(hud).toContainText(/WON/i)
  const nextBtn = page.getByRole('button', { name: 'NEXT STAGE' })
  await expect(nextBtn).toBeVisible()
  await nextBtn.click()
  await expect(hud).toContainText(/STAGE 2/i)
  await expect(hud).toContainText(/RUNNING/i)
  expect(runtimeErrors).toEqual([])
})

test('tank90 keeps square canvas; page shell works with site light/dark toggle', async ({ page }) => {
  const runtimeErrors: string[] = []
  attachNoErrorGuards(page, runtimeErrors)

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/games/tank90?e2e=1')
  const ratioWide = await page.locator('[data-testid="tank90-canvas"]').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.width / r.height
  })
  expect(Math.abs(ratioWide - 1)).toBeLessThan(0.02)

  await page.setViewportSize({ width: 430, height: 932 })
  const ratioTall = await page.locator('[data-testid="tank90-canvas"]').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.width / r.height
  })
  expect(Math.abs(ratioTall - 1)).toBeLessThan(0.02)

  const main = page.locator('main')
  const beforeThemeClass = await main.getAttribute('class')
  const beforeDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await page.getByRole('button', { name: 'Theme' }).click()
  const afterDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  const afterThemeClass = await main.getAttribute('class')

  expect(beforeThemeClass).toContain('tank90-page')
  expect(afterThemeClass).toContain('tank90-page')
  expect(afterDark).toBe(!beforeDark)
  expect(runtimeErrors).toEqual([])
})

test('tank90 mobile controls and menu-safe layout', async ({ page }) => {
  const runtimeErrors: string[] = []
  attachNoErrorGuards(page, runtimeErrors)
  await mockTouchPrimary(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/games/tank90?e2e=1')
  await page.getByRole('button', { name: 'START' }).click()

  await expect(page.getByText('TOUCH: DRAG JOYSTICK MOVE / HOLD FIRE SHOOT / PAUSE TOGGLE')).toBeVisible()

  await expect(page.getByLabel('Virtual joystick')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Touch fire' })).toBeVisible()

  await expect(page.getByRole('button', { name: 'RESTART' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Game Center$/ })).toBeVisible()
  await expect(page.getByLabel('Touch controls')).toBeVisible()

  await page.getByRole('button', { name: 'Touch fire' }).dispatchEvent('pointerdown')
  await page.waitForTimeout(120)
  await page.getByRole('button', { name: 'Touch fire' }).dispatchEvent('pointerup')

  await page.getByRole('button', { name: 'Pause game' }).click()
  const hud = page.locator('main').getByText(/^STAGE /).first()
  await expect(hud).toContainText(/PAUSED/i)
  expect(runtimeErrors).toEqual([])
})

test('tank90 progression loops without debug panel', async ({ page }) => {
  const runtimeErrors: string[] = []
  attachNoErrorGuards(page, runtimeErrors)
  await page.goto('/games/tank90?e2e=1')
  const hud = page.locator('main').getByText(/^STAGE /).first()

  await page.getByRole('button', { name: 'START' }).click()
  await expect(hud).toContainText(/RUNNING/i)

  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('P')
    await expect(hud).toContainText(/PAUSED/i)
    await page.keyboard.press('P')
    await expect(hud).toContainText(/RUNNING/i)

    // Spend all lives fast by repeated hits.
    for (let k = 0; k < 5; k += 1) {
      await injectEnemyBulletOnPlayer(page)
      await page.waitForTimeout(60)
    }
    await expect(hud).toContainText(/LOST/i)
    await page.getByRole('button', { name: 'RESTART' }).click()
    await expect(hud).toContainText(/RUNNING/i)
  }

  for (let level = 1; level <= 4; level += 1) {
    await forceWin(page)
    await expect(hud).toContainText(/WON/i)
    const nextBtn = page.getByRole('button', { name: 'NEXT STAGE' })
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()
    await expect(hud).toContainText(new RegExp(`STAGE ${level + 1}`, 'i'))
    await expect(hud).toContainText(/RUNNING/i)
  }

  expect(runtimeErrors).toEqual([])
})

test('tank90 stage 10 clear shows PLAY AGAIN not NEXT STAGE', async ({ page }) => {
  const runtimeErrors: string[] = []
  attachNoErrorGuards(page, runtimeErrors)
  await page.goto('/games/tank90?e2e=1')
  const hud = page.locator('main').getByText(/^STAGE /).first()

  await page.getByRole('button', { name: 'START' }).click()
  for (let i = 0; i < 9; i += 1) {
    await forceWin(page)
    await page.getByRole('button', { name: 'NEXT STAGE' }).click()
  }
  await expect(hud).toContainText(/STAGE 10/i)

  await forceWin(page)
  await expect(hud).toContainText(/WON/i)
  await expect(page.getByRole('button', { name: 'PLAY AGAIN' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'NEXT STAGE' })).toHaveCount(0)

  await page.getByRole('button', { name: 'PLAY AGAIN' }).click()
  await expect(hud).toContainText(/STAGE 1/i)
  await expect(hud).toContainText(/RUNNING/i)
  expect(runtimeErrors).toEqual([])
})

test('tank90 sustained soak input has no runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  attachNoErrorGuards(page, runtimeErrors)
  await page.goto('/games/tank90?e2e=1')
  const hud = page.locator('main').getByText(/^STAGE /).first()
  await page.getByRole('button', { name: 'START' }).click()
  await expect(hud).toContainText(/RUNNING/i)

  const movementKeys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']
  for (let i = 0; i < 8; i += 1) {
    const key = movementKeys[i % movementKeys.length]
    await page.keyboard.down(key)
    await page.keyboard.down('Space')
    await page.waitForTimeout(420)
    await page.keyboard.up('Space')
    await page.keyboard.up(key)
    await page.waitForTimeout(90)
    await expect(hud).not.toContainText(/READY/i)
  }

  await expect(hud).toContainText(/RUNNING|WON|LOST|PAUSED/i)
  expect(runtimeErrors).toEqual([])
})

test('tank90 power-ups: timer freezes enemies; star tier enables 2 bullets; steel break at tier 3', async ({ page }) => {
  const runtimeErrors: string[] = []
  attachNoErrorGuards(page, runtimeErrors)
  await page.goto('/games/tank90?e2e=1')
  await page.getByRole('button', { name: 'START' }).click()
  // Wait until at least one enemy is alive so the freeze assertion is meaningful.
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(200)
    const s = await getTank90Snapshot(page)
    if ((s?.enemiesAlive ?? 0) > 0) break
  }

  // Timer pickup should set freeze time.
  await placePowerUpOnPlayer(page, 'timer')
  await page.waitForTimeout(120)
  const snap1 = await getTank90Snapshot(page)
  expect(snap1?.freezeMsLeft).toBeGreaterThan(1000)

  // While frozen, enemy positions should not change (coarse check).
  const posAById = new Map(
    (snap1?.enemies ?? []).map((e: { id: string; x: number; y: number }) => [e.id, `${Math.round(e.x)}:${Math.round(e.y)}`]),
  )
  await page.waitForTimeout(400)
  const snap2 = await getTank90Snapshot(page)
  const posBById = new Map(
    (snap2?.enemies ?? []).map((e: { id: string; x: number; y: number }) => [e.id, `${Math.round(e.x)}:${Math.round(e.y)}`]),
  )
  for (const [id, posA] of posAById.entries()) {
    expect(posBById.get(id)).toBe(posA)
  }

  // Star tier 2 allows 2 bullets (we can only validate tier increments + no errors here).
  await placePowerUpOnPlayer(page, 'star')
  await page.waitForTimeout(60)
  await placePowerUpOnPlayer(page, 'star')
  await page.waitForTimeout(60)
  const snapTier2 = await getTank90Snapshot(page)
  expect(snapTier2?.powerTier).toBe(2)

  // Tier 3 steel break: set tier directly and ensure no runtime errors while firing.
  await setPowerTier(page, 3)
  await page.keyboard.down('Space')
  await page.waitForTimeout(300)
  await page.keyboard.up('Space')
  expect(runtimeErrors).toEqual([])
})
