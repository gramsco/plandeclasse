import { useState } from 'react'
import { Modal } from './Modal'
import { SyncLink } from './SyncLink'
import { SyncReceive } from './SyncReceive'
import { SyncSend } from './SyncSend'

/** Moves data between two devices, by QR codes or over a direct connection: no server is ever involved. */
export function SyncDialog({ onClose }: { onClose(): void }) {
  const [mode, setMode] = useState<'send' | 'receive' | 'link'>()
  return (
    <Modal title="Synchroniser" onClose={onClose}>
      {mode === 'send' ? (
        <SyncSend
          onDone={onClose}
          lead="Un code s'affichera pour que l'autre appareil le lise avec sa caméra. Que voulez-vous envoyer ?"
        />
      ) : mode === 'receive' ? (
        <SyncReceive onDone={onClose} />
      ) : mode === 'link' ? (
        <SyncLink onDone={onClose} />
      ) : (
        <>
          <p>
            Passez des données d'un appareil à l'autre sans serveur. Avec des codes : l'un affiche (« Envoyer »),
            l'autre lit avec sa caméra (« Recevoir »). Ou, pour des échanges répétés sur le même Wi-Fi, reliez les deux
            appareils une fois avec « Connexion directe ».
          </p>
          <div className="form-actions">
            <button onClick={onClose}>Annuler</button>
            <button onClick={() => setMode('link')}>Connexion directe</button>
            <button onClick={() => setMode('send')}>Envoyer</button>
            <button className="primary" onClick={() => setMode('receive')}>
              Recevoir
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
