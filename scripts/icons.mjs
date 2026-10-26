// Génère les icônes PWA (PNG) sans dépendance : node scripts/icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, c])
}
const png = (w, h, rgba) => {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Distance signée à un rectangle arrondi (centre cx,cy ; demi-taille hx,hy ; rayon r).
const sdRect = (px, py, cx, cy, hx, hy, r) => {
  const qx = Math.abs(px - cx) - hx + r
  const qy = Math.abs(py - cy) - hy + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
const cover = (d) => Math.min(1, Math.max(0, 0.5 - d))

function icone(size, { arrondi }) {
  const buf = Buffer.alloc(size * size * 4)
  const u = size / 100
  // Contenu dans la zone sûre (≈ 60 % centraux) pour rester lisible en masque circulaire.
  const bureaux = [[34, 52], [66, 52], [34, 70], [66, 70]].map(([x, y]) => [x * u, y * u, 11 * u, 6 * u, 2 * u])
  const prof = [50 * u, 34 * u, 17 * u, 4.5 * u, 2 * u]
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const fond = arrondi ? cover(sdRect(x + 0.5, y + 0.5, size / 2, size / 2, size / 2, size / 2, size * 0.2)) : 1
      let [r, g, b] = [59, 111, 212]
      let blanc = 0
      for (const t of bureaux) blanc = Math.max(blanc, cover(sdRect(x + 0.5, y + 0.5, ...t)))
      const pf = cover(sdRect(x + 0.5, y + 0.5, ...prof)) * 0.7
      blanc = Math.max(blanc, pf)
      r = r + (255 - r) * blanc
      g = g + (255 - g) * blanc
      b = b + (255 - b) * blanc
      buf.set([Math.round(r), Math.round(g), Math.round(b), Math.round(fond * 255)], i)
    }
  return png(size, size, buf)
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', icone(192, { arrondi: true }))
writeFileSync('public/icons/icon-512.png', icone(512, { arrondi: true }))
writeFileSync('public/icons/icon-maskable-512.png', icone(512, { arrondi: false }))
writeFileSync('public/icons/apple-touch-icon.png', icone(180, { arrondi: false }))
console.log('Icônes générées dans public/icons')
