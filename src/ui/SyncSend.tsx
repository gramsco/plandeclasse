import { useEffect, useState } from 'react'
import { buildTransfer } from '../io/file'
import { encodePayload } from '../io/payloadCodec'
import { splitFrames } from '../model/frames'
import { buildPatch } from '../model/sync'
import { newId } from '../model/types'
import { useApp } from '../store'
import { getLastSync, setLastSync } from './lastSync'
import { QrSvg } from './QrSvg'

const FRAME_MS = 900

const toFrames = async (value: unknown) => splitFrames(await encodePayload(value), newId().slice(0, 6))

/** Shows the frames as QR codes, one after the other in a loop. */
function QrLoop({
  frames,
  intro,
  finishLabel,
  onCancel,
  onFinish,
}: {
  frames: string[]
  intro: string
  finishLabel: string
  onCancel(): void
  onFinish(): void
}) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (frames.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS)
    return () => clearInterval(timer)
  }, [frames])
  return (
    <>
      <p>{intro}</p>
      <div className="qr-box">
        <QrSvg text={frames[index]} label={`Code ${index + 1} sur ${frames.length}`} />
      </div>
      <p className="hint">
        {frames.length > 1
          ? `Le code change tout seul (${index + 1} / ${frames.length}) : gardez-le devant la caméra jusqu'à la fin de la lecture.`
          : 'Gardez ce code devant la caméra.'}
      </p>
      <div className="form-actions">
        <button onClick={onCancel}>Annuler</button>
        <button className="primary" onClick={onFinish}>
          {finishLabel}
        </button>
      </div>
    </>
  )
}

const INTRO = "Sur l'autre appareil : Synchroniser → Recevoir, puis visez ce code avec la caméra."

/** The edits made since the last sync. */
export function SyncSendChanges({ onDone }: { onDone(): void }) {
  const { classes, plans } = useApp()
  const [since] = useState(getLastSync)
  const [now] = useState(() => new Date().toISOString())
  const [frames, setFrames] = useState<string[]>()

  useEffect(() => {
    const patch = buildPatch(classes, plans, since, now)
    if (patch.students.length + patch.plans.length === 0) return setFrames([])
    void toFrames(patch).then(setFrames)
    // The patch is frozen when the panel opens: edits made while it shows must not change the frames.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  if (!frames) return <p className="hint">Préparation…</p>
  if (frames.length === 0)
    return (
      <>
        <p>Aucune modification à envoyer depuis la dernière synchronisation.</p>
        <div className="form-actions">
          <button className="primary" onClick={onDone}>
            OK
          </button>
        </div>
      </>
    )
  return (
    <QrLoop
      frames={frames}
      intro={INTRO}
      finishLabel="L'autre appareil a tout reçu"
      onCancel={onDone}
      onFinish={() => {
        setLastSync(now)
        onDone()
      }}
    />
  )
}

/** Whole classes with their plans and rooms, to set up another device. Photos do not travel. */
export function SyncSendClasses({ onDone }: { onDone(): void }) {
  const { classes, rooms, plans } = useApp()
  const [chosen, setChosen] = useState(() => new Set(classes.map((c) => c.id)))
  const [frames, setFrames] = useState<string[]>()
  const [busy, setBusy] = useState(false)

  if (frames)
    return (
      <QrLoop
        frames={frames}
        intro={INTRO}
        finishLabel="L'autre appareil a tout reçu"
        onCancel={onDone}
        onFinish={onDone}
      />
    )
  if (classes.length === 0)
    return (
      <>
        <p>Il n'y a encore aucune classe à envoyer.</p>
        <div className="form-actions">
          <button className="primary" onClick={onDone}>
            OK
          </button>
        </div>
      </>
    )
  return (
    <>
      <p>Quelles classes envoyer ? Chaque classe prend quelques secondes à lire. Les photos ne sont pas envoyées.</p>
      <ul className="sync-changes">
        {classes.map((c) => (
          <li key={c.id}>
            <label>
              <input
                type="checkbox"
                checked={chosen.has(c.id)}
                onChange={(e) =>
                  setChosen((previous) => {
                    const next = new Set(previous)
                    if (e.target.checked) next.add(c.id)
                    else next.delete(c.id)
                    return next
                  })
                }
              />{' '}
              <strong>{c.name}</strong> — {c.students.length} personne(s)
            </label>
          </li>
        ))}
      </ul>
      <div className="form-actions">
        <button onClick={onDone}>Annuler</button>
        <button
          className="primary"
          disabled={chosen.size === 0 || busy}
          onClick={() => {
            setBusy(true)
            void toFrames(buildTransfer({ classes, rooms, plans }, [...chosen])).then(setFrames)
          }}
        >
          Afficher le code
        </button>
      </div>
    </>
  )
}
