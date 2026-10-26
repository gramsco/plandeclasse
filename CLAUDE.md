# Plan de classe — instructions for Claude

@CONTRIBUTING.md

## How to work in this repository

- **Language**: write code, comments, test titles and commit messages in English. User-facing strings stay French. The
  `PostToolUse` hook reports violations right after each edit: fix them, do not work around them.
- **Quality gate**: `npm run check` must pass. The `Stop` hook runs it when sources changed; do not finish with it red.
- **Review before commit**: when the user asks you to commit, first run `/review` (the `code-reviewer` agent). A
  `PreToolUse` hook blocks `git commit` until the exact changes are approved. Never run
  `scripts/hooks/mark-reviewed.mjs` yourself and never use `SKIP_REVIEW_HOOK=1` unless the user explicitly tells you to.
- **Never commit or push on your own initiative.** Commit only when asked. Force-pushing or rewriting history needs the
  user's explicit approval each time.
- **Data first**: before touching a type in `src/model/types.ts`, read the "Data safety and migrations" section.
- **Verify in the browser** when you change the UI: `npm run screenshots` drives the real app (headless Chrome). Say
  honestly what you could not verify.
- Keep changes small and focused; do not refactor unrelated code. Prefer deleting code to adding it.
- Guide and screenshots (`docs/`) are part of the product: update them with visible behaviour changes.
