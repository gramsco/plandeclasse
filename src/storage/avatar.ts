import { estAesh } from '../model/types'
import { useApp } from '../store'

function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PEAUX = ['#f5d5b8', '#e8b98f', '#d19a6e', '#a8734a', '#7a4f33', '#573822']
const CHEVEUX = ['#2b1d14', '#5a3a22', '#8a5a2b', '#c99a4b', '#d9d2c4', '#b5432a', '#1e1e24']

/** Dessine un petit visage de dessin animé, déterministe pour un `seed` donné (JPEG 200×200). */
export function genererAvatar(seed: number, taille = 200): Promise<Blob> {
  const r = prng(seed * 7919 + 13)
  const pick = <T,>(l: T[]) => l[Math.floor(r() * l.length)]
  const c = document.createElement('canvas')
  c.width = c.height = taille
  const g = c.getContext('2d')!
  g.scale(taille / 200, taille / 200)

  const peau = pick(PEAUX)
  const cheveux = pick(CHEVEUX)
  const style = Math.floor(r() * 5) // 0 court, 1 long, 2 chignon, 3 bouclé, 4 très court
  const ellipse = (x: number, y: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
  }

  g.fillStyle = `hsl(${Math.floor(r() * 360)} 55% 85%)`
  g.fillRect(0, 0, 200, 200)

  if (style === 1) ellipse(100, 105, 62, 78, cheveux) // cheveux longs derrière
  if (style === 2) ellipse(100, 38, 20, 18, cheveux) // chignon
  ellipse(100, 205, 78, 60, `hsl(${Math.floor(r() * 360)} 50% 50%)`) // épaules
  g.fillStyle = peau
  g.fillRect(85, 128, 30, 30) // cou
  ellipse(100, 98, 46, 54, peau) // tête
  ellipse(55, 102, 7, 11, peau)
  ellipse(145, 102, 7, 11, peau) // oreilles

  // cheveux devant
  g.fillStyle = cheveux
  if (style === 3) {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI
      ellipse(100 + Math.cos(a) * 44, 82 + Math.sin(a) * 46, 16, 16, cheveux)
    }
  } else {
    g.beginPath()
    g.ellipse(100, 78, 48, style === 4 ? 30 : 38, 0, Math.PI, Math.PI * 2)
    g.fill()
    if (style === 0 || style === 1 || style === 2) {
      g.beginPath() // frange
      g.moveTo(54, 80)
      g.quadraticCurveTo(100, r() > 0.5 ? 50 : 62, 146, 80)
      g.lineTo(146, 70)
      g.lineTo(54, 70)
      g.fill()
    }
  }

  // visage
  const oeil = pick(['#2b2b2b', '#3b5b8a', '#4a6b3a', '#6b4423'])
  ellipse(82, 100, 5, 6, '#fff')
  ellipse(118, 100, 5, 6, '#fff')
  ellipse(82, 101, 3.2, 3.8, oeil)
  ellipse(118, 101, 3.2, 3.8, oeil)
  g.strokeStyle = cheveux
  g.lineWidth = 3
  g.lineCap = 'round'
  for (const x of [82, 118]) {
    g.beginPath()
    g.moveTo(x - 8, 88 - r() * 3)
    g.lineTo(x + 8, 88 - r() * 3)
    g.stroke()
  }
  g.strokeStyle = 'rgba(0,0,0,.25)'
  g.lineWidth = 2.5
  g.beginPath() // nez
  g.moveTo(100, 104)
  g.quadraticCurveTo(95, 118, 102, 119)
  g.stroke()
  g.strokeStyle = '#8a3b3b'
  g.lineWidth = 3.5
  g.beginPath() // bouche
  const sourire = 6 + r() * 10
  g.moveTo(84, 130) 
  g.quadraticCurveTo(100, 130 + sourire, 116, 130)
  g.stroke()

  if (r() < 0.3) {
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

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('avatar'))), 'image/jpeg', 0.8))
}

/** Donne un visage dessiné à chaque personne de la classe qui n'a pas encore de photo. */
export async function ajouterPhotosFictives(classeId: string) {
  const s = useApp.getState()
  s.choisirClasse(classeId)
  const classe = s.classes.find((c) => c.id === classeId)
  if (!classe) return
  let i = 0
  for (const e of classe.eleves) {
    i++
    if (e.photoId) continue
    await useApp.getState().definirPhoto(e.id, await genererAvatar(estAesh(e) ? 1000 + i : i))
  }
}

/** Crée la classe fictive de 28 élèves, avec photos dessinées. */
export async function creerClasseDemo() {
  const id = useApp.getState().ajouterClasseDemo()
  await ajouterPhotosFictives(id)
  return id
}
