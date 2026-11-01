import { useState } from 'react'
import { Modal } from './Modal'
import { SyncReceive } from './SyncReceive'
import { SyncSend } from './SyncSend'

/** Moves the edits made on a phone to the computer, through QR codes: nothing goes over the network. */
export function SyncDialog({ onClose }: { onClose(): void }) {
  const [mode, setMode] = useState<'send' | 'receive'>()
  return (
    <Modal title="Synchroniser" onClose={onClose}>
      {mode === 'send' ? (
        <SyncSend onDone={onClose} />
      ) : mode === 'receive' ? (
        <SyncReceive onDone={onClose} />
      ) : (
        <>
          <p>
            Reportez sur l'ordinateur les modifications faites sur le téléphone (places, feux, annotations, notes…). Les
            données ne passent par aucun serveur : elles sont lues à la caméra.
          </p>
          <div className="form-actions">
            <button onClick={onClose}>Annuler</button>
            <button onClick={() => setMode('send')}>Envoyer (depuis ce téléphone)</button>
            <button className="primary" onClick={() => setMode('receive')}>
              Recevoir (sur cet ordinateur)
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
