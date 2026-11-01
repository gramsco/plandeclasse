import { useEffect, useRef, useState } from 'react'
import { fileOf, readFile } from '../io/file'
import { decodePayload } from '../io/payloadCodec'
import { emptyReception, progressOf, receiveFrame, type Reception } from '../model/frames'
import {
  bundleOf,
  diffPatch,
  newcomers,
  parsePatch,
  PLAN_FIELD_LABELS,
  STUDENT_FIELD_LABELS,
  type Change,
  type Newcomer,
} from '../model/sync'
import { fullName } from '../model/types'
import { useApp } from '../store'
import { hasLastSync, setLastSync } from './lastSync'

const SCAN_MS = 120
const NO_CAMERA =
  "La caméra n'est pas accessible. Autorisez-la dans le navigateur, ou utilisez un ordinateur qui en a une."

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
  | { name: 'scanning' }
  | { name: 'review'; changes: Change[] }
  | { name: 'review-classes'; items: Newcomer[] }
  | { name: 'failed'; message: string }
  | { name: 'done'; count: number; what: string }

/** Reads the QR codes shown by the phone, then lets the teacher pick which edits to apply. */
export function SyncReceive({ onDone }: { onDone(): void }) {
  const { classes, rooms, plans, applySync, importData } = useApp()
  const video = useRef<HTMLVideoElement>(null)
  const [stage, setStage] = useState<Stage>({ name: 'scanning' })
  const [reception, setReception] = useState<Reception>(emptyReception)
  const [chosen, setChosen] = useState<Set<number>>(new Set())

  const scanning = stage.name === 'scanning'
  useEffect(() => {
    if (!scanning) return
    let stopped = false
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    const fail = (message: string) => !stopped && setStage({ name: 'failed', message })
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        const el = video.current
        if (!el) return
        el.srcObject = stream
        await el.play()
        const { default: jsQR } = await import('jsqr') // only loaded when someone scans
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return fail(NO_CAMERA)
        timer = setInterval(() => {
          if (!el.videoWidth) return
          canvas.width = el.videoWidth
          canvas.height = el.videoHeight
          context.drawImage(el, 0, 0)
          const image = context.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
          if (code) setReception((r) => receiveFrame(r, code.data))
        }, SCAN_MS)
      } catch {
        fail(NO_CAMERA)
      }
    })()
    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [scanning])

  useEffect(() => {
    if (reception.status !== 'complete') return
    const read = async (): Promise<Stage> => {
      const text = await decodePayload(reception.payload)
      let format: unknown
      try {
        format = JSON.parse(text)?.format
      } catch {
        // not JSON: the parsers below report it
      }
      if (format === 'classe') {
        const items = newcomers(readFile(text), { classes, rooms, plans })
        setChosen(new Set(items.keys()))
        return { name: 'review-classes', items }
      }
      const changes = diffPatch(parsePatch(text), classes, plans)
      setChosen(new Set(changes.keys()))
      return { name: 'review', changes }
    }
    read().then(setStage, (e: Error) => setStage({ name: 'failed', message: e.message }))
    // Decoded once, against the data as it is when the last frame arrives.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [reception])

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

  const addClasses = async (items: Newcomer[]) => {
    const accepted = items.filter((_, i) => chosen.has(i))
    // A device that starts from nothing has no edits to send yet: what it just received is not one.
    if (classes.length === 0 && !hasLastSync()) setLastSync(new Date().toISOString())
    await importData(fileOf(bundleOf(accepted)), 'merge')
    setStage({ name: 'done', count: accepted.length, what: 'classe(s) ajoutée(s)' })
  }

  if (stage.name === 'failed')
    return (
      <>
        <p role="alert">{stage.message}</p>
        <div className="form-actions">
          <button onClick={onDone}>Fermer</button>
          <button
            className="primary"
            onClick={() => {
              setReception(emptyReception)
              setStage({ name: 'scanning' })
            }}
          >
            Réessayer
          </button>
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
    const { items } = stage
    return items.length === 0 ? (
      <>
        <p>
          Ces classes sont déjà sur cet appareil. Pour reporter des modifications, utilisez « Envoyer mes modifications
          ».
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
          <button className="primary" disabled={chosen.size === 0} onClick={() => void addClasses(items)}>
            Ajouter
          </button>
        </div>
      </>
    )
  }
  if (stage.name === 'review') {
    const { changes } = stage
    return changes.length === 0 ? (
      <>
        <p>Rien à appliquer : l'ordinateur est déjà à jour.</p>
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

  const progress = progressOf(reception)
  return (
    <>
      <p>Sur l'autre appareil : Synchroniser → Envoyer. Présentez son écran à la caméra.</p>
      <video ref={video} className="sync-video" muted playsInline aria-label="Image de la caméra" />
      <p className="hint" role="status">
        {progress ? `Lecture : ${progress.received} code(s) sur ${progress.total}` : 'En attente d’un code…'}
      </p>
      <div className="form-actions">
        <button onClick={onDone}>Annuler</button>
      </div>
    </>
  )
}
