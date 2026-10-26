import { describe, expect, it } from 'vitest'
import guide from '../../docs/guide.md?raw'
import { renderGuide, slug } from './guide'

const imageFiles = import.meta.glob('../../docs/img/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
const images = Object.fromEntries(
  Object.entries(imageFiles).map(([path, url]) => [path.replace('../../docs/', ''), url]),
)

describe('built-in guide', () => {
  const html = renderGuide(guide, images)

  it('builds slugs like GitHub', () => {
    expect(slug('Les plans : placer, vérifier, tester')).toBe('les-plans--placer-vérifier-tester')
    expect(slug('Sécurité et confidentialité des données')).toBe('sécurité-et-confidentialité-des-données')
  })

  it('every internal link of the table of contents points to a heading', () => {
    const ids = new Set([...html.matchAll(/<h\d id="([^"]+)"/g)].map((m) => m[1]))
    const links = [...guide.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1])
    expect(links.length).toBeGreaterThan(5)
    for (const link of links) expect(ids, `missing anchor: #${link}`).toContain(link)
  })

  it('every referenced screenshot exists', () => {
    const refs = [...guide.matchAll(/!\[[^\]]*\]\((img\/[^)]+)\)/g)].map((m) => m[1])
    expect(refs.length).toBeGreaterThan(5)
    for (const ref of refs) expect(images, `missing screenshot: ${ref}`).toHaveProperty([ref])
    expect(html).not.toContain('src="img/')
  })

  it('opens external links in a new tab and neutralises raw HTML', () => {
    expect(html).toMatch(/<a href="https:\/\/gramsco\.github\.io[^>]*target="_blank"/)
    expect(renderGuide('<script>alert(1)</script>', {})).not.toContain('<script>')
  })
})
