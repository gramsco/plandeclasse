/**
 * QR code encoder: byte mode, error correction level M, versions 1 to 40. Written here rather than
 * pulled in as a dependency (about 200 lines); `qr.test.ts` checks it by decoding its output.
 */

// Level M only. Indexed by version (index 0 is unused).
const ECC_CODEWORDS_PER_BLOCK = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
]
const NUM_BLOCKS = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33,
  35, 37, 38, 40, 43, 45, 47, 49,
]
const FORMAT_LEVEL_M = 0

export const MAX_QR_VERSION = 40

const sizeOf = (version: number) => version * 4 + 17

function alignmentPositions(version: number): number[] {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
  const positions = [6]
  for (let pos = sizeOf(version) - 7; positions.length < count; pos -= step) positions.splice(1, 0, pos)
  return positions
}

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

const dataCodewords = (version: number) =>
  Math.floor(rawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[version] * NUM_BLOCKS[version]

// ---- Reed-Solomon over GF(256), polynomial 0x11D ----
function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = gfMultiply(root, 2)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const b of data) {
    const factor = b ^ result.shift()!
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= gfMultiply(coef, factor)))
  }
  return result
}

// ---- Data -> codewords ----
function dataBytes(bytes: Uint8Array, version: number): number[] | undefined {
  const capacityBits = dataCodewords(version) * 8
  const countBits = version < 10 ? 8 : 16
  if (4 + countBits + bytes.length * 8 > capacityBits) return undefined
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, countBits)
  bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, capacityBits - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0xec; codewords.length < dataCodewords(version); pad ^= 0xec ^ 0x11) codewords.push(pad)
  return codewords
}

function interleaveWithEcc(data: number[], version: number): number[] {
  const numBlocks = NUM_BLOCKS[version]
  const eccLen = ECC_CODEWORDS_PER_BLOCK[version]
  const rawCodewords = Math.floor(rawDataModules(version) / 8)
  const numShort = numBlocks - (rawCodewords % numBlocks)
  const shortLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const block = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += block.length
    const ecc = rsRemainder(block, divisor)
    if (i < numShort) block.push(0) // keeps the columns aligned; skipped when interleaving
    blocks.push(block.concat(ecc))
  }
  const result: number[] = []
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i])
    })
  return result
}

// ---- Drawing ----
type Grid = boolean[][]

function drawFunctionPatterns(version: number, modules: Grid, isFunction: Grid) {
  const size = sizeOf(version)
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark
    isFunction[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4)
      }
  const align = alignmentPositions(version)
  align.forEach((cx, i) =>
    align.forEach((cy, j) => {
      const onFinder =
        (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)
      if (onFinder) return
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }),
  )
  drawFormat(0, modules, isFunction) // reserves the area; redrawn once the mask is known
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(a, b, dark)
      set(b, a, dark)
    }
  }
}

function drawFormat(mask: number, modules: Grid, isFunction: Grid) {
  const size = modules.length
  const data = (FORMAT_LEVEL_M << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const bits = ((data << 10) | rem) ^ 0x5412
  const bit = (i: number) => ((bits >>> i) & 1) !== 0
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark
    isFunction[y][x] = true
  }
  for (let i = 0; i <= 5; i++) set(8, i, bit(i))
  set(8, 7, bit(6))
  set(8, 8, bit(7))
  set(7, 8, bit(8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i))
  set(8, size - 8, true) // the always-dark module
}

function drawCodewords(codewords: number[], modules: Grid, isFunction: Grid) {
  const size = modules.length
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5 // the vertical timing pattern takes column 6
    for (let offset = 0; offset < size; offset++)
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const y = ((right + 1) & 2) === 0 ? size - 1 - offset : offset
        if (!isFunction[y][x] && i < codewords.length * 8) {
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
          i++
        }
      }
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function applyMask(mask: number, modules: Grid, isFunction: Grid) {
  modules.forEach((row, y) =>
    row.forEach((_, x) => {
      if (!isFunction[y][x] && MASKS[mask](x, y)) row[x] = !row[x]
    }),
  )
}

/** The standard's four penalty rules: long runs, 2x2 blocks, finder-like patterns, dark/light balance. */
function penalty(modules: Grid): number {
  const n = modules.length
  const columns = modules.map((_, x) => modules.map((row) => row[x]))
  let score = 0
  const FINDER = [true, false, true, true, true, false, true]
  for (const lines of [modules, columns])
    for (const line of lines) {
      let run = 1
      for (let i = 1; i <= n; i++) {
        if (i < n && line[i] === line[i - 1]) run++
        else {
          if (run >= 5) score += 3 + (run - 5)
          run = 1
        }
      }
      for (let i = 0; i + 7 <= n; i++) {
        if (!FINDER.every((dark, k) => line[i + k] === dark)) continue
        const light = (from: number, to: number) => {
          for (let k = from; k < to; k++) if (k >= 0 && k < n && line[k]) return false
          return true
        }
        if (light(i - 4, i)) score += 40
        if (light(i + 7, i + 11)) score += 40
      }
    }
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) {
      const c = modules[y][x]
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3
    }
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
  score += (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10
  return score
}

/**
 * Encodes text as QR modules (`true` = dark), without the quiet zone.
 * Throws if the text does not fit in the largest version.
 */
export function encodeQr(text: string): Grid {
  const bytes = new TextEncoder().encode(text)
  let version = 1
  let codewords = dataBytes(bytes, version)
  while (!codewords && version < MAX_QR_VERSION) codewords = dataBytes(bytes, ++version)
  if (!codewords) throw new Error('Text too long for a QR code.')

  const size = sizeOf(version)
  const modules: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const isFunction: Grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  drawFunctionPatterns(version, modules, isFunction)
  drawCodewords(interleaveWithEcc(codewords, version), modules, isFunction)

  let best = { mask: 0, score: Infinity }
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask, modules, isFunction)
    drawFormat(mask, modules, isFunction)
    const score = penalty(modules)
    if (score < best.score) best = { mask, score }
    applyMask(mask, modules, isFunction) // XOR again: undoes it
  }
  applyMask(best.mask, modules, isFunction)
  drawFormat(best.mask, modules, isFunction)
  return modules
}
