import jsQR from 'jsqr'
import { describe, expect, it } from 'vitest'
import { encodeQr } from './qr'

/** Renders the modules as a camera would see them: black on white, with the quiet zone. */
function render(modules: boolean[][], scale = 4, quiet = 4) {
  const side = (modules.length + quiet * 2) * scale
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255)
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (!dark) return
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const at = ((y + quiet) * scale + dy) * side * 4 + ((x + quiet) * scale + dx) * 4
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0
        }
    }),
  )
  return { pixels, side }
}

const decode = (text: string) => {
  const { pixels, side } = render(encodeQr(text))
  return jsQR(pixels, side, side)?.data
}

const sample = (length: number) => Array.from({ length }, (_, i) => 'ABCxyz019-_.'[(i * 7) % 12]).join('')

describe('QR encoder', () => {
  // Each length lands in a different version: single block, several blocks, version info (7+), 16-bit counts.
  it.each([1, 14, 60, 134, 200, 335, 420, 700, 1200, 2000])('is decoded back by a reader (%i characters)', (length) => {
    const text = sample(length)
    expect(decode(text)).toBe(text)
  })

  it('carries a transfer frame', () => {
    const frame = `CLP1.k3f9.2.6.${sample(400)}`
    expect(decode(frame)).toBe(frame)
  })

  it('draws a square whose side grows with the content', () => {
    expect(encodeQr('a')).toHaveLength(21)
    expect(encodeQr(sample(400)).length).toBeGreaterThan(61)
  })

  it('refuses text that cannot fit', () => {
    expect(() => encodeQr(sample(3000))).toThrow('too long')
  })
})
