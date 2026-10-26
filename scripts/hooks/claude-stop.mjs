// Claude Code hook (Stop): before Claude declares the work done, run the full quality gate
// if source files changed. A failure keeps Claude working (exit code 2).
import { spawnSync } from 'node:child_process'
import { git, projectDir, readPayload } from './lib.mjs'

// Already continuing because of this very hook: do not loop forever, let it stop.
if (readPayload().stop_hook_active) process.exit(0)

const changed = git(['status', '--porcelain'])
  .split('\n')
  .map((line) => line.slice(3))
  .filter((file) => /^(src|scripts|docs\/guide\.md|index\.html|vite\.config\.ts|package\.json|\.github)/.test(file))
if (!changed.length) process.exit(0)

const result = spawnSync('npm', ['run', '--silent', 'check'], { cwd: projectDir, encoding: 'utf8' })
if (result.status !== 0) {
  const output = `${result.stdout}${result.stderr}`.trim().split('\n').slice(-60).join('\n')
  console.error(`The quality gate (npm run check) fails — fix it before finishing:\n${output}`)
  process.exit(2)
}
