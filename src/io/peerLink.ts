import { cardFromSdp, encodeCard, PAIRING_FAILED, sdpFromCard, type Card } from '../model/pairing'

export type LinkState = 'idle' | 'connecting' | 'open' | 'closed' | 'failed'
export type LinkEvent = { kind: 'state'; state: LinkState } | { kind: 'message'; text: string }

/** With no server to relay addresses, gathering only lists local ones and ends at once; this is a safety net. */
const GATHER_TIMEOUT_MS = 3000
const CONNECT_TIMEOUT_MS = 20_000

/**
 * A direct channel to another device, with no server in between. The two devices swap their cards
 * (see `model/pairing`) by QR code, then talk over the local network.
 */
export type PeerLink = {
  state(): LinkState
  subscribe(listener: (event: LinkEvent) => void): () => void
  /** Starts a connection; returns the card to show to the other device. */
  createOffer(): Promise<string>
  /** Takes the other device's offer; returns the card to show back to it. */
  acceptOffer(card: Card): Promise<string>
  acceptAnswer(card: Card): Promise<void>
  send(text: string): void
  /** Hangs up. The link can be used again for a new connection. */
  close(): void
}

export function createPeerLink(): PeerLink {
  let pc: RTCPeerConnection | undefined
  let channel: RTCDataChannel | undefined
  let connectTimer: ReturnType<typeof setTimeout> | undefined
  let state: LinkState = 'idle'
  const listeners = new Set<(event: LinkEvent) => void>()

  const emit = (event: LinkEvent) => listeners.forEach((listener) => listener(event))
  const setState = (next: LinkState) => {
    if (next === state) return
    state = next
    emit({ kind: 'state', state })
  }

  const watchChannel = (next: RTCDataChannel) => {
    channel = next
    next.onopen = () => {
      clearTimeout(connectTimer)
      setState('open')
    }
    next.onclose = () => setState(state === 'open' ? 'closed' : state)
    next.onmessage = (event) => {
      if (typeof event.data === 'string') emit({ kind: 'message', text: event.data })
    }
  }

  const connection = () => {
    if (pc) return pc
    // No ICE server on purpose: STUN and TURN servers are third parties, and the data stays on the local network.
    const created = new RTCPeerConnection({ iceServers: [] })
    created.ondatachannel = (event) => watchChannel(event.channel)
    created.oniceconnectionstatechange = () => {
      // The joiner waits for the first device to scan its card: the clock only starts once checks begin.
      if (created.iceConnectionState === 'checking' && state === 'connecting') armTimer()
      // 'closed' only ever follows an open channel; a connection that never opened has 'failed'.
      if (created.iceConnectionState === 'failed') setState(state === 'open' ? 'closed' : 'failed')
    }
    pc = created
    return created
  }

  const gathered = (peer: RTCPeerConnection) =>
    new Promise<void>((resolve) => {
      if (peer.iceGatheringState === 'complete') return resolve()
      const done = () => {
        clearTimeout(timer)
        peer.removeEventListener('icegatheringstatechange', onChange)
        resolve()
      }
      const onChange = () => peer.iceGatheringState === 'complete' && done()
      const timer = setTimeout(done, GATHER_TIMEOUT_MS)
      peer.addEventListener('icegatheringstatechange', onChange)
    })

  const armTimer = () => {
    clearTimeout(connectTimer)
    connectTimer = setTimeout(() => state === 'connecting' && setState('failed'), CONNECT_TIMEOUT_MS)
  }

  const localCard = async (peer: RTCPeerConnection, role: Card['role']) => {
    await peer.setLocalDescription(role === 'offer' ? await peer.createOffer() : await peer.createAnswer())
    await gathered(peer)
    const sdp = peer.localDescription?.sdp
    if (!sdp) throw new Error(PAIRING_FAILED)
    return encodeCard(cardFromSdp(sdp, role))
  }

  const close = () => {
    clearTimeout(connectTimer)
    if (channel) channel.onclose = null
    channel?.close()
    pc?.close()
    channel = pc = undefined
    // An open channel that is hung up reads as cut; anything else (failed, still connecting) starts afresh.
    setState(state === 'open' ? 'closed' : 'idle')
  }

  const requireRole = (card: Card, role: Card['role']) => {
    if (card.role !== role) throw new Error(PAIRING_FAILED)
  }

  return {
    state: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async createOffer() {
      close()
      setState('idle')
      const peer = connection()
      watchChannel(peer.createDataChannel('sync'))
      return localCard(peer, 'offer')
    },
    async acceptOffer(card) {
      requireRole(card, 'offer')
      close()
      setState('idle')
      const peer = connection()
      await peer.setRemoteDescription({ type: 'offer', sdp: sdpFromCard(card) })
      const answer = await localCard(peer, 'answer')
      setState('connecting')
      return answer
    },
    async acceptAnswer(card) {
      requireRole(card, 'answer')
      if (!pc) throw new Error(PAIRING_FAILED)
      await pc.setRemoteDescription({ type: 'answer', sdp: sdpFromCard(card) })
      setState('connecting')
      armTimer()
    },
    send(text) {
      if (channel?.readyState !== 'open') throw new Error("La connexion avec l'autre appareil est coupée.")
      channel.send(text)
    },
    close,
  }
}
