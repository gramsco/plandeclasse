import { useMemo, type MouseEvent } from 'react'
import guide from '../../docs/guide.md?raw'
import { renderGuide } from './guide'

// The guide's screenshots are bundled with the application, so they work offline.
const imageFiles = import.meta.glob('../../docs/img/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>
export const GUIDE_IMAGES = Object.fromEntries(
  Object.entries(imageFiles).map(([path, url]) => [path.replace('../../docs/', ''), url]),
)

export function HelpView() {
  const html = useMemo(() => renderGuide(guide, GUIDE_IMAGES), [])

  // Table-of-contents links (#section) scroll within the page, without changing the address.
  const onClick = (e: MouseEvent) => {
    const href = (e.target as HTMLElement).closest('a')?.getAttribute('href')
    if (!href?.startsWith('#')) return
    e.preventDefault()
    document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="help-page">
      <article className="guide" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}
