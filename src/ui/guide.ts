import { Marked } from 'marked'

/** Same rule as GitHub: lowercase, punctuation removed, spaces → dashes (accents are kept). */
export const slug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Turns the Markdown guide into HTML. `images` maps "img/x.png" to its bundled URL. */
export function renderGuide(markdown: string, images: Record<string, string>): string {
  const md = new Marked({
    renderer: {
      // The guide is our own content, but raw HTML is never accepted, as a matter of principle.
      html: ({ text }) => escapeHtml(text),
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens)
        const plain = tokens.map((t) => ('text' in t ? t.text : '')).join('')
        return `<h${depth} id="${slug(plain)}">${html}</h${depth}>\n`
      },
      image({ href, title, text }) {
        const src = images[href] ?? href
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''}>`
      },
      link({ href, title, tokens }) {
        const html = this.parser.parseInline(tokens)
        const external = /^https?:/.test(href)
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${html}</a>`
      },
    },
  })
  return md.parse(markdown, { async: false })
}
