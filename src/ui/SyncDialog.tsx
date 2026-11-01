import { useState } from 'react'
import { Modal } from './Modal'
import { SyncReceive } from './SyncReceive'
import { SyncSendChanges, SyncSendClasses } from './SyncSend'

/** Moves data between a phone and a computer through QR codes: nothing goes over the network. */
export function SyncDialog({ onClose }: { onClose(): void }) {
  const [mode, setMode] = useState<'classes' | 'changes' | 'receive'>()
  return (
    <Modal title="Synchroniser" onClose={onClose}>
      {mode === 'classes' ? (
        <SyncSendClasses onDone={onClose} />
      ) : mode === 'changes' ? (
        <SyncSendChanges onDone={onClose} />
      ) : mode === 'receive' ? (
        <SyncReceive onDone={onClose} />
      ) : (
        <>
          <p>
            Passez des données d'un appareil à l'autre en les lisant à la caméra : elles ne passent par aucun serveur.
            Sur un appareil, choisissez « Envoyer » ; sur l'autre, « Recevoir ».
          </p>
          <ul className="sync-menu">
            <li>
              <strong>Envoyer mes classes</strong> : pour installer vos classes sur un nouvel appareil (premier
              transfert, sans les photos).
            </li>
            <li>
              <strong>Envoyer mes modifications</strong> : pour reporter des modifications faites depuis la dernière
              synchronisation.
            </li>
          </ul>
          <div className="form-actions">
            <button onClick={onClose}>Annuler</button>
            <button onClick={() => setMode('classes')}>Envoyer mes classes</button>
            <button onClick={() => setMode('changes')}>Envoyer mes modifications</button>
            <button className="primary" onClick={() => setMode('receive')}>
              Recevoir
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
