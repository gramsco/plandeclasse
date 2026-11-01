import { describe, expect, it } from 'vitest'
import { cardFromSdp, encodeCard, parseCard, sdpFromCard } from './pairing'

// Captured from Chrome (data channel only, no ICE server); addresses replaced by documentation ones.
const CHROME_OFFER = [
  'v=0',
  'o=- 1123403896514154450 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 65259 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 192.168.1.20',
  'a=candidate:2963379140 1 udp 2113937151 192.168.1.20 65259 typ host generation 0 network-cost 999',
  'a=candidate:109960927 1 udp 2113939711 2001:db8:ec6:6100:382d:8bb5:4f57:f48d 57460 typ host generation 0 network-cost 999',
  'a=candidate:1 1 tcp 1518280447 192.168.1.20 9 typ host tcptype active generation 0',
  'a=candidate:2 1 udp 41885439 203.0.113.7 40000 typ relay raddr 0.0.0.0 rport 0',
  'a=ice-ufrag:uZUG',
  'a=ice-pwd:/3Pw5i0+a3J06FhEjkvb/vqQ',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 C1:D9:E7:15:9D:8E:FC:BC:CB:60:DA:28:B6:56:EE:2B:9C:DC:27:DC:24:E9:85:B0:24:63:F1:D2:ED:C5:3F:FA',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n')

const CARD = [
  'PDC1',
  'o',
  'uZUG',
  '/3Pw5i0+a3J06FhEjkvb/vqQ',
  'c1d9e7159d8efcbccb60da28b656ee2b9cdc27dc24e985b02463f1d2edc53ffa',
  '192.168.1.20:65259,2001:db8:ec6:6100:382d:8bb5:4f57:f48d:57460',
].join('|')

describe('pairing card', () => {
  it('keeps only what a data-channel session needs from a browser SDP', () => {
    expect(encodeCard(cardFromSdp(CHROME_OFFER, 'offer'))).toBe(CARD)
  })

  it('leaves out relayed and TCP candidates, which need a server', () => {
    expect(cardFromSdp(CHROME_OFFER, 'offer').addresses).toEqual([
      '192.168.1.20:65259',
      '2001:db8:ec6:6100:382d:8bb5:4f57:f48d:57460',
    ])
  })

  it('stays small enough for a single low-density QR code', () => {
    expect(CARD.length).toBeLessThan(300)
  })

  it('round-trips through its text form', () => {
    const card = cardFromSdp(CHROME_OFFER, 'offer')
    expect(parseCard(encodeCard(card))).toEqual(card)
  })

  it('accepts mDNS host names', () => {
    const text = CARD.replace(/\|[^|]+$/, '|1179c779-c105-4179-af7d-4b30cac75aad.local:58576')
    expect(parseCard(text)?.addresses).toEqual(['1179c779-c105-4179-af7d-4b30cac75aad.local:58576'])
  })

  it('rebuilds an SDP with the same credentials, fingerprint and addresses', () => {
    const sdp = sdpFromCard(parseCard(CARD)!)
    expect(sdp).toContain('a=ice-ufrag:uZUG\r\n')
    expect(sdp).toContain('a=ice-pwd:/3Pw5i0+a3J06FhEjkvb/vqQ\r\n')
    expect(sdp).toContain(
      'a=fingerprint:sha-256 C1:D9:E7:15:9D:8E:FC:BC:CB:60:DA:28:B6:56:EE:2B:9C:DC:27:DC:24:E9:85:B0:24:63:F1:D2:ED:C5:3F:FA\r\n',
    )
    expect(sdp).toContain(' 192.168.1.20 65259 typ host\r\n')
    expect(sdp).toContain('a=setup:actpass\r\n')
  })

  it('makes the answerer take the active DTLS role', () => {
    expect(sdpFromCard({ ...parseCard(CARD)!, role: 'answer' })).toContain('a=setup:active\r\n')
  })

  it('explains the network problem when the device has no local address', () => {
    const noCandidates = CHROME_OFFER.replace(/a=candidate:.*\r\n/g, '')
    expect(() => cardFromSdp(noCandidates, 'offer')).toThrow(/réseau/)
  })

  it('ignores texts that are not a card', () => {
    expect(parseCard('https://example.org')).toBeUndefined()
    expect(parseCard('CLP1.t1.0.1.abc')).toBeUndefined()
    expect(parseCard('')).toBeUndefined()
  })

  it.each([
    ['a role that does not exist', CARD.replace('|o|', '|x|')],
    ['an extra field', CARD + '|more'],
    ['a short fingerprint', CARD.replace('c1d9e715', 'c1d9')],
    ['an uppercase fingerprint', CARD.replace('c1d9e715', 'C1D9E715')],
    ['no address', CARD.replace(/\|[^|]+$/, '|')],
    ['a port out of range', CARD.replace(':65259', ':70000')],
    ['an address without a port', CARD.replace(':65259', '')],
    ['too many addresses', CARD + ',10.0.0.1:1,10.0.0.2:1,10.0.0.3:1,10.0.0.4:1,10.0.0.5:1,10.0.0.6:1,10.0.0.7:1'],
  ])('rejects a card with %s', (_, text) => {
    expect(parseCard(text)).toBeUndefined()
  })

  it('rejects anything that could inject a line into the SDP', () => {
    expect(parseCard(CARD.replace('uZUG', 'uZ\r\nUG'))).toBeUndefined()
    expect(parseCard(CARD.replace('192.168.1.20:65259', '1.2.3.4 9 typ host\r\na=x:1'))).toBeUndefined()
    expect(parseCard(CARD.replace('/3Pw5i0+a3J06FhEjkvb/vqQ', '/3Pw5i0+a3J06FhEjk b/vqQ'))).toBeUndefined()
  })
})
