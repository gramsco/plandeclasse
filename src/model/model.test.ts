import { describe, expect, it } from 'vitest'
import { feuxAleatoires } from './demo'
import { aimanter, centrePlace, emprise, placesSalle } from './geometry'
import { placer, purgerAffectations, remplirAleatoire } from './plan'
import { creerMeuble, MODELES_SALLE } from './salles'
import { newClasse, type Plan } from './types'

describe('geometry', () => {
  it('emprise : la rotation 90° échange largeur/hauteur autour du centre', () => {
    const m = creerMeuble('double', 100, 100, 90)
    expect(emprise(m)).toEqual({ x: 154, y: 46, w: 92, h: 200 })
  })
  it('centrePlace pivote autour du centre', () => {
    const m = creerMeuble('double', 0, 0, 90)
    expect(centrePlace(m, { dx: 50, dy: 0 })).toEqual({ x: 100, y: 46 + 50 })
  })
  it('aimante aux bords voisins, sinon à la grille, et reste dans la salle', () => {
    const salle = { largeur: 1000, hauteur: 800, grille: 10 }
    const voisin = { x: 105, y: 0, w: 100, h: 100 }
    expect(aimanter({ x: 203, y: 300, w: 100, h: 50 }, [voisin], salle).dx).toBe(2)
    expect(aimanter({ x: 403, y: 307, w: 100, h: 50 }, [], salle)).toEqual({ dx: -3, dy: 3 })
    expect(aimanter({ x: -40, y: 0, w: 100, h: 50 }, [], salle).dx).toBe(40)
  })
})

describe('modèles de salle', () => {
  it.each(MODELES_SALLE)('$key tient dans la salle, sans chevauchement ni place en double', ({ creer }) => {
    const s = creer()
    const rects = s.meubles.map(emprise)
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(s.largeur)
      expect(r.y + r.h).toBeLessThanOrEqual(s.hauteur)
    }
    rects.forEach((a, i) =>
      rects.slice(i + 1).forEach((b) => {
        const chevauche = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(chevauche).toBe(false)
      }),
    )
    const ids = placesSalle(s).map((p) => p.placeId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('plan', () => {
  const salle = MODELES_SALLE[0].creer()
  const classe = newClasse('A', 5)
  const plan: Plan = { id: 'p', nom: 'p', classeId: classe.id, salleId: salle.id, affectations: {}, regles: [], statut: 'brouillon', notes: '', creeLe: '' }
  const [p1, p2] = placesSalle(salle).map((p) => p.placeId)
  const [e1, e2] = classe.eleves.map((e) => e.id)

  it('placer déplace, échange et retire', () => {
    let aff = placer({}, e1, p1)
    aff = placer(aff, e2, p2)
    expect(placer(aff, e1, p2)).toEqual({ [p2]: e1, [p1]: e2 }) // échange
    expect(placer(aff, e1, null)).toEqual({ [p2]: e2 })
    expect(placer(aff, e1, p1)).toEqual(aff)
  })
  it('purge les affectations orphelines', () => {
    const aff = purgerAffectations({ ...plan, affectations: { [p1]: e1, zzz: e2, [p2]: 'inconnu' } }, classe, salle)
    expect(aff).toEqual({ [p1]: e1 })
  })
  it('remplit sans doublon et sans écraser', () => {
    const aff = remplirAleatoire({ ...plan, affectations: { [p1]: e1 } }, classe, salle)
    expect(aff[p1]).toBe(e1)
    expect(Object.values(aff).sort()).toEqual(classe.eleves.map((e) => e.id).sort())
  })
})

describe('feuxAleatoires', () => {
  it('1-2 rouges, 5-6 oranges, le reste vert', () => {
    for (let i = 0; i < 200; i++) {
      const f = feuxAleatoires(28)
      const n = (c: string) => f.filter((x) => x === c).length
      expect(n('rouge')).toBeGreaterThanOrEqual(1)
      expect(n('rouge')).toBeLessThanOrEqual(2)
      expect(n('orange')).toBeGreaterThanOrEqual(5)
      expect(n('orange')).toBeLessThanOrEqual(6)
      expect(f).toHaveLength(28)
    }
    expect(feuxAleatoires(3)).toHaveLength(3)
  })
})
