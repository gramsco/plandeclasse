import { useEffect, useState } from 'react'
import { decodePayload } from '../io/payloadCodec'
import { emptyReception, progressOf, receiveFrame, type Reception } from '../model/frames'
import { SyncReview } from './SyncReview'
import { useQrScanner } from './useQrScanner'

type Stage = { name: 'scanning' } | { name: 'failed'; message: string } | { name: 'read'; text: string }

/** Reads the QR codes shown by the other device, then lets the teacher pick what to apply. */
export function SyncReceive({ onDone }: { onDone(): void }) {
  const [stage, setStage] = useState<Stage>({ name: 'scanning' })
  const [reception, setReception] = useState<Reception>(emptyReception)

  const video = useQrScanner({
    active: stage.name === 'scanning',
    onCode: (text) => setReception((r) => receiveFrame(r, text)),
    onError: (message) => setStage({ name: 'failed', message }),
  })

  useEffect(() => {
    if (reception.status !== 'complete') return
    decodePayload(reception.payload).then(
      (text) => setStage({ name: 'read', text }),
      (e: Error) => setStage({ name: 'failed', message: e.message }),
    )
  }, [reception])

  const retry = () => {
    setReception(emptyReception)
    setStage({ name: 'scanning' })
  }

  if (stage.name === 'read') return <SyncReview text={stage.text} onDone={onDone} onRetry={retry} />
  if (stage.name === 'failed')
    return (
      <>
        <p role="alert">{stage.message}</p>
        <div className="form-actions">
          <button onClick={onDone}>Fermer</button>
          <button className="primary" onClick={retry}>
            Réessayer
          </button>
        </div>
      </>
    )

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
