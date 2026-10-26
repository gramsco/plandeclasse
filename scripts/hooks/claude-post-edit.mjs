// Claude Code hook (PostToolUse on Edit/Write): keeps edited files formatted and enforces the
// code-quality rules immediately, so that violations are fixed while the context is fresh.
// Exit code 2 sends the findings back to Claude.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { checkSource, isChecked } from '../language-check.mjs'
import { projectDir, readPayload, runBin } from './lib.mjs'

const filePath = readPayload().tool_input?.file_path
if (!filePath || !existsSync(filePath)) process.exit(0)
const relative = path.relative(projectDir, filePath)
if (relative.startsWith('..') || relative.startsWith('node_modules')) process.exit(0)

// 1) Formatting is never a reason to interrupt: just fix it.
if (/\.(ts|tsx|mjs|css|json|ya?ml)$/.test(filePath)) runBin('prettier', ['--write', filePath])

const problems = []

// 2) Language policy.
if (isChecked(filePath)) {
  for (const finding of checkSource(relative, readFileSync(filePath, 'utf8')))
    problems.push(`${relative}:${finding.line}:${finding.column}  ${finding.message}`)
}

// 3) Linter.
if (/\.(ts|tsx|mjs)$/.test(filePath)) {
  const lint = runBin('oxlint', ['--deny-warnings', filePath])
  if (!lint.ok) problems.push(lint.output)
}

if (problems.length) {
  console.error(`Code quality problems in ${relative} — fix them (see CONTRIBUTING.md):\n${problems.join('\n')}`)
  process.exit(2)
}
