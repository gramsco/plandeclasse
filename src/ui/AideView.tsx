import { useMemo, type MouseEvent } from 'react'
import guide from '../../docs/guide.md?raw'
import { rendreGuide } from './guide'

// Les captures du guide sont empaquetées avec l'application (donc disponibles hors ligne).
const fichiers = import.meta.glob('../../docs/img/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const IMAGES_GUIDE = Object.fromEntries(Object.entries(fichiers).map(([chemin, url]) => [chemin.replace('../../docs/', ''), url]))

export function AideView() {
  const html = useMemo(() => rendreGuide(guide, IMAGES_GUIDE), [])

  // Les liens du sommaire (#section) défilent dans la page, sans changer d'adresse.
  const surClic = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    const href = a?.getAttribute('href')
    if (!href?.startsWith('#')) return
    e.preventDefault()
    document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="aide-page">
      <article className="guide" onClick={surClic} dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}
