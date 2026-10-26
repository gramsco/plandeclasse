import { isAesh, type Gender } from '../model/types'
import { useApp } from '../store'

function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SKIN_TONES = ['#f5d5b8', '#e8b98f', '#d19a6e', '#a8734a', '#7a4f33', '#573822']
const HAIR_COLORS = ['#2b1d14', '#5a3a22', '#8a5a2b', '#c99a4b', '#d9d2c4', '#b5432a', '#1e1e24']

/** Draws a small cartoon face, deterministic for a given `seed` (200×200 JPEG). */
export function generateAvatar(seed: number, gender?: Gender, size = 200): Promise<Blob> {
  const random = seededRandom(seed * 7919 + 13)
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.scale(size / 200, size / 200)

  const skin = pick(SKIN_TONES)
  const hair = pick(HAIR_COLORS)
  // 0 short, 1 long, 2 bun, 3 curly, 4 very short
  const styles = gender === 'girl' ? [1, 1, 2, 3, 0] : gender === 'boy' ? [0, 0, 4, 4, 3] : [0, 1, 2, 3, 4]
  const style = styles[Math.floor(random() * styles.length)]
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
    g.fillStyle = color
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
  }

  g.fillStyle = `hsl(${Math.floor(random() * 360)} 55% 85%)`
  g.fillRect(0, 0, 200, 200)

  if (style === 1) ellipse(100, 105, 62, 78, hair) // long hair, behind the head
  if (style === 2) ellipse(100, 38, 20, 18, hair) // bun
  ellipse(100, 205, 78, 60, `hsl(${Math.floor(random() * 360)} 50% 50%)`) // shoulders
  g.fillStyle = skin
  g.fillRect(85, 128, 30, 30) // neck
  ellipse(100, 98, 46, 54, skin) // head
  ellipse(55, 102, 7, 11, skin)
  ellipse(145, 102, 7, 11, skin) // ears

  // front hair
  g.fillStyle = hair
  if (style === 3) {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI
      ellipse(100 + Math.cos(a) * 44, 82 + Math.sin(a) * 46, 16, 16, hair)
    }
  } else {
    g.beginPath()
    g.ellipse(100, 78, 48, style === 4 ? 30 : 38, 0, Math.PI, Math.PI * 2)
    g.fill()
    if (style === 0 || style === 1 || style === 2) {
      g.beginPath() // fringe
      g.moveTo(54, 80)
      g.quadraticCurveTo(100, random() > 0.5 ? 50 : 62, 146, 80)
      g.lineTo(146, 70)
      g.lineTo(54, 70)
      g.fill()
    }
  }

  // face
  const eyeColor = pick(['#2b2b2b', '#3b5b8a', '#4a6b3a', '#6b4423'])
  ellipse(82, 100, 5, 6, '#fff')
  ellipse(118, 100, 5, 6, '#fff')
  ellipse(82, 101, 3.2, 3.8, eyeColor)
  ellipse(118, 101, 3.2, 3.8, eyeColor)
  g.strokeStyle = hair
  g.lineWidth = 3
  g.lineCap = 'round'
  for (const x of [82, 118]) {
    g.beginPath()
    g.moveTo(x - 8, 88 - random() * 3)
    g.lineTo(x + 8, 88 - random() * 3)
    g.stroke()
  }
  g.strokeStyle = 'rgba(0,0,0,.25)'
  g.lineWidth = 2.5
  g.beginPath() // nose
  g.moveTo(100, 104)
  g.quadraticCurveTo(95, 118, 102, 119)
  g.stroke()
  g.strokeStyle = '#8a3b3b'
  g.lineWidth = 3.5
  g.beginPath() // mouth
  const smile = 6 + random() * 10
  g.moveTo(84, 130)
  g.quadraticCurveTo(100, 130 + smile, 116, 130)
  g.stroke()

  if (random() < 0.3) {
    g.strokeStyle = '#333'
    g.lineWidth = 3
    for (const x of [82, 118]) {
      g.beginPath()
      g.arc(x, 100, 13, 0, Math.PI * 2)
      g.stroke()
    }
    g.beginPath()
    g.moveTo(95, 100)
    g.lineTo(105, 100)
    g.stroke()
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('avatar'))), 'image/jpeg', 0.8),
  )
}

/** Gives a drawn face to everyone in the class who has no photo yet. */
export async function addFakePhotos(classId: string) {
  const state = useApp.getState()
  state.selectClass(classId)
  const schoolClass = state.classes.find((c) => c.id === classId)
  if (!schoolClass) return
  let index = 0
  for (const student of schoolClass.students) {
    index++
    if (student.photoId) continue
    await useApp
      .getState()
      .setPhoto(student.id, await generateAvatar(isAesh(student) ? 1000 + index : index, student.gender))
  }
}

/** Creates the fictional 28-student class, with drawn photos. */
export async function createDemoClass() {
  const id = useApp.getState().addDemoClass()
  await addFakePhotos(id)
  return id
}
