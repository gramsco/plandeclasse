// Screenshot of the 3D view for the release notes: npm run release-screenshot [seed]
// Names and faces are made up from a seed, so the image shows nobody real and differs from the guide's demo class.
// Requires Google Chrome; the script builds the app and serves it on port 4175.
import { spawn, execSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 4175
const OUT = process.argv[3] ?? 'docs/img/release-vue-3d.png'
const SEED = Number(process.argv[2] ?? Date.now() % 100000)
console.log(`Seed: ${SEED} (pass it again to get the same image)`)

const FIRST_NAMES = [
  'Agathe',
  'Alexis',
  'Baptiste',
  'Capucine',
  'Clément',
  'Dylan',
  'Eliott',
  'Fanny',
  'Garance',
  'Hanna',
  'Ismaël',
  'Jeanne',
  'Kylian',
  'Lola',
  'Malo',
  'Nora',
  'Océane',
  'Paul',
  'Quentin',
  'Romane',
  'Samuel',
  'Thaïs',
  'Valentin',
  'Yasmine',
  'Axel',
  'Bastien',
  'Célia',
  'Diane',
  'Enzo',
  'Flore',
]
const LAST_NAMES = [
  'Arnaud',
  'Barbier',
  'Blanc',
  'Chevalier',
  'Collin',
  'Fabre',
  'Gauthier',
  'Guérin',
  'Henry',
  'Jacob',
  'Klein',
  'Lemaire',
  'Marchand',
  'Noël',
  'Olivier',
  'Perrin',
  'Renard',
  'Schmitt',
  'Tessier',
  'Vidal',
  'Weber',
  'Aubert',
  'Brun',
  'Carpentier',
  'Delmas',
  'Esteban',
  'Fontaine',
  'Giraud',
  'Hamon',
  'Lacroix',
]

const seeded = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = seeded(SEED)
const shuffled = (list) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
const firstNames = shuffled(FIRST_NAMES)
const lastNames = shuffled(LAST_NAMES)
const names = Array.from({ length: 28 }, (_, i) => `${firstNames[i]} ${lastNames[i]}`)

execSync('npm run build', { stdio: 'inherit' })
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))

// Software WebGL: headless Chrome has no GPU.
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({
  viewport: { width: 1360, height: 860 },
  locale: 'fr-FR',
  serviceWorkers: 'block',
})
const page = await context.newPage()
// The app's own randomness (faces, traffic lights, seating) follows the same seed.
await page.addInitScript((seed) => {
  let a = seed >>> 0
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}, SEED)
page.on('dialog', (d) => d.accept())
page.on('pageerror', (e) => console.error('Page error:', e.message))

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.getByText('Créer un plan de classe').waitFor()
  await page.getByRole('button', { name: 'Classes (élèves)' }).click()
  await page.getByRole('button', { name: '+ Nouvelle classe' }).click()
  await page.getByPlaceholder('6e A').fill('5e B')
  await page.getByLabel("Nombre d'élèves à créer").fill('0')
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.getByRole('button', { name: 'Coller une liste' }).click()
  await page.getByPlaceholder(/Une ligne par élève/).fill(names.join('\n'))
  await page.locator('.bulk').getByRole('button', { name: 'Importer' }).click()
  await page.locator('.test-tools summary').click()
  await page.getByRole('button', { name: 'Photos fictives' }).click()
  await page.getByRole('button', { name: 'Feux aléatoires' }).click()
  await page.locator('.modal').getByRole('button', { name: 'Remplacer' }).click()
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: 'Plans' }).click()
  await page.getByRole('button', { name: '+ Nouveau plan' }).click()
  await page.locator('.modal select').nth(1).selectOption('template:doubles-3x5')
  await page.getByRole('button', { name: 'Créer le plan' }).click()
  await page.locator('.room-svg').first().waitFor()
  await page.getByRole('button', { name: /Placer au hasard/ }).click()
  await page.waitForTimeout(600)

  await page.getByRole('button', { name: 'Vue 3D' }).click()
  await page.locator('.scene3d-host canvas').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: 'Vue libre' }).click()
  await page.waitForTimeout(2000) // photos load into the textures
  await page.locator('.modal').screenshot({ path: OUT })
  console.log(`Written: ${OUT}`)
} catch (error) {
  await page.screenshot({ path: '/tmp/release-screenshot-failure.png' })
  throw error
} finally {
  await browser.close()
  server.kill()
}
