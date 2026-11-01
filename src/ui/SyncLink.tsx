import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPeerLink, type PeerLink } from '../io/peerLink'
import {
  ackedId,
  ackFor,
  emptyReception,
  LINK_FRAME_SIZE,
  MAX_FRAMES,
  receiveFrame,
  splitFrames,
  transferIdOf,
  type Reception,
} from '../model/frames'
import { parseCard } from '../model/pairing'
import { newId } from '../model/types'
import { QrSvg } from './QrSvg'
import { SyncReview } from './SyncReview'
import { SyncSend, type Delivery } from './SyncSend'
import { useQrScanner } from './useQrScanner'

const ACK_TIMEOUT_MS = 30_000
const CUT = "La connexion avec l'autre appareil est coupée."

const useLinkState = (link: PeerLink) => useSyncExternalStore((notify) => link.subscribe(notify), link.state)

type Role = 'start' | 'join'

const NETWORK_HELP =
  "Les deux appareils n'ont pas réussi à se connecter. Vérifiez qu'ils sont sur le même réseau Wi-Fi, ou que l'un utilise le partage de connexion de l'autre : certains réseaux (écoles, lieux publics) empêchent les appareils de se voir."

/** Swaps the two QR codes that let the devices find each other, then waits for the channel to open. */
function LinkSetup({
  link,
  role,
  onCancel,
  onRestart,
}: {
  link: PeerLink
  role: Role
  onCancel(): void
  onRestart(): void
}) {
  const state = useLinkState(link)
  const [card, setCard] = useState<string>()
  const [scanning, setScanning] = useState(true)
  const [error, setError] = useState<string>()
  const handled = useRef(false)

  const fail = (message: string) => {
    setError(message)
    setScanning(false)
  }

  const video = useQrScanner({
    active: scanning,
    onError: fail,
    // The offer is made once the camera runs: browsers only reveal real local addresses (instead of random
    // names the other device may not resolve) to a page that was allowed to use the camera.
    onReady: () => {
      if (role === 'start') link.createOffer().then(setCard, (e: Error) => fail(e.message))
    },
    onCode: (text) => {
      const scanned = parseCard(text)
      if (!scanned || handled.current) return
      if (role === 'start' && scanned.role === 'answer' && card) {
        handled.current = true
        setScanning(false)
        link.acceptAnswer(scanned).catch((e: Error) => fail(e.message))
      } else if (role === 'join' && scanned.role === 'offer') {
        handled.current = true
        // The camera stays on until the answer is made, for the reason above.
        link.acceptOffer(scanned).then(
          (answer) => {
            setCard(answer)
            setScanning(false)
          },
          (e: Error) => fail(e.message),
        )
      }
    },
  })

  const message = error ?? (state === 'failed' ? NETWORK_HELP : undefined)
  if (message)
    return (
      <>
        <p role="alert">{message}</p>
        <div className="form-actions">
          <button onClick={onCancel}>Fermer</button>
          <button className="primary" onClick={onRestart}>
            Recommencer
          </button>
        </div>
      </>
    )

  const connecting = state === 'connecting'
  return (
    <>
      {role === 'start' ? (
        <p>
          {card && !connecting
            ? "Sur l'autre appareil : Synchroniser → Connexion directe → Rejoindre, puis visez ce code. L'autre appareil affichera alors son code : présentez-le à la caméra ci-dessous."
            : connecting
              ? 'Connexion en cours…'
              : 'Démarrage de la caméra…'}
        </p>
      ) : (
        <p>
          {card
            ? 'Présentez ce code à la caméra du premier appareil. Connexion en cours…'
            : 'Visez le code affiché par le premier appareil (Synchroniser → Connexion directe → Commencer).'}
        </p>
      )}
      {/* The joiner's code must stay up until the first device has read it: connecting only starts once it did. */}
      {card && (role === 'join' || !connecting) && (
        <div className="qr-box">
          <QrSvg text={card} label="Code de connexion" />
        </div>
      )}
      <video ref={video} className="sync-video" hidden={!scanning} muted playsInline aria-label="Image de la caméra" />
      <div className="form-actions">
        <button onClick={onCancel}>Annuler</button>
      </div>
    </>
  )
}

type Incoming = { text: string; n: number }
type Pending = { resolve(): void; reject(error: Error): void }

/** Once connected, both devices can send; what arrives goes through the same review as a scanned transfer. */
function LinkSession({ link, onDone }: { link: PeerLink; onDone(): void }) {
  const state = useLinkState(link)
  // Transfers wait for their turn: one arriving mid-review must not replace the review in progress.
  const [queue, setQueue] = useState<Incoming[]>([])
  const reception = useRef<Reception>(emptyReception)
  const pending = useRef(new Map<string, Pending>())
  const received = useRef(0)

  useEffect(
    () =>
      link.subscribe((event) => {
        if (event.kind !== 'message' || event.text.length > LINK_FRAME_SIZE + 64) return
        const acked = ackedId(event.text)
        if (acked) return pending.current.get(acked)?.resolve()
        reception.current = receiveFrame(reception.current, event.text)
        if (reception.current.status !== 'complete') return
        const text = reception.current.payload
        reception.current = emptyReception
        received.current += 1
        setQueue((q) => [...q, { text, n: received.current }])
        const id = transferIdOf(event.text)
        try {
          if (id) link.send(ackFor(id))
        } catch {
          // the link just dropped: the sender reports it
        }
      }),
    [link],
  )

  useEffect(() => {
    if (state !== 'closed') return
    for (const { reject } of [...pending.current.values()]) reject(new Error(CUT))
  }, [state])

  const [delivery] = useState<Delivery>(() => ({
    send: (value) =>
      new Promise<void>((resolve, reject) => {
        const id = newId().slice(0, 6)
        const frames = splitFrames(JSON.stringify(value), id, LINK_FRAME_SIZE)
        if (frames.length > MAX_FRAMES) return reject(new Error('Il y a trop de données à envoyer en une fois.'))
        const done = () => {
          clearTimeout(timer)
          pending.current.delete(id)
        }
        const timer = setTimeout(() => {
          done()
          reject(new Error("L'autre appareil n'a pas confirmé la réception. Vérifiez qu'il est toujours connecté."))
        }, ACK_TIMEOUT_MS)
        pending.current.set(id, {
          resolve: () => {
            done()
            resolve()
          },
          reject: (error) => {
            done()
            reject(error)
          },
        })
        try {
          for (const frame of frames) link.send(frame)
        } catch (e) {
          done()
          reject(e as Error)
        }
      }),
  }))

  if (state === 'closed')
    return (
      <>
        <p role="alert">{CUT}</p>
        <div className="form-actions">
          <button className="primary" autoFocus onClick={onDone}>
            Fermer
          </button>
        </div>
      </>
    )
  // Hidden rather than unmounted: a send in progress must still report its outcome once the review is done.
  return (
    <>
      {queue.length > 0 && (
        <SyncReview key={queue[0].n} text={queue[0].text} onDone={() => setQueue((q) => q.slice(1))} />
      )}
      <div hidden={queue.length > 0}>
        <SyncSend
          delivery={delivery}
          onDone={onDone}
          cancelLabel="Déconnecter"
          lead="Connecté. Les données passent directement d'un appareil à l'autre. Ce que l'autre appareil vous envoie s'affiche ici, et vous choisissez ce qu'il faut appliquer. Que voulez-vous envoyer ?"
        />
      </div>
    </>
  )
}

/** Moves data between two devices over the local network, with no server: QR codes only introduce them. */
export function SyncLink({ onDone }: { onDone(): void }) {
  const [link] = useState(createPeerLink)
  const state = useLinkState(link)
  const [role, setRole] = useState<Role>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => () => link.close(), [link])

  // 'closed' only follows an open channel: the session then says the connection was cut.
  if (state === 'open' || state === 'closed') return <LinkSession link={link} onDone={onDone} />
  if (role)
    return (
      <LinkSetup
        key={attempt}
        link={link}
        role={role}
        onCancel={onDone}
        onRestart={() => {
          link.close()
          setAttempt((n) => n + 1)
        }}
      />
    )
  return (
    <>
      <p>
        Les deux appareils doivent être sur le même réseau Wi-Fi (ou l'un sur le partage de connexion de l'autre). Ils
        s'échangent deux codes QR pour se reconnaître, puis les données passent directement de l'un à l'autre : aucun
        serveur, aucun compte, rien ne passe par Internet.
      </p>
      <ol className="sync-menu">
        <li>
          Sur le premier appareil, choisissez <strong>Commencer</strong> : un code s'affiche.
        </li>
        <li>
          Sur le second, choisissez <strong>Rejoindre</strong> et visez ce code.
        </li>
        <li>Le second affiche à son tour un code : présentez-le à la caméra du premier.</li>
      </ol>
      <div className="form-actions">
        <button onClick={onDone}>Annuler</button>
        <button onClick={() => setRole('join')}>Rejoindre</button>
        <button className="primary" onClick={() => setRole('start')}>
          Commencer
        </button>
      </div>
    </>
  )
}
