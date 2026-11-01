/** A payload is a few KB of JSON; this only stops a crafted QR code from inflating into memory. */
const MAX_JSON_BYTES = 5_000_000

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity) {
  const writer = stream.writable.getWriter()
  // A failure also reaches the reader below, which is where it is reported.
  writer
    .write(bytes as Uint8Array<ArrayBuffer>)
    .then(() => writer.close())
    .catch(() => {})
  const reader = stream.readable.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error('too large')
    }
    parts.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string) => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** Compressed, then written with characters that are safe inside a QR code and a frame. */
export async function encodePayload(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value))
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
}

/** Reverse of `encodePayload`, up to the JSON text. Throws a user-readable Error if it is not a payload. */
export async function decodePayload(payload: string): Promise<string> {
  try {
    const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'), MAX_JSON_BYTES)
    return new TextDecoder().decode(bytes)
  } catch {
    throw new Error('Ces données ne sont pas valides.')
  }
}
