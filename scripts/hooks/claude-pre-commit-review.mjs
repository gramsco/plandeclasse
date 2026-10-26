// Claude Code hook (PreToolUse on Bash): a commit needs an approving review of exactly the changes
// it contains. The `code-reviewer` agent records its approval with `mark-reviewed.mjs`; any later
// change invalidates it. Set SKIP_REVIEW_HOOK=1 in the command to bypass (the user's call).
import { readFileSync } from 'node:fs'
import { approvalFile, changeFingerprint, isGitCommit, readPayload } from './lib.mjs'

const command = readPayload().tool_input?.command ?? ''
if (!isGitCommit(command) || /\bSKIP_REVIEW_HOOK=1\b/.test(command)) process.exit(0)

const { hash, isEmpty } = changeFingerprint()
if (isEmpty) process.exit(0)

let approved = ''
try {
  approved = readFileSync(approvalFile(), 'utf8').trim()
} catch {
  // never reviewed
}
if (approved !== hash) {
  console.error(
    [
      'Commit blocked: these changes have not been approved by the code-reviewer agent.',
      'Run the `code-reviewer` agent (or the /review command) on the current changes.',
      'When it answers APPROVE it records the approval itself; fix every blocking finding otherwise.',
      'Any change made after the review requires a new review.',
    ].join('\n'),
  )
  process.exit(2)
}
