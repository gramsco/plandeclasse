/**
 * The "card" two devices swap to open a direct WebRTC channel with no server: the few SDP fields a
 * data-channel-only session needs, as one short text that fits a QR code.
 *
 * Card text: `PDC1|<o or a>|<ufrag>|<password>|<fingerprint>|<host:port>,<host:port>…`.
 *
 * A card comes from a scanned QR code, so it is untrusted. Every field is checked against a strict
 * alphabet before it is put back into an SDP: a crafted code must not be able to inject SDP lines.
 */
const PREFIX = 'PDC1'
const MAX_ADDRESSES = 8

export type CardRole = 'offer' | 'answer'

export type Card = {
  role: CardRole
  ufrag: string
  password: string
  /** SHA-256 of the sender's certificate, lowercase hex. It travels by camera, so nobody on the network can swap it. */
  fingerprint: string
  /** `host:port`; the host is an IPv4/IPv6 address or an mDNS name. */
  addresses: string[]
}

const ROLE_CODES: Record<CardRole, string> = { offer: 'o', answer: 'a' }
const UFRAG = /^[A-Za-z0-9+/]{4,32}$/
const PASSWORD = /^[A-Za-z0-9+/]{22,64}$/
const FINGERPRINT = /^[0-9a-f]{64}$/
const HOST = /^[A-Za-z0-9.:-]{1,80}$/

const validAddress = (address: string) => {
  const at = address.lastIndexOf(':')
  if (at < 1) return false
  const port = Number(address.slice(at + 1))
  return HOST.test(address.slice(0, at)) && Number.isInteger(port) && port >= 1 && port <= 65535
}

/** Also used when the browser refuses to open the connection. */
export const PAIRING_FAILED = 'La connexion directe a échoué. Réessayez.'

const NO_NETWORK =
  "Cet appareil n'a pas de connexion réseau locale. Connectez-le au Wi-Fi (ou au partage de connexion de l'autre appareil), puis recommencez."

/** Reads the card out of the SDP the browser produced. Throws a user-readable Error if it has no usable network address. */
export function cardFromSdp(sdp: string, role: CardRole): Card {
  const field = (pattern: RegExp) => sdp.match(pattern)?.[1]
  const ufrag = field(/^a=ice-ufrag:(\S+)/m)
  const password = field(/^a=ice-pwd:(\S+)/m)
  const fingerprint = field(/^a=fingerprint:sha-256 (\S+)/m)
    ?.replaceAll(':', '')
    .toLowerCase()
  // Host candidates over UDP only: the relayed and server-reflexive kinds need a server, which we never use.
  const addresses = [...sdp.matchAll(/^a=candidate:\S+ \d+ udp \d+ (\S+) (\d+) typ host/gim)]
    .map((m) => `${m[1]}:${m[2]}`)
    .filter(validAddress)
    .slice(0, MAX_ADDRESSES)
  if (addresses.length === 0) throw new Error(NO_NETWORK)
  if (!ufrag || !password || !fingerprint) throw new Error(PAIRING_FAILED)
  const card = { role, ufrag, password, fingerprint, addresses }
  if (!parseCard(encodeCard(card))) throw new Error(PAIRING_FAILED)
  return card
}

export const encodeCard = (card: Card): string =>
  [PREFIX, ROLE_CODES[card.role], card.ufrag, card.password, card.fingerprint, card.addresses.join(',')].join('|')

/** The card in a scanned text, or undefined if it is anything else (another QR code in the room, a corrupted read). */
export function parseCard(text: string): Card | undefined {
  const [prefix, roleCode, ufrag, password, fingerprint, addressList, ...extra] = text.split('|')
  const role = (Object.keys(ROLE_CODES) as CardRole[]).find((r) => ROLE_CODES[r] === roleCode)
  if (prefix !== PREFIX || extra.length > 0 || !role || !addressList) return undefined
  const addresses = addressList.split(',')
  if (
    !UFRAG.test(ufrag) ||
    !PASSWORD.test(password) ||
    !FINGERPRINT.test(fingerprint) ||
    addresses.length > MAX_ADDRESSES ||
    !addresses.every(validAddress)
  )
    return undefined
  return { role, ufrag, password, fingerprint, addresses }
}

/** The SDP to hand to `setRemoteDescription`: one data channel, no audio, no video. */
export function sdpFromCard(card: Card): string {
  const candidates = card.addresses.map((address, i) => {
    const at = address.lastIndexOf(':')
    return `a=candidate:${i + 1} 1 udp ${2113937151 - i} ${address.slice(0, at)} ${address.slice(at + 1)} typ host`
  })
  const fingerprint = card.fingerprint.toUpperCase().match(/../g)!.join(':')
  return (
    [
      'v=0',
      'o=- 1 1 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      `a=ice-ufrag:${card.ufrag}`,
      `a=ice-pwd:${card.password}`,
      `a=fingerprint:sha-256 ${fingerprint}`,
      // The offerer lets the other side pick its DTLS role; the answerer then takes the client one.
      `a=setup:${card.role === 'offer' ? 'actpass' : 'active'}`,
      'a=mid:0',
      'a=sctp-port:5000',
      'a=max-message-size:262144',
      ...candidates,
    ].join('\r\n') + '\r\n'
  )
}
