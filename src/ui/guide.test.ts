import { describe, expect, it } from 'vitest'
import guide from '../../docs/guide.md?raw'
import { rendreGuide, slug } from './guide'

const fichiers = import.meta.glob('../../docs/img/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const images = Object.fromEntries(Object.entries(fichiers).map(([c, u]) => [c.replace('../../docs/', ''), u]))

describe('guide intégré', () => {
  const html = rendreGuide(guide, images)

  it('slug comme GitHub', () => {
    expect(slug('Les plans : placer, vérifier, tester')).toBe('les-plans--placer-vérifier-tester')
    expect(slug('Sécurité et confidentialité des données')).toBe('sécurité-et-confidentialité-des-données')
  })

  it('tous les liens internes du sommaire pointent vers un titre', () => {
    const ids = new Set([...html.matchAll(/<h\d id="([^"]+)"/g)].map((m) => m[1]))
    const liens = [...guide.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1])
    expect(liens.length).toBeGreaterThan(5)
    for (const l of liens) expect(ids, `ancre manquante : #${l}`).toContain(l)
  })

  it('toutes les captures référencées existent', () => {
    const refs = [...guide.matchAll(/!\[[^\]]*\]\((img\/[^)]+)\)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(5)
    for (const r of refs) expect(images, `capture manquante : ${r}`).toHaveProperty([r])
    expect(html).not.toContain('src="img/')
  })

  it('les liens externes s\'ouvrent dans un nouvel onglet et le HTML brut est neutralisé', () => {
    expect(html).toMatch(/<a href="https:\/\/gramsco\.github\.io[^>]*target="_blank"/)
    expect(rendreGuide('<script>alert(1)</script>', {})).not.toContain('<script>')
  })
})
