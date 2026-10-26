// Generates the screenshots of the user guide: npm run screenshots
// Requires Google Chrome; the script builds the app and serves it on port 4173.
import { spawn, execSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 4173
const URL = `http://localhost:${PORT}/`
const OUT = 'docs/img'

execSync('npm run build', { stdio: 'inherit' })
const serveur = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

const navigateur = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await navigateur.newContext({
  viewport: { width: 1360, height: 860 },
  locale: 'fr-FR',
  serviceWorkers: 'block',
})
const page = await ctx.newPage()
// Deterministic randomness: same screenshots on every run.
await page.addInitScript(() => {
  let a = 42
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
})
page.on('dialog', (d) => d.accept())
page.on('pageerror', (e) => console.error('Erreur page :', e.message))

const shot = (name, target = page) => target.screenshot({ path: `${OUT}/${name}.png` })
const pause = (ms = 400) => page.waitForTimeout(ms)

try {
  await page.goto(URL)
  await page.getByText('Créer mon premier plan').waitFor()
  await shot('01-accueil')

  // New plan: room template preview
  await page.getByText('Créer mon premier plan').click()
  await page.locator('.modal select').first().selectOption('demo')
  await page.locator('.modal select').nth(1).selectOption('template:islands-3x2')
  await page.setViewportSize({ width: 1360, height: 1000 })
  await pause()
  await shot('02-nouveau-plan', page.locator('.modal'))
  await page.setViewportSize({ width: 1360, height: 860 })
  await page.locator('.modal select').nth(1).selectOption('template:doubles-3x5')
  await page.getByRole('button', { name: 'Créer le plan' }).click()
  await page.locator('.room-svg').first().waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.unplaced img.avatar').length >= 28, null, {
    timeout: 20000,
  })
  await pause(600)
  await shot('03-plan-a-placer')

  await page.getByRole('button', { name: /Placer au hasard/ }).click()
  await pause(600)
  await shot('04-plan-place')

  // Print: neutral version (before adding rules and an AESH, for a clean screenshot)
  await page.getByRole('button', { name: 'Version neutre' }).click()
  await page.getByLabel("Aperçu à l'écran").check()
  await pause(500)
  await shot('09-impression-neutre')
  await page.getByLabel("Aperçu à l'écran").uncheck()
  await page.getByRole('button', { name: 'Tout afficher' }).click()

  // Classes: annotations, traffic light, AESH
  await page.getByRole('button', { name: 'Classes (élèves)' }).click()
  await page.getByPlaceholder('Prénom').first().fill('Sam')
  await page.getByRole('button', { name: 'Ajouter un AESH' }).click()
  await page.locator('.card-aesh summary').click()
  await page.locator('.card-aesh .checklist input').first().check()
  await pause()
  await page.evaluate(() => scrollTo(0, 0))
  await pause(200)
  await shot('05-classes')
  await page.locator('.card-aesh').scrollIntoViewIfNeeded()
  await shot('06-aesh', page.locator('.card-aesh'))

  // Plans: rules and alerts
  await page.getByRole('button', { name: 'Plans' }).click()
  await page.getByRole('button', { name: /^Règles/ }).click()
  const form = page.locator('.rule-form')
  await form.locator('select').first().selectOption('colors')
  await form.locator('select').nth(1).selectOption('orange')
  await form.locator('select').nth(2).selectOption('orange')
  await form.getByRole('button', { name: 'Ajouter la règle' }).click()
  await form.locator('select').nth(1).selectOption('red')
  await form.getByRole('button', { name: 'Ajouter la règle' }).click()
  await pause(600)
  await shot('07-regles-alertes')

  // Hypothesis tracking
  await page.getByRole('button', { name: 'Suivi' }).click()
  await page.locator('.tools select').first().selectOption('testing')
  await page.locator('.tools textarea').fill('Semaine 1 : calme au fond, mais Léa et Tom bavardent. À rééquilibrer.')
  await pause(300)
  await shot('08-suivi')
  await page.getByRole('button', { name: /Essayer autre chose/ }).click()
  await page.getByRole('button', { name: 'Suivi' }).click()
  await pause(500)
  await shot('08b-suivi-hypotheses')

  // Rooms: multi-selection
  await page.getByRole('button', { name: 'Salles' }).click()
  await page.locator('.room-svg').waitFor()
  const svg = await page.locator('.room-svg').boundingBox()
  await page.mouse.move(svg.x + svg.width * 0.12, svg.y + svg.height * 0.18)
  await page.mouse.down()
  await page.mouse.move(svg.x + svg.width * 0.55, svg.y + svg.height * 0.62, { steps: 8 })
  await pause(200)
  await shot('10-salle-selection-en-cours')
  await page.mouse.up()
  await pause(300)
  await shot('11-salle-multiselection')

  await shot('12-entete', page.locator('.app-bar'))
} finally {
  await navigateur.close()
  serveur.kill()
}
console.log('Screenshots written to', OUT)
