# Contributing

Plan de classe is a **local-first PWA** that teachers use to place students in a classroom. Student names, photos and
annotations (PAP, PAI, DYS…) are personal data of minors, some of it sensitive. Everything below follows from one
rule: **the data never leaves the user's device, and the user must never lose it.**

Product specifications live in [`intent.md`](intent.md) and [`v2.md`](v2.md) (in French, they are the product owner's
words). Architecture is described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The user guide is
[`docs/guide.md`](docs/guide.md).

## Language policy

|                                                                                   | Language    |
| --------------------------------------------------------------------------------- | ----------- |
| Code: identifiers, comments, test titles, commit messages, PR descriptions        | **English** |
| Developer docs (`CONTRIBUTING.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`)          | **English** |
| User interface text, alert messages, the user guide, specifications, `SECURITY.md` | **French**  |

Persisted data and the `.classe` file use English field names and values (`students`, `light: 'red'`…), never French.

`npm run lint:lang` enforces this on identifiers, comments and test titles (string literals and JSX text are the French
UI and are not checked). The only escape hatches are `lang-ignore` (one line) and `lang-ignore-file` (whole file), for
code that must name legacy French fields such as data migrations and their fixtures. Use them with a reason.

Domain vocabulary: _classe_ → `SchoolClass`, _salle_ → `Room`, _plan_ → `Plan`, _élève_ → `Student`, _AESH_ → `aesh`
(kept as is: it is the name of the role, a classroom aide for students with disabilities), _place_ → `Seat`, _table_ →
`Furniture`, _feu tricolore_ → `TrafficLight`.

## Getting started

```bash
npm install
npm run hooks:install   # git pre-commit hook (runs `npm run check`)
npm run dev             # http://localhost:5173
```

| Command                             | What it does                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `npm run check`                     | **The quality gate**: typecheck, lint, language policy, formatting, all tests  |
| `npm run build` / `npm run preview` | Production build / serve it (needed to test the service worker)                |
| `npm run format`                    | Prettier, write mode                                                           |
| `npm run screenshots`               | Regenerates the guide's screenshots (needs Google Chrome); commit the result   |
| `npm run icons`                     | Regenerates the PWA icons                                                      |

The gate must pass before every commit. Never weaken a rule or a test to make it pass: fix the code, or discuss the rule.

## Architecture rules

- **Layers, and what each may import**: `model` (pure logic, no React, no storage) ← `storage` ← `store` ← `ui`.
  Business rules live in `src/model` and are unit-tested; components render and dispatch.
- **No `any`** (the few normalizers that read untrusted data are explicitly annotated). Prefer discriminated unions over
  flags. Make impossible states unrepresentable.
- **No network, ever.** No `fetch`, no external script, font, image or CDN, no analytics, no telemetry. The CSP in
  `index.html` enforces it and must not be loosened. A feature that seems to need the network is the wrong feature.
- **Dependencies**: every new runtime dependency needs a justification in the PR. Prefer 30 lines of code to a package.
  Install scripts are disabled (`.npmrc`), keep it that way.
- **Comments explain _why_**, never what the code says. Delete dead code instead of commenting it out.
- Revoke every object URL you create. Debounced saves must not be lost or reordered.

## Data safety and migrations

Persisted data is the product. Any change to the **shape** of what is stored or exported (`SchoolClass`, `Student`,
`Room`, `Furniture`, `Plan`, `Rule`, their fields or enum values, the `.classe` file) requires **all** of:

1. Bump `DATA_VERSION` in `src/model/migrations.ts` and add the migration `n → n+1`.
2. Add (or extend) a snapshot of the previous shape in `src/model/legacyFixtures.ts`, and a test that migrates it.
3. Update the `normalize*` functions in `src/model/types.ts`.
4. Keep old `.classe` files importable: `readFile` migrates them. Keep old browsers safe: data written with a newer
   version must be refused, not modified.

A change to the **IndexedDB structure** (object stores) is a new entry in `DB_MIGRATIONS` (`src/storage/indexeddb.ts`).
Never edit an existing entry: users have already run it.

Before migrating, the app keeps a copy of the old data in the `meta` store (`preMigrationBackup`). Do not remove it.

## User interface

- UI strings are **French** and consistent with the vocabulary above (classe, salle, plan, élève, AESH).
- Use real `button` / `input` / `select` elements with accessible names. Focus must stay visible. Colour is never the only
  signal.
- Anything shown to the user is derived from the model through a label map (`TRAFFIC_LIGHT_LABELS`,
  `PLAN_STATUS_LABELS`…), never from a raw enum value.
- Printing matters: check what a change does in print mode (`@media print`, the `opt-*` classes and the print options).
- Demo data and screenshots are **fictional**. Never commit a real student's name or photo.
- When behaviour visible to a teacher changes, update `docs/guide.md` and regenerate the screenshots.

## Tests

- Vitest. Unit-test everything in `src/model`; test store behaviour with `memoryStorage()`.
- Test titles are English sentences that state the behaviour ("deletes the photos with the student").
- A bug fix starts with a failing test. A migration is tested with real legacy data, not with data you just built.
- No snapshot tests of large structures, no tests that depend on timing or on `Math.random` (inject the generator).

## Review and commits

- **Every non-trivial change is reviewed by the `code-reviewer` agent** (`.claude/agents/code-reviewer.md`) before it is
  committed: run `/review` in Claude Code. Humans reviewing a PR use the same checklist.
- Commit messages are English, imperative, with a type prefix: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`,
  `chore:`. One logical change per commit.
- **The version follows the commit** (semver, `.githooks/post-commit`, see `scripts/bump-version.mjs`): `feat:` → minor,
  `fix:` / `perf:` → patch, `type!:` or a `BREAKING CHANGE:` line → major (minor while the version is 0.x), other types
  → unchanged. The hook updates `package.json`, `package-lock.json` and `docs/release-notes.md`, then folds that into
  the commit with an amend. **Write the release notes before committing**, in French and for teachers, under a
  `## À venir` heading at the top of `docs/release-notes.md`: the hook turns it into the new version's heading. If there
  is none, the hook adds a `(à rédiger)` placeholder, and `npm run check` fails until it is rewritten. Skip with
  `SKIP_VERSION_BUMP=1`; a version you changed by hand in the commit is left alone; amended commits are not bumped again.
- `docs/release-notes.md` is what users read when they click the version number in the footer.
- Pull requests use the template in `.github/pull_request_template.md`.
- Bump `version` in `package.json` for every release. A push to `main` deploys to GitHub Pages.

## Automated guardrails

| Guardrail                          | Where                                  | What it does                                                                                           |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Quality gate                       | `npm run check`, CI (`ci.yml`)         | Typecheck, oxlint, language policy, Prettier, tests                                                    |
| Git pre-commit hook                | `.githooks/pre-commit`                 | Runs the gate before each commit (`npm run hooks:install`)                                             |
| Claude Code: after each edit       | `.claude/settings.json` → `PostToolUse`| Formats the file, then reports language and lint problems to Claude immediately                        |
| Claude Code: before finishing      | `.claude/settings.json` → `Stop`       | Runs the gate when sources changed; Claude cannot declare the work done while it fails                 |
| Claude Code: before `git commit`   | `.claude/settings.json` → `PreToolUse` | Blocks the commit unless the `code-reviewer` agent approved _these exact_ changes (`SKIP_REVIEW_HOOK=1` bypasses) |
| Security scans                     | `.github/workflows`, `SECURITY.md`     | Dependabot, Trivy, CodeQL, dependency review, OpenSSF Scorecard                                        |

The reviewer's approval is stored in `.git/review-approved` as a fingerprint of the working tree, so any later change
invalidates it.
