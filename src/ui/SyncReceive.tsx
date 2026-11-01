import { useEffect, useRef, useState } from 'react'
import { decodePatch } from '../io/patchCodec'
import { emptyReception, progressOf, receiveFrame, type Reception } from '../model/frames'
import { diffPatch, PLAN_FIELD_LABELS, STUDENT_FIELD_LABELS, type Change } from '../model/sync'
import { fullName } from '../model/types'
import { useApp } from '../store'

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
  | { name: 'failed'; message: string }
  | { name: 'done'; count: number }

/** Reads the QR codes shown by the phone, then lets the teacher pick which edits to apply. */
export function SyncReceive({ onDone }: { onDone(): void }) {
  const { classes, plans, applySync } = useApp()
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
    decodePatch(reception.payload).then(
      (patch) => {
        const changes = diffPatch(patch, classes, plans)
        setChosen(new Set(changes.keys()))
        setStage({ name: 'review', changes })
      },
      (e: Error) => setStage({ name: 'failed', message: e.message }),
    )
    // Decoded once, against the data as it is when the last frame arrives.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [reception])

  const apply = async (changes: Change[]) => {
    const accepted = changes.filter((_, i) => chosen.has(i))
    await applySync(accepted)
    setStage({ name: 'done', count: accepted.length })
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
        <p>{stage.count} modification(s) appliquée(s).</p>
        <div className="form-actions">
          <button className="primary" autoFocus onClick={onDone}>
            OK
          </button>
        </div>
      </>
    )
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
                  <input
                    type="checkbox"
                    checked={chosen.has(i)}
                    onChange={(e) =>
                      setChosen((c) => {
                        const next = new Set(c)
                        if (e.target.checked) next.add(i)
                        else next.delete(i)
                        return next
                      })
                    }
                  />{' '}
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
      <p>Sur le téléphone : Synchroniser → Envoyer. Présentez son écran à la caméra.</p>
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
