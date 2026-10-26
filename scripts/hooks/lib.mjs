// Shared helpers of the Claude Code hooks and the git pre-commit hook.
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const projectDir = path.resolve(import.meta.dirname, '..', '..')

export const git = (args) =>
  execFileSync('git', args, { cwd: projectDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

/** Reads the JSON payload Claude Code sends on stdin (empty object if there is none). */
export function readPayload() {
  try {
    const text = readFileSync(0, 'utf8')
    return text.trim() ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

/** Runs a project binary (from node_modules/.bin) and returns { ok, output }. */
export function runBin(name, args) {
  const result = spawnSync(path.join(projectDir, 'node_modules', '.bin', name), args, {
    cwd: projectDir,
    encoding: 'utf8',
  })
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() }
}

/** True for a shell command that creates a commit. */
export const isGitCommit = (command) =>
  /(^|[;&|(]\s*|\bcd\s+\S+\s*&&\s*)(\w+=\S+\s+)*git\s+((-[cC]\s+\S+|-\S+)\s+)*commit\b/.test(command)

/**
 * Fingerprint of everything a commit could contain: tracked changes (staged or not) and untracked
 * files. A review approval is only valid for the exact fingerprint it was given for.
 */
export function changeFingerprint() {
  const hash = createHash('sha256')
  hash.update(git(['diff', 'HEAD', '--binary']))
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean).sort()
  for (const file of untracked) {
    hash.update(file)
    hash.update(readFileSync(path.join(projectDir, file)))
  }
  return { hash: hash.digest('hex'), isEmpty: !git(['status', '--porcelain']).trim() }
}

export const approvalFile = () => path.resolve(projectDir, git(['rev-parse', '--git-dir']).trim(), 'review-approved')
