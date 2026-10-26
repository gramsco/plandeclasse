// Usage: node scripts/check-language.mjs [file...]
// Without arguments, checks every tracked source file.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { checkSource, isChecked } from './language-check.mjs'

const requested = process.argv.slice(2)
const files = (
  requested.length
    ? requested
    : execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n')
)
  .filter(Boolean)
  .filter((file) => isChecked(file) && !file.startsWith('node_modules/') && !file.startsWith('dist/'))

let violations = 0
for (const file of files) {
  let source
  try {
    source = readFileSync(file, 'utf8')
  } catch {
    continue // deleted file
  }
  for (const finding of checkSource(file, source)) {
    violations++
    console.error(`${file}:${finding.line}:${finding.column}  ${finding.message}`)
  }
}

if (violations) {
  console.error(`\n${violations} language violation(s). Code and comments must be in English (see CONTRIBUTING.md).`)
  process.exit(1)
}
console.log(`Language check passed (${files.length} files).`)
