// Enforces the language policy (see CONTRIBUTING.md): code and comments are in English;
// only user-facing strings (UI text, messages) are in French.
//
// What is checked, per file type:
//  - .ts .tsx .mjs .js: identifiers, comments, and the titles of describe/it/test blocks
//  - .css: comments
//  - .yml .yaml .sh: comments
// String literals and JSX text are NOT checked: they are the French user interface.
//
// Escape hatches (use sparingly, with a reason):
//  - `lang-ignore` in a comment: skips identifier findings on that line
//  - `lang-ignore-file` in a comment: skips identifier findings in the whole file
//    (for code that must name legacy French fields, such as data migrations)
import { parseSync } from 'oxc-parser'

/** French words that are not English words: if an identifier is made of one of them, it is French. */
const FRENCH_IDENTIFIER_WORDS = new Set([
  'eleve',
  'eleves',
  'salle',
  'salles',
  'classe',
  'regle',
  'regles',
  'feu',
  'feux',
  'meuble',
  'meubles',
  'prenom',
  'nom',
  'noms',
  'genre',
  'affectation',
  'affectations',
  'accompagne',
  'statut',
  'hauteur',
  'largeur',
  'grille',
  'couleur',
  'couleurs',
  'rouge',
  'vert',
  'carte',
  'liste',
  'texte',
  'lien',
  'liens',
  'alerte',
  'alertes',
  'erreur',
  'emprise',
  'aimanter',
  'ajouter',
  'supprimer',
  'renommer',
  'dupliquer',
  'choisir',
  'deplacer',
  'pivoter',
  'vider',
  'remplir',
  'charger',
  'creer',
  'enregistrer',
  'sauvegarde',
  'fichier',
  'onglet',
  'bureau',
  'fantome',
  'cote',
  'allee',
  'diagonale',
  'taille',
  'cle',
  'placer',
  'retirer',
  'definir',
  'basculer',
  'melanger',
  'aleatoire',
])

const ACCENTED = /[àâäçéèêëîïôöùûüÿœæ]/i
/** Function words that only exist in French. Kept short on purpose, to avoid false positives. */
const FRENCH_TEXT =
  /\b(le|la|les|des|une|est|pour|avec|qui|dans|sur|pas|sont|aux|du|cette|mais|donc|chaque|sans|ou|et)\b/i

const SCRIPT_FILE = /\.(ts|tsx|mjs|js)$/
const TEST_BLOCKS = new Set(['describe', 'it', 'test'])

/** Splits an identifier into lowercase words: `addStudent_2` → ['add', 'student']. */
const words = (identifier) =>
  identifier
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_$\d]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)

const looksFrench = (text) => ACCENTED.test(text) || FRENCH_TEXT.test(text)

function lineStarts(source) {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return starts
}

function position(starts, offset) {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (starts[mid] <= offset) low = mid
    else high = mid - 1
  }
  return { line: low + 1, column: offset - starts[low] + 1 }
}

/** Finds French in comments of non-JS files, line by line. */
function checkLineComments(source, marker) {
  const findings = []
  source.split('\n').forEach((text, index) => {
    const at = text.search(marker)
    if (at === -1) return
    const comment = text.slice(at)
    if (looksFrench(comment))
      findings.push({ line: index + 1, column: at + 1, message: `French in comment: ${comment.trim()}` })
  })
  return findings
}

function checkCss(source) {
  const findings = []
  const starts = lineStarts(source)
  for (const match of source.matchAll(/\/\*[\s\S]*?\*\//g)) {
    if (looksFrench(match[0]))
      findings.push({ ...position(starts, match.index), message: `French in comment: ${match[0].slice(0, 60)}` })
  }
  return findings
}

function checkScript(filename, source) {
  const findings = []
  const starts = lineStarts(source)
  const { program, comments } = parseSync(filename, source)
  const ignoreFile = comments.some((c) => c.value.includes('lang-ignore-file'))
  const ignoredLines = new Set(
    comments.filter((c) => /lang-ignore\b(?!-file)/.test(c.value)).map((c) => position(starts, c.start).line),
  )
  const report = (offset, message, { identifier = false } = {}) => {
    const { line, column } = position(starts, offset)
    if (identifier && (ignoreFile || ignoredLines.has(line))) return
    findings.push({ line, column, message })
  }

  for (const comment of comments) {
    if (looksFrench(comment.value) && !comment.value.includes('lang-ignore'))
      report(comment.start, `French in comment: ${comment.value.trim().slice(0, 60)}`)
  }

  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if (
      (node.type === 'Identifier' || node.type === 'JSXIdentifier' || node.type === 'PrivateIdentifier') &&
      node.name
    ) {
      const bad = ACCENTED.test(node.name)
        ? 'accented character'
        : words(node.name).find((w) => FRENCH_IDENTIFIER_WORDS.has(w))
      if (bad)
        report(node.start, `French identifier "${node.name}" (${bad === 'accented character' ? bad : `"${bad}"`})`, {
          identifier: true,
        })
    }
    if (node.type === 'CallExpression') {
      let callee = node.callee
      while (callee?.type === 'CallExpression') callee = callee.callee // it.each(...)(title)
      if (callee?.type === 'MemberExpression') callee = callee.object
      const title = node.arguments?.[0]
      if (callee?.type === 'Identifier' && TEST_BLOCKS.has(callee.name) && title) {
        const text = title.type === 'TemplateLiteral' ? title.quasis.map((q) => q.value.cooked).join('') : title.value
        if (typeof text === 'string' && looksFrench(text)) report(title.start, `French test title: ${text}`)
      }
    }
    for (const key of Object.keys(node)) if (key !== 'loc') visit(node[key])
  }
  visit(program)
  return findings
}

/** Returns the violations of the language policy in `source`, as `{ line, column, message }`. */
export function checkSource(filename, source) {
  if (SCRIPT_FILE.test(filename)) return checkScript(filename, source)
  if (filename.endsWith('.css')) return checkCss(source)
  if (/\.(ya?ml|sh)$/.test(filename) || filename.endsWith('pre-commit')) return checkLineComments(source, /(^|\s)#/)
  return []
}

export const isChecked = (filename) =>
  /\.(ts|tsx|mjs|js|css|ya?ml|sh)$/.test(filename) || filename.endsWith('pre-commit')
