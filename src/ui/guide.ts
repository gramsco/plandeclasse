import { Marked } from 'marked'

/** Même règle que GitHub : minuscules, ponctuation retirée, espaces → tirets (les accents restent). */
export const slug = (texte: string) =>
  texte
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Transforme le guide Markdown en HTML. `images` associe « img/x.png » à son URL empaquetée. */
export function rendreGuide(markdown: string, images: Record<string, string>): string {
  const md = new Marked({
    renderer: {
      // Le guide est notre propre contenu, mais on n'accepte aucun HTML brut par principe.
      html: ({ text }) => echapper(text),
      heading({ tokens, depth }) {
        const texte = this.parser.parseInline(tokens)
        const brut = tokens.map((t) => ('text' in t ? t.text : '')).join('')
        return `<h${depth} id="${slug(brut)}">${texte}</h${depth}>\n`
      },
      image({ href, title, text }) {
        const src = images[href] ?? href
        return `<img src="${echapper(src)}" alt="${echapper(text)}"${title ? ` title="${echapper(title)}"` : ''}>`
      },
      link({ href, title, tokens }) {
        const texte = this.parser.parseInline(tokens)
        const externe = /^https?:/.test(href)
        return `<a href="${echapper(href)}"${title ? ` title="${echapper(title)}"` : ''}${externe ? ' target="_blank" rel="noopener noreferrer"' : ''}>${texte}</a>`
      },
    },
  })
  return md.parse(markdown, { async: false })
}
