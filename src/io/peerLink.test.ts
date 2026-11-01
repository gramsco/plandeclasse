import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPeerLink } from './peerLink'

// A browser SDP carrying one host candidate, enough for the link to build its card.
const SDP = [
  'v=0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'a=candidate:1 1 udp 2113937151 192.168.1.20 50000 typ host generation 0',
  'a=ice-ufrag:uZUG',
  'a=ice-pwd:/3Pw5i0+a3J06FhEjkvb/vqQ',
  `a=fingerprint:sha-256 ${'AB:'.repeat(31)}AB`,
  'a=setup:actpass',
  '',
].join('\r\n')

class FakeConnection {
  static last: FakeConnection | undefined
  static options: unknown
  iceGatheringState = 'complete'
  iceConnectionState = 'new'
  localDescription: { sdp: string } | null = null
  oniceconnectionstatechange: (() => void) | null = null
  ondatachannel: unknown = null
  closed = false
  constructor(options: unknown) {
    FakeConnection.options = options
    FakeConnection.last = this
  }
  createDataChannel() {
    return { readyState: 'connecting', close() {} }
  }
  createOffer = async () => ({ type: 'offer', sdp: SDP })
  setLocalDescription = async () => void (this.localDescription = { sdp: SDP })
  addEventListener() {}
  removeEventListener() {}
  close() {
    this.closed = true
  }
  failIce() {
    this.iceConnectionState = 'failed'
    this.oniceconnectionstatechange?.()
  }
}

beforeEach(() => vi.stubGlobal('RTCPeerConnection', FakeConnection))
afterEach(() => vi.unstubAllGlobals())

describe('peer link', () => {
  it('never uses an ICE server, so no third party sees an address', async () => {
    await createPeerLink().createOffer()
    expect(FakeConnection.options).toEqual({ iceServers: [] })
  })

  it('builds the card to show from the browser SDP', async () => {
    const card = await createPeerLink().createOffer()
    expect(card).toMatch(/^PDC1\|o\|uZUG\|/)
    expect(card).toContain('192.168.1.20:50000')
  })

  it('can start over after a failed connection', async () => {
    const link = createPeerLink()
    await link.createOffer()
    // The answer would arrive here; a connection that never opens ends up failed.
    FakeConnection.last!.failIce()
    expect(link.state()).toBe('failed')

    link.close()
    expect(link.state()).toBe('idle')
    expect(FakeConnection.last!.closed).toBe(true)
    await link.createOffer()
    expect(link.state()).toBe('idle')
  })

  it('refuses to send while no channel is open', () => {
    expect(() => createPeerLink().send('x')).toThrow(/coupée/)
  })
})
