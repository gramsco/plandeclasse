import { useEffect, useState } from 'react'
import { encodePatch } from '../io/patchCodec'
import { splitFrames } from '../model/frames'
import { buildPatch } from '../model/sync'
import { EPOCH, newId } from '../model/types'
import { useApp } from '../store'
import { QrSvg } from './QrSvg'

const LAST_SYNC_KEY = 'lastSyncSent'
const FRAME_MS = 900

/** Shows the edits made since the last sync as a QR code (several, in a loop, when they are many). */
export function SyncSend({ onDone }: { onDone(): void }) {
  const { classes, plans } = useApp()
  const [since] = useState(() => localStorage.getItem(LAST_SYNC_KEY) ?? EPOCH)
  const [now] = useState(() => new Date().toISOString())
  const [frames, setFrames] = useState<string[]>()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const patch = buildPatch(classes, plans, since, now)
    if (patch.students.length + patch.plans.length === 0) return setFrames([])
    void encodePatch(patch).then((payload) => setFrames(splitFrames(payload, newId().slice(0, 6))))
    // The patch is frozen when the panel opens: edits made while it shows must not change the frames.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!frames || frames.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS)
    return () => clearInterval(timer)
  }, [frames])

  const finish = () => {
    localStorage.setItem(LAST_SYNC_KEY, now)
    onDone()
  }

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
    <>
      <p>Sur l'ordinateur : Synchroniser → Recevoir, puis visez ce code avec la caméra.</p>
      <div className="qr-box">
        <QrSvg text={frames[index]} label={`Code ${index + 1} sur ${frames.length}`} />
      </div>
      <p className="hint" aria-live="off">
        {frames.length > 1
          ? `Le code change tout seul (${index + 1} / ${frames.length}) : gardez-le devant la caméra jusqu'à la fin de la lecture.`
          : 'Gardez ce code devant la caméra.'}
      </p>
      <div className="form-actions">
        <button onClick={onDone}>Annuler</button>
        <button className="primary" onClick={finish}>
          L'ordinateur a tout reçu
        </button>
      </div>
    </>
  )
}
