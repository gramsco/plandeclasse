// Records that the current changes were approved by the code-reviewer agent.
// Usage (only after an APPROVE verdict): node scripts/hooks/mark-reviewed.mjs
import { writeFileSync } from 'node:fs'
import { approvalFile, changeFingerprint } from './lib.mjs'

const { hash } = changeFingerprint()
writeFileSync(approvalFile(), `${hash}\n`)
console.log(`Review approval recorded for ${hash.slice(0, 12)}. It is invalidated by any further change.`)
