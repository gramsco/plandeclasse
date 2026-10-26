# Architecture

A single-page React app, built with Vite, that runs entirely in the browser. There is no backend.

## Concepts

|                  | Type          | Meaning                                                        |
| ---------------- | ------------- | -------------------------------------------------------------- |
| **Class**        | `SchoolClass` | A list of people (students, AESH) with photos. Independent of any room. |
| **Room**         | `Room`        | A physical place: furniture, each piece with one or more seats. |
| **Plan**         | `Plan`        | A class placed in a room (`assignments: seatId → studentId`), plus rules, a status and notes. A plan is also a _hypothesis_ to try in real life; duplicating one creates a linked hypothesis. |

Students and furniture are decoupled: moving a student never moves a table, and the room editor never touches the class.

## Layers

```
src/
  model/     pure logic, no React, no I/O — types, geometry, room templates, plan operations,
             analysis (rules, AESH, proximity), data migrations, demo data
  storage/   Storage interface + IndexedDB and in-memory implementations, photo resizing, fake avatars
  store/     Zustand store: state, actions, debounced persistence, import
  io/        .classe file: build, read (validate + migrate), download
  ui/        React components, stylesheet, built-in guide renderer
scripts/     icons, screenshots, language check, Claude Code / git hooks
docs/        user guide (French) and its screenshots, this file
```

Dependencies only point left: `ui → store → storage → model`.

## Persistence

- **IndexedDB** (`plandeclasse`): object stores `classes`, `rooms`, `plans` (JSON documents), `photos` (Blobs keyed by id,
  like an object store) and `meta` (data version, pre-migration backup). Photos are cropped to a square and resized to
  about 200 px before being stored.
- The store saves each changed record 300 ms after its last change. Deleting a student, class or room also deletes the
  photos and plans that depended on it. Orphan photos are removed at startup.
- `navigator.storage.persist()` is requested so the browser does not evict the data.

## Versions and migrations

Three independent version numbers:

| What                     | Where                                    | Rule                                                              |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| Application release      | `package.json` `version`                 | Shown in the footer, written in exported files.                   |
| **Data format**          | `DATA_VERSION` in `model/migrations.ts`  | Shape of classes/rooms/plans. Shared by the database and `.classe` files. One migration function per step. |
| IndexedDB structure      | `DB_MIGRATIONS` in `storage/indexeddb.ts`| Object stores. One entry per step, never edited afterwards.       |

At startup the store reads the stored data version. Older: back up the raw data in `meta`, migrate, rewrite. Newer: refuse
and show an explanation, writing nothing. `readFile` applies the same migrations to imported files. The legacy key
`versionDonnees` is still written so that old releases refuse data they cannot read.

## Plan analysis

`model/analysis.ts` computes, for a plan: the _relation_ between every pair of seats (side by side, front/back,
diagonal, across an aisle — measured in the frame of each seat, so U shapes and islands work), the effective traffic light
of each student (rules can only make it worse), and the alerts (rule violations, AESH unplaced or too far). Side by side
is an error; the other relations are warnings.

## Printing

The plan canvas carries `opt-*` classes on every optional part (photo, names, colours, annotations, gender). The print
options toggle `hide-*` classes on the canvas; the stylesheet hides the matching parts both in `@media print` and, when
"preview" is on, on screen. Alert links are never printed.

## PWA

`vite-plugin-pwa` precaches the app and the guide's screenshots. The update strategy is `prompt`: a new version is applied
only when the user clicks "Mettre à jour". The CSP (`index.html`) forbids every origin but our own.

## Built-in guide

`docs/guide.md` is rendered in the "Aide" tab by `ui/guide.ts` (marked), with its images bundled. Raw HTML is escaped.
A test checks that every table-of-contents link and every screenshot reference resolves.

## CI/CD

`ci.yml` runs the quality gate on every push and PR; `security.yml` runs Trivy, CodeQL and dependency review;
`scorecard.yml` the OpenSSF Scorecard; `deploy.yml` deploys `main` to GitHub Pages. Actions are pinned by commit SHA and
updated by Dependabot.
