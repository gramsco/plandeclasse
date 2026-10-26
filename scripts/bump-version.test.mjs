import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { addReleaseNote, bumpKind, bumpVersion } from './bump-version.mjs'

describe('bumpKind', () => {
  it.each([
    ['feat: add crown', 'minor'],
    ['feat(plan): add crown', 'minor'],
    ['fix: print overflow', 'patch'],
    ['perf: faster placement', 'patch'],
    ['feat!: new file format', 'major'],
    ['refactor(store)!: rename actions', 'major'],
    ['fix: x\n\nBREAKING CHANGE: file format', 'major'],
    ['docs: update guide', null],
    ['chore: deps', null],
    ['test: more', null],
    ['Merge branch main', null],
    ['# only a comment', null],
  ])('%j → %s', (message, kind) => expect(bumpKind(message)).toBe(kind))

  it('ignores git comment lines', () => expect(bumpKind('feat: a\n# fix: b')).toBe('minor'))
})

describe('bumpVersion', () => {
  it.each([
    ['0.3.0', 'patch', '0.3.1'],
    ['0.3.4', 'minor', '0.4.0'],
    ['1.2.3', 'minor', '1.3.0'],
    ['1.2.3', 'major', '2.0.0'],
    ['0.3.4', 'major', '0.4.0'], // breaking changes stay in 0.x
  ])('%s + %s = %s', (version, kind, expected) => expect(bumpVersion(version, kind)).toBe(expected))

  it('refuses versions with a suffix', () => expect(() => bumpVersion('1.0.0-beta', 'patch')).toThrow())
})

describe('addReleaseNote', () => {
  const notes = '# Notes\n\nIntro.\n\n## 0.3.0 — 2026-01-01\n\n- Old\n'
  it('puts the new version above the previous ones', () => {
    const result = addReleaseNote(notes, '0.4.0', '2026-02-02', 'add crown')
    expect(result.indexOf('## 0.4.0')).toBeLessThan(result.indexOf('## 0.3.0'))
    expect(result).toContain('- add crown')
    expect(result.startsWith('# Notes\n\nIntro.')).toBe(true)
  })
  it('does not add a version twice', () => expect(addReleaseNote(notes, '0.3.0', '2026-02-02', 'x')).toBe(notes))
})

// Inside a git hook, GIT_DIR / GIT_INDEX_FILE point at the real repository: never pass them on.
const cleanEnv = (extra = {}) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  ...extra,
})

describe('post-commit hook', () => {
  const root = path.resolve(import.meta.dirname, '..')
  const repo = mkdtempSync(path.join(tmpdir(), 'bump-'))
  afterAll(() => rmSync(repo, { recursive: true, force: true }))

  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: cleanEnv() })
  const version = () => JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')).version
  const commit = (message, ...extra) => {
    writeFileSync(path.join(repo, 'file.txt'), `${Math.random()}`)
    git('add', 'file.txt')
    git('commit', '-q', ...extra, '-m', message)
  }

  it('sets up a throw-away repository with the hook', () => {
    mkdirSync(path.join(repo, 'scripts'))
    mkdirSync(path.join(repo, '.githooks'))
    mkdirSync(path.join(repo, 'docs'))
    cpSync(path.join(root, 'scripts/bump-version.mjs'), path.join(repo, 'scripts/bump-version.mjs'))
    cpSync(path.join(root, '.githooks/post-commit'), path.join(repo, '.githooks/post-commit'))
    writeFileSync(path.join(repo, 'package.json'), '{\n  "name": "x",\n  "version": "0.3.0"\n}\n')
    writeFileSync(path.join(repo, 'docs/release-notes.md'), '# Notes\n\n## 0.3.0 — 2026-01-01\n\n- first\n')
    git('init', '-q')
    git('config', 'core.hooksPath', '.githooks')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    git('config', 'commit.gpgsign', 'false')
    git('add', '-A')
    git('commit', '-q', '-m', 'chore: init')
    expect(version()).toBe('0.3.0')
  })

  it('puts the new version in the very same commit', () => {
    commit('feat: crown for class representatives')
    expect(version()).toBe('0.4.0')
    expect(git('show', '--name-only', '--format=', 'HEAD')).toContain('package.json')
    expect(git('show', 'HEAD:docs/release-notes.md')).toMatch(/^## 0\.4\.0 — .*\n\n- crown for class representatives/m)
    expect(git('status', '--porcelain')).toBe('')
  })

  it('patches on a fix, and leaves docs and chores alone', () => {
    commit('fix: blank second page')
    expect(version()).toBe('0.4.1')
    commit('docs: update the guide')
    commit('chore: update dependencies')
    expect(version()).toBe('0.4.1')
  })

  it('does not bump again when a commit is amended', () => {
    commit('fix: another bug')
    expect(version()).toBe('0.4.2')
    git('commit', '-q', '--amend', '-m', 'fix: another bug, reworded')
    expect(version()).toBe('0.4.2')
  })

  it('keeps 0.x on a breaking change, and can be skipped', () => {
    commit('feat!: new file format')
    expect(version()).toBe('0.5.0')
    writeFileSync(path.join(repo, 'file.txt'), 'x')
    git('add', 'file.txt')
    execFileSync('git', ['commit', '-q', '-m', 'feat: skipped'], {
      cwd: repo,
      env: cleanEnv({ SKIP_VERSION_BUMP: '1' }),
    })
    expect(version()).toBe('0.5.0')
  })
})
