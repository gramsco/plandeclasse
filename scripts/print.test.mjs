// Non-regression test: a plan must print on exactly one A4 landscape page. It drives the real app in Chrome,
// so it is skipped when Chrome is not installed (set CHROME_PATH to point to it).
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium } from 'playwright-core'

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 4174
const outDir = mkdtempSync(path.join(tmpdir(), 'plandeclasse-print-'))
let server
let browser

const pageCount = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length

describe.skipIf(!existsSync(CHROME))('printing', () => {
  beforeAll(async () => {
    execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { stdio: 'ignore' })
    server = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--port', String(PORT), '--strictPort'], {
      stdio: 'ignore',
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    browser = await chromium.launch({ executablePath: CHROME, headless: true })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    server?.kill()
    rmSync(outDir, { recursive: true, force: true })
  })

  it('prints a full plan, with a student note, on a single page', async () => {
    const context = await browser.newContext({ viewport: { width: 1360, height: 860 }, serviceWorkers: 'block' })
    const page = await context.newPage()
    await page.goto(`http://localhost:${PORT}/`)
    await page.getByText('Créer un plan de classe').click()
    await page.locator('.modal select').first().selectOption('demo')
    await page.getByRole('button', { name: 'Créer le plan' }).click()
    await page.waitForFunction(() => document.querySelectorAll('.unplaced img.avatar').length >= 28)
    await page.getByRole('button', { name: /Placer au hasard les restants/ }).click()
    await page.locator('.card-svg').first().click()
    await page.getByLabel(/^Note/).fill('Allergie aux arachides')

    await page.emulateMedia({ media: 'print' })
    expect(pageCount(await page.pdf({ preferCSSPageSize: true }))).toBe(1)
    // The note is shown on hover only: it must not be anywhere in the printed document.
    expect(await page.locator('body').innerText()).not.toContain('Allergie aux arachides')
    await context.close()
  }, 60_000)
})
