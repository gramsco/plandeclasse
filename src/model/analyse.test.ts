import { describe, expect, it } from 'vitest'
import { analyser, relation } from './analyse'
import { placesSalle } from './geometry'
import { MODELES_SALLE } from './salles'
import { newAesh, newClasse, newId, type Plan, type Regle } from './types'

describe('relation', () => {
  it('côte à côte / devant / diagonale / allée', () => {
    const o = { x: 0, y: 0 }
    expect(relation(o, { x: 100, y: 0 })).toBe('cote')
    expect(relation(o, { x: 0, y: 120 })).toBe('face')
    expect(relation(o, { x: 100, y: 120 })).toBe('diagonale')
    expect(relation(o, { x: 160, y: 0 })).toBe('allee')
    expect(relation(o, { x: 400, y: 0 })).toBeNull()
  })
  it("tient compte de l'orientation (colonne en U)", () => {
    const a = { x: 0, y: 0, rotation: 90 }
    expect(relation(a, { x: 0, y: 108 })).toBe('cote')
  })
})

describe('analyser', () => {
  const salle = MODELES_SALLE[0].creer() // tables doubles
  const places = placesSalle(salle)
  const [p1, p2] = places.filter((p) => p.y === places[0].y).slice(0, 2) // même table : côte à côte
  const lointaine = places[places.length - 1]
  const classe = newClasse('A', 3)
  const [a, b, c] = classe.eleves
  const plan = (aff: Record<string, string>, regles: Regle[] = []): Plan => ({
    id: 'p', nom: 'p', classeId: classe.id, salleId: salle.id, affectations: aff, regles,
    statut: 'brouillon', notes: '', creeLe: '',
  })

  it('règle « séparer » : erreur si côte à côte', () => {
    const r = analyser(plan({ [p1.placeId]: a.id, [p2.placeId]: b.id }, [{ id: newId(), type: 'separer', eleveA: a.id, eleveB: b.id }]), classe, salle)
    expect(r.alertes[0].niveau).toBe('erreur')
    expect(r.liens).toHaveLength(1)
  })

  it('rouge + rouge côte à côte', () => {
    a.feu = 'rouge'
    b.feu = 'rouge'
    const r = analyser(plan({ [p1.placeId]: a.id, [p2.placeId]: b.id }, [{ id: newId(), type: 'couleurs', a: 'rouge', b: 'rouge' }]), classe, salle)
    expect(r.alertes.some((x) => x.niveau === 'erreur')).toBe(true)
    a.feu = 'vert'
    b.feu = 'vert'
  })

  it("l'influence rend un vert orange près de l'autre, mais pas loin", () => {
    const regles: Regle[] = [{ id: newId(), type: 'influence', eleve: a.id, avec: b.id, devient: 'orange' }]
    expect(analyser(plan({ [p1.placeId]: a.id, [p2.placeId]: b.id }, regles), classe, salle).feuEffectif[a.id]).toBe('orange')
    expect(analyser(plan({ [p1.placeId]: a.id, [lointaine.placeId]: b.id }, regles), classe, salle).feuEffectif[a.id]).toBe('vert')
  })

  it('AESH : non placé = attention ; loin = erreur ; proche = lien', () => {
    const aesh = newAesh('Sam')
    aesh.accompagne = [c.id]
    classe.eleves.push(aesh)
    expect(analyser(plan({ [p1.placeId]: c.id }), classe, salle).alertes[0]).toMatchObject({ niveau: 'attention' })
    expect(analyser(plan({ [p1.placeId]: c.id, [lointaine.placeId]: aesh.id }), classe, salle).alertes[0]).toMatchObject({ niveau: 'erreur' })
    const ok = analyser(plan({ [p1.placeId]: c.id, [p2.placeId]: aesh.id }), classe, salle)
    expect(ok.alertes).toHaveLength(0)
    expect(ok.liens[0].type).toBe('aesh')
    classe.eleves.pop()
  })
})
