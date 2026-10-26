import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { approvalFile, changeFingerprint, isGitCommit, projectDir } from './lib.mjs'

const run = (script, payload) =>
  spawnSync('node', [path.join(projectDir, 'scripts/hooks', script)], {
    cwd: projectDir,
    input: JSON.stringify(payload),
    encoding: 'utf8',
  })

describe('isGitCommit', () => {
  it.each([
    'git commit -m "x"',
    'git add -A && git commit -m x',
    'cd /tmp/repo && git commit --amend',
    'GIT_AUTHOR_NAME=a git commit -m x',
    'git -c user.name=a commit -m x',
    'echo hi; git commit',
  ])('detects: %s', (command) => expect(isGitCommit(command)).toBe(true))

  it.each(['git status', 'git log --oneline', 'echo "git commit"', 'npm run commit-lint', 'git diff HEAD'])(
    'ignores: %s',
    (command) => expect(isGitCommit(command)).toBe(false),
  )
})

describe('claude-post-edit hook', () => {
  const temporary = path.join(projectDir, 'scripts/hooks/tmp-post-edit-test.ts')
  afterEach(() => rmSync(temporary, { force: true }))

  it('accepts a clean English file and formats it', () => {
    writeFileSync(temporary, 'export const total = (values: number[]) => values.reduce((a, b) => a + b, 0);\n')
    const result = run('claude-post-edit.mjs', { tool_input: { file_path: temporary } })
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(temporary, 'utf8')).not.toContain(';') // prettier removed the semicolon
  })

  it('sends French identifiers and comments back to Claude (exit code 2)', () => {
    writeFileSync(temporary, '// Calcule le total\nexport const totalEleves = (nombres: number[]) => nombres.length\n')
    const result = run('claude-post-edit.mjs', { tool_input: { file_path: temporary } })
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/French in comment/)
    expect(result.stderr).toMatch(/French identifier "totalEleves"/)
  })

  it('ignores files outside the project and missing files', () => {
    expect(run('claude-post-edit.mjs', { tool_input: { file_path: '/etc/hosts' } }).status).toBe(0)
    expect(run('claude-post-edit.mjs', { tool_input: { file_path: '/nonexistent/file.ts' } }).status).toBe(0)
    expect(run('claude-post-edit.mjs', {}).status).toBe(0)
  })
})

describe('claude-stop hook', () => {
  it('lets Claude stop when the hook already forced a retry (no infinite loop)', () => {
    expect(run('claude-stop.mjs', { stop_hook_active: true }).status).toBe(0)
  })
})

describe('claude-pre-commit-review hook', () => {
  const marker = approvalFile()
  const previous = existsSync(marker) ? readFileSync(marker, 'utf8') : undefined
  afterEach(() => (previous === undefined ? rmSync(marker, { force: true }) : writeFileSync(marker, previous)))

  const commit = (command = 'git commit -m "x"') => run('claude-pre-commit-review.mjs', { tool_input: { command } })

  it('does not interfere with other commands', () => {
    expect(commit('git status').status).toBe(0)
    expect(commit('npm test').status).toBe(0)
  })

  it('can be bypassed explicitly', () => {
    expect(commit('SKIP_REVIEW_HOOK=1 git commit -m x').status).toBe(0)
  })

  it('blocks a commit without approval, and allows it once the exact changes are approved', () => {
    const { hash, isEmpty } = changeFingerprint()
    if (isEmpty) return // nothing to commit: nothing to review
    writeFileSync(marker, 'not-the-right-hash\n')
    const blocked = commit()
    expect(blocked.status).toBe(2)
    expect(blocked.stderr).toMatch(/code-reviewer/)
    writeFileSync(marker, `${hash}\n`)
    expect(commit().status).toBe(0)
  })
})
