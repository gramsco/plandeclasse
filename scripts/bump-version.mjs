// Semantic versioning driven by the commit message (Conventional Commits).
// Used by the `post-commit` git hook: node scripts/bump-version.mjs
// (a `commit-msg` hook cannot do it: files it stages do not make it into the commit, so the hook
// bumps the version right after the commit and folds the change into it with an amend).
//
//   feat:                      → minor   (0.3.0 → 0.4.0)
//   fix: / perf:               → patch   (0.3.0 → 0.3.1)
//   type!: / BREAKING CHANGE   → major   (1.2.3 → 2.0.0), minor while the version is 0.x
//   docs, test, chore, refactor, style, ci, build… → no new version
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const HEADER = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)/

/** The kind of release a commit message asks for: 'major' | 'minor' | 'patch' | null. */
export function bumpKind(message) {
  const lines = message.split(/\r?\n/).filter((line) => !line.startsWith('#'))
  const header = HEADER.exec(lines[0]?.trim() ?? '')
  if (!header) return null
  const [, type, , bang] = header
  if (bang || lines.some((line) => /^BREAKING[ -]CHANGE:/.test(line))) return 'major'
  if (type === 'feat') return 'minor'
  if (type === 'fix' || type === 'perf') return 'patch'
  return null
}

/** Next version. While the major is 0, a breaking change only bumps the minor. */
export function bumpVersion(version, kind) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`Not a plain semver version: ${version}`)
  let [major, minor, patch] = match.slice(1).map(Number)
  if (kind === 'major' && major === 0) kind = 'minor'
  if (kind === 'major') [major, minor, patch] = [major + 1, 0, 0]
  else if (kind === 'minor') [minor, patch] = [minor + 1, 0]
  else patch += 1
  return `${major}.${minor}.${patch}`
}

/** Adds the heading of a new version (with the commit subject) on top of the release notes. */
export function addReleaseNote(notes, version, date, subject) {
  if (new RegExp(`^## ${version.replaceAll('.', '\\.')}\\b`, 'm').test(notes)) return notes
  const entry = `## ${version} — ${date}\n\n- ${subject}\n\n`
  const firstVersion = notes.search(/^## /m)
  return firstVersion === -1
    ? `${notes.trimEnd()}\n\n${entry}`.trimStart()
    : notes.slice(0, firstVersion) + entry + notes.slice(firstVersion)
}

const run = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

function main() {
  if (process.env.SKIP_VERSION_BUMP === '1') return
  const root = run(process.cwd(), ['rev-parse', '--show-toplevel'])
  // Only plain commits: not the first one, an amend, a merge, a cherry-pick…
  if (!/^commit:/.test(run(root, ['reflog', '-1', '--format=%gs']))) return
  if (run(root, ['rev-list', '--parents', '-n', '1', 'HEAD']).split(' ').length !== 2) return
  const message = run(root, ['log', '-1', '--format=%B'])
  const kind = bumpKind(message)
  if (!kind) return

  const packagePath = path.join(root, 'package.json')
  const source = readFileSync(packagePath, 'utf8')
  const current = JSON.parse(source).version
  // The version was already changed by hand in this commit: respect it.
  if (JSON.parse(run(root, ['show', 'HEAD^:package.json'])).version !== current) return

  const next = bumpVersion(current, kind)
  writeFileSync(packagePath, source.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`))
  const files = ['package.json']

  const lockPath = path.join(root, 'package-lock.json')
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
    lock.version = next
    if (lock.packages?.['']) lock.packages[''].version = next
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
    files.push('package-lock.json')
  }

  const notesPath = path.join(root, 'docs', 'release-notes.md')
  if (existsSync(notesPath)) {
    const subject = HEADER.exec(message.split(/\r?\n/)[0].trim())?.[4] ?? message.split(/\r?\n/)[0].trim()
    const date = new Date().toISOString().slice(0, 10)
    writeFileSync(notesPath, addReleaseNote(readFileSync(notesPath, 'utf8'), next, date, subject))
    files.push('docs/release-notes.md')
  }

  run(root, ['add', ...files])
  execFileSync('git', ['commit', '--amend', '--no-edit', '--no-verify', '--quiet'], {
    cwd: root,
    env: { ...process.env, SKIP_VERSION_BUMP: '1' },
  })
  console.log(`version: ${current} → ${next} (${kind})`)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main()
