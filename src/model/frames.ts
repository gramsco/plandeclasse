/**
 * A payload too big for one QR code travels as several frames, shown in a loop. The receiver scans
 * them in whatever order the camera catches them, and repeats are harmless.
 *
 * Frame text: `CLP1.<transfer id>.<index>.<total>.<chunk>`. The id keeps the frames of two different
 * transfers from being mixed up when the camera still sees the previous screen.
 */
const PREFIX = 'CLP1'
/** Small enough for a low-density QR code that a webcam reads easily. */
export const FRAME_SIZE = 400
/** Over a direct connection there is no QR code to fit: frames only need to stay well under the channel's message limit. */
export const LINK_FRAME_SIZE = 16_000
/** Bounds what an untrusted frame can make us allocate. */
export const MAX_FRAMES = 200

export function splitFrames(payload: string, transferId: string, size = FRAME_SIZE): string[] {
  const total = Math.max(1, Math.ceil(payload.length / size))
  return Array.from(
    { length: total },
    (_, i) => `${PREFIX}.${transferId}.${i}.${total}.${payload.slice(i * size, (i + 1) * size)}`,
  )
}

export type Reception =
  | { status: 'idle' }
  | { status: 'receiving'; transferId: string; total: number; chunks: Record<number, string> }
  | { status: 'complete'; payload: string }

export const emptyReception: Reception = { status: 'idle' }

/** How many distinct frames were caught so far, out of how many. */
export const progressOf = (r: Reception) =>
  r.status === 'receiving' ? { received: Object.keys(r.chunks).length, total: r.total } : undefined

/**
 * Takes in one scanned text. Anything that is not a frame (another QR code in the room) is ignored;
 * a frame of another transfer restarts the reception, since the sender began a new one.
 */
export function receiveFrame(state: Reception, text: string): Reception {
  const [prefix, transferId, indexText, totalText, ...rest] = text.split('.')
  const index = Number(indexText)
  const total = Number(totalText)
  if (
    prefix !== PREFIX ||
    !transferId ||
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    total < 1 ||
    total > MAX_FRAMES ||
    index < 0 ||
    index >= total
  )
    return state
  const chunk = rest.join('.')

  const current = state.status === 'receiving' && state.transferId === transferId && state.total === total
  const chunks = { ...(current ? state.chunks : {}), [index]: chunk }
  if (Object.keys(chunks).length < total) return { status: 'receiving', transferId, total, chunks }
  return { status: 'complete', payload: Array.from({ length: total }, (_, i) => chunks[i]).join('') }
}

/** The id of the transfer a frame belongs to, if the text is a frame. */
export const transferIdOf = (text: string) => (text.startsWith(`${PREFIX}.`) ? text.split('.')[1] : undefined)

const ACK_PREFIX = 'CLA1'

/** What the receiver sends back once every frame of a transfer has arrived. */
export const ackFor = (transferId: string) => `${ACK_PREFIX}.${transferId}`

/** The transfer id an acknowledgement refers to, if the text is one. */
export const ackedId = (text: string) =>
  text.startsWith(`${ACK_PREFIX}.`) ? text.slice(ACK_PREFIX.length + 1) : undefined
