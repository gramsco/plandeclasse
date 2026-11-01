import { useState } from 'react'
import { fileOf, readFile, type ExportFile } from '../io/file'
import {
  bundleOf,
  diffPatch,
  newcomers,
  parsePatch,
  PLAN_FIELD_LABELS,
  STUDENT_FIELD_LABELS,
  type Bundle,
  type Change,
  type Newcomer,
} from '../model/sync'
import { fullName } from '../model/types'
import { useApp } from '../store'
import { hasLastSync, setLastSync } from './lastSync'

const describe = (change: Change) =>
  change.kind === 'student'
    ? {
        title: fullName(change.student) || 'Élève',
        detail: change.fields.map((f) => STUDENT_FIELD_LABELS[f]).join(', '),
      }
    : {
        title: `Plan « ${change.plan.name} »`,
        detail: [
          change.moved > 0 ? `${change.moved} place(s) modifiée(s)` : '',
          ...change.fields.filter((f) => f !== 'assignments').map((f) => PLAN_FIELD_LABELS[f]),
        ]
          .filter(Boolean)
          .join(', '),
      }

type Stage =
  | { name: 'review'; changes: Change[] }
  | { name: 'review-classes'; items: Newcomer[]; photos: ExportFile['photos'] }
  | { name: 'failed'; message: string }
  | { name: 'done'; count: number; what: string }

/** What the received text holds (a whole-class transfer or a patch), compared with the data on this device. */
function inspect(text: string, local: Bundle): Stage {
  try {
    let format: unknown
    try {
      format = JSON.parse(text)?.format
    } catch {
      // not JSON: the parsers below report it
    }
    if (format === 'classe') {
      const file = readFile(text)
      return { name: 'review-classes', items: newcomers(file, local), photos: file.photos }
    }
    return { name: 'review', changes: diffPatch(parsePatch(text), local.classes, local.plans) }
  } catch (e) {
    return { name: 'failed', message: (e as Error).message }
  }
}

const allOf = (stage: Stage) =>
  new Set((stage.name === 'review' ? stage.changes : stage.name === 'review-classes' ? stage.items : []).keys())

/**
 * Shows what a received transfer would change and lets the teacher pick what to keep. The text is read
 * against the data as it is when this opens, whatever carried it (QR codes or a direct connection).
 */
export function SyncReview({ text, onDone, onRetry }: { text: string; onDone(): void; onRetry?(): void }) {
  const { classes, rooms, plans, applySync, importData } = useApp()
  const [initial] = useState(() => inspect(text, { classes, rooms, plans }))
  const [stage, setStage] = useState<Stage>(initial)
  const [chosen, setChosen] = useState(() => allOf(initial))

  const toggle = (index: number, on: boolean) =>
    setChosen((previous) => {
      const next = new Set(previous)
      if (on) next.add(index)
      else next.delete(index)
      return next
    })

  const apply = async (changes: Change[]) => {
    const accepted = changes.filter((_, i) => chosen.has(i))
    await applySync(accepted)
    setStage({ name: 'done', count: accepted.length, what: 'modification(s) appliquée(s)' })
  }

  const addClasses = async (items: Newcomer[], photos: ExportFile['photos']) => {
    const accepted = items.filter((_, i) => chosen.has(i))
    // A device that starts from nothing has no edits to send yet: what it just received is not one.
    if (classes.length === 0 && !hasLastSync()) setLastSync(new Date().toISOString())
    // Only the photos of the classes being added are kept.
    const kept: ExportFile['photos'] = {}
    for (const { schoolClass } of accepted)
      for (const { photoId } of schoolClass.students) if (photoId && photos[photoId]) kept[photoId] = photos[photoId]
    await importData(fileOf(bundleOf(accepted), kept), 'merge')
    setStage({ name: 'done', count: accepted.length, what: 'classe(s) ajoutée(s)' })
  }

  if (stage.name === 'failed')
    return (
      <>
        <p role="alert">{stage.message}</p>
        <div className="form-actions">
          <button onClick={onDone}>Fermer</button>
          {onRetry && (
            <button className="primary" onClick={onRetry}>
              Réessayer
            </button>
          )}
        </div>
      </>
    )
  if (stage.name === 'done')
    return (
      <>
        <p>
          {stage.count} {stage.what}.
        </p>
        <div className="form-actions">
          <button className="primary" autoFocus onClick={onDone}>
            OK
          </button>
        </div>
      </>
    )
  if (stage.name === 'review-classes') {
    const { items, photos } = stage
    return items.length === 0 ? (
      <>
        <p>
          Ces classes sont déjà sur cet appareil. Pour reporter des modifications, utilisez « Envoyer » → « Mes
          modifications ».
        </p>
        <div className="form-actions">
          <button className="primary" autoFocus onClick={onDone}>
            OK
          </button>
        </div>
      </>
    ) : (
      <>
        <p>Cochez les classes à ajouter sur cet appareil :</p>
        <ul className="sync-changes">
          {items.map((item, i) => (
            <li key={item.schoolClass.id}>
              <label>
                <input type="checkbox" checked={chosen.has(i)} onChange={(e) => toggle(i, e.target.checked)} />{' '}
                <strong>{item.schoolClass.name}</strong> — {item.schoolClass.students.length} personne(s),{' '}
                {item.plans.length} plan(s)
              </label>
            </li>
          ))}
        </ul>
        <div className="form-actions">
          <button onClick={onDone}>Annuler</button>
          <button className="primary" disabled={chosen.size === 0} onClick={() => void addClasses(items, photos)}>
            Ajouter
          </button>
        </div>
      </>
    )
  }
  const { changes } = stage
  return changes.length === 0 ? (
    <>
      <p>Rien à appliquer : cet appareil est déjà à jour.</p>
      <div className="form-actions">
        <button className="primary" autoFocus onClick={onDone}>
          OK
        </button>
      </div>
    </>
  ) : (
    <>
      <p>Cochez les modifications à appliquer :</p>
      <ul className="sync-changes">
        {changes.map((change, i) => {
          const { title, detail } = describe(change)
          return (
            <li key={i}>
              <label>
                <input type="checkbox" checked={chosen.has(i)} onChange={(e) => toggle(i, e.target.checked)} />{' '}
                <strong>{title}</strong> — {detail}
              </label>
            </li>
          )
        })}
      </ul>
      <div className="form-actions">
        <button onClick={onDone}>Annuler</button>
        <button className="primary" disabled={chosen.size === 0} onClick={() => void apply(changes)}>
          Appliquer
        </button>
      </div>
    </>
  )
}
