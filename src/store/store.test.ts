import { describe, expect, it } from 'vitest'
import { construireFichier, lireFichier } from '../io/fichier'
import { placesSalle } from '../model/geometry'
import { parseListeEleves } from '../model/types'
import { memoryStorage } from '../storage/memory'
import { createAppStore } from './store'

const attendre = () => new Promise((r) => setTimeout(r, 10))

describe('parseListeEleves', () => {
  it('gère "Prénom Nom" et "Nom, Prénom"', () => {
    const l = parseListeEleves('Ada Lovelace\n\nTuring, Alan\nPlaton')
    expect(l.map((e) => [e.prenom, e.nom])).toEqual([
      ['Ada', 'Lovelace'],
      ['Alan', 'Turing'],
      ['Platon', ''],
    ])
  })
})

describe('store', () => {
  it("supprime les photos avec l'élève et persiste", async () => {
    const st = memoryStorage()
    const s = createAppStore(st, 0)
    await s.getState().init()
    s.getState().ajouterClasse('6e A')
    s.getState().ajouterEleve('Ada', 'L')
    const id = s.getState().classes[0].eleves[0].id
    await s.getState().definirPhoto(id, new Blob(['x']))
    const photoId = s.getState().classes[0].eleves[0].photoId!
    expect(await st.getPhoto(photoId)).toBeDefined()

    s.getState().supprimerEleve(id)
    await attendre()
    expect(await st.getPhoto(photoId)).toBeUndefined()
    expect((await st.loadClasses())[0].eleves).toHaveLength(0)
  })

  it('duplique une classe avec ses photos', async () => {
    const st = memoryStorage()
    const s = createAppStore(st, 0)
    await s.getState().init()
    s.getState().ajouterClasse('A')
    s.getState().ajouterEleve('Ada', '')
    await s.getState().definirPhoto(s.getState().classes[0].eleves[0].id, new Blob(['x']))
    await s.getState().dupliquerClasse(s.getState().classes[0].id)
    const [a, b] = s.getState().classes
    expect(b.eleves[0].photoId).not.toBe(a.eleves[0].photoId)
    expect(await st.getPhoto(b.eleves[0].photoId!)).toBeDefined()
  })

  it('plan : placer, puis purge quand un élève ou une table disparaît', async () => {
    const st = memoryStorage()
    const s = createAppStore(st, 0)
    await s.getState().init()
    const classeId = s.getState().ajouterClasse('A', 4)
    const salleId = s.getState().ajouterSalle('doubles-3x4')
    const planId = s.getState().creerPlan(classeId, salleId)
    s.getState().remplirPlan(planId)
    const plan = () => s.getState().plans[0]
    expect(Object.keys(plan().affectations)).toHaveLength(4)

    s.getState().supprimerEleve(s.getState().classes[0].eleves[0].id)
    expect(Object.keys(plan().affectations)).toHaveLength(3)

    const salle = s.getState().salles[0]
    const [premier] = placesSalle(salle)
    s.getState().supprimerMeubles(salleId, [premier.meubleId])
    expect(Object.keys(plan().affectations).every((p) => p !== premier.placeId)).toBe(true)

    await attendre()
    expect((await st.loadPlans())[0].affectations).toEqual(plan().affectations)
  })

  it('supprimer une salle ou une classe supprime ses plans', async () => {
    const s = createAppStore(memoryStorage(), 0)
    await s.getState().init()
    const c = s.getState().ajouterClasse('A', 2)
    const sa = s.getState().ajouterSalle('vide')
    s.getState().creerPlan(c, sa)
    s.getState().supprimerSalle(sa)
    expect(s.getState().plans).toHaveLength(0)
    expect(s.getState().planCourant).toBeUndefined()
  })

  it('ajouterMeuble choisit un emplacement libre', async () => {
    const s = createAppStore(memoryStorage(), 0)
    await s.getState().init()
    const sa = s.getState().ajouterSalle('vide')
    const a = s.getState().ajouterMeuble(sa, 'double')
    const b = s.getState().ajouterMeuble(sa, 'double')
    const [ma, mb] = [a, b].map((id) => s.getState().salles[0].meubles.find((m) => m.id === id)!)
    expect(ma.x === mb.x && ma.y === mb.y).toBe(false)
  })
})

describe('V2 : hypothèses, règles, import/export', () => {
  it('dupliquer un plan crée une hypothèse liée, avec règles copiées', async () => {
    const s = createAppStore(memoryStorage(), 0)
    await s.getState().init()
    const c = s.getState().ajouterClasse('A', 3)
    const sa = s.getState().ajouterSalle('doubles-3x4')
    const p = s.getState().creerPlan(c, sa)
    s.getState().remplirPlan(p)
    const [e1, e2] = s.getState().classes[0].eleves
    s.getState().ajouterRegle(p, { type: 'separer', eleveA: e1.id, eleveB: e2.id })
    s.getState().definirStatut(p, 'en_test')
    const h = s.getState().dupliquerPlan(p)!
    const [orig, copie] = s.getState().plans
    expect(copie.id).toBe(h)
    expect(copie).toMatchObject({ statut: 'brouillon', parentId: p, notes: '' })
    expect(copie.affectations).toEqual(orig.affectations)
    expect(copie.regles[0].id).not.toBe(orig.regles[0].id)
    expect(orig.testeDepuis).toBeDefined()
  })

  it('supprimer un élève retire les règles et les liens AESH', async () => {
    const s = createAppStore(memoryStorage(), 0)
    await s.getState().init()
    const c = s.getState().ajouterClasse('A', 2)
    const sa = s.getState().ajouterSalle('vide')
    const p = s.getState().creerPlan(c, sa)
    s.getState().ajouterAesh('Sam', '')
    const [e1, e2, aesh] = s.getState().classes[0].eleves
    s.getState().definirAccompagnes(aesh.id, [e1.id])
    s.getState().ajouterRegle(p, { type: 'separer', eleveA: e1.id, eleveB: e2.id })
    s.getState().supprimerEleve(e1.id)
    expect(s.getState().plans[0].regles).toHaveLength(0)
    expect(s.getState().classes[0].eleves.find((e) => e.role === 'aesh')!.accompagne).toEqual([])
  })

  it('export puis import (fusion et remplacement) conserve tout, photos comprises', async () => {
    const st = memoryStorage()
    const a = createAppStore(st, 0)
    await a.getState().init()
    const c = a.getState().ajouterClasseDemo()
    const sa = a.getState().ajouterSalle('ilots-3x2')
    a.getState().creerPlan(c, sa)
    a.getState().remplirPlan(a.getState().plans[0].id)
    await a.getState().definirPhoto(a.getState().classes[0].eleves[0].id, new Blob(['jpegdata'], { type: 'image/jpeg' }))

    const texte = JSON.stringify(await construireFichier(a.getState(), st))
    const f = lireFichier(texte)
    expect(Object.keys(f.photos)).toHaveLength(1)

    const b = createAppStore(memoryStorage(), 0)
    await b.getState().init()
    await b.getState().importer(f, 'fusion')
    await b.getState().importer(f, 'fusion') // idempotent
    expect(b.getState().classes).toHaveLength(1)
    expect(b.getState().plans[0].affectations).toEqual(a.getState().plans[0].affectations)
    const photoId = b.getState().classes[0].eleves[0].photoId!
    expect(b.getState().photoUrls[photoId]).toBeDefined()

    await b.getState().importer(f, 'remplacer')
    expect(b.getState().salles).toHaveLength(1)
  })

  it('refuse un fichier invalide', () => {
    expect(() => lireFichier('pas du json')).toThrow()
    expect(() => lireFichier('{"format":"autre"}')).toThrow()
    expect(() => lireFichier('{"format":"classe","version":99}')).toThrow(/récente/)
  })
})

describe('versions et migrations', () => {
  const ancien = {
    classes: [{ id: 'c1', nom: 'Vieille classe', tags: [{ id: 't' }], regles: [{ id: 'r' }], eleves: [{ id: 'e1', prenom: 'Ada', nom: 'L', tagIds: ['t'] }] }],
    salles: [{ id: 's1', nom: 'S', largeur: 1200, hauteur: 800, grille: 10, meubles: [] }],
    plans: [{ id: 'p1', nom: 'P', classeId: 'c1', salleId: 's1', affectations: {} }],
  }

  it("migre des données d'avant le versionnage, en gardant une sauvegarde", async () => {
    const st = memoryStorage()
    await st.saveClass(ancien.classes[0] as never)
    await st.saveSalle(ancien.salles[0] as never)
    await st.savePlan(ancien.plans[0] as never)
    const s = createAppStore(st, 0)
    await s.getState().init()
    const e = s.getState().classes[0].eleves[0]
    expect(e).toMatchObject({ feu: 'vert', role: 'eleve', annotations: [], accompagne: [] })
    expect(e).not.toHaveProperty('tagIds')
    expect(s.getState().plans[0]).toMatchObject({ statut: 'brouillon', regles: [], notes: '' })
    expect(await st.getMeta('versionDonnees')).toBe(2)
    expect((await st.getMeta<{ version: number }>('sauvegardeAvantMigration'))?.version).toBe(1)
    expect(await st.loadClasses()).toEqual(s.getState().classes) // migré aussi en base
  })

  it('base vide : pas de sauvegarde, version courante enregistrée', async () => {
    const st = memoryStorage()
    await createAppStore(st, 0).getState().init()
    expect(await st.getMeta('versionDonnees')).toBe(2)
    expect(await st.getMeta('sauvegardeAvantMigration')).toBeUndefined()
  })

  it("refuse (sans rien écrire) des données d'une version plus récente", async () => {
    const st = memoryStorage()
    await st.saveClass(ancien.classes[0] as never)
    await st.setMeta('versionDonnees', 99)
    const s = createAppStore(st, 0)
    await s.getState().init()
    expect(s.getState().erreurVersion).toMatch(/plus récente/)
    expect(s.getState().classes).toHaveLength(0)
    expect(await st.getMeta('versionDonnees')).toBe(99)
    expect((await st.loadClasses())[0]).toEqual(ancien.classes[0])
  })

  it('un fichier .classe de format 1 est migré à l\'import', () => {
    const f = lireFichier(JSON.stringify({ format: 'classe', version: 1, ...ancien, photos: {} }))
    expect(f.version).toBe(2)
    expect(f.classes[0].eleves[0].feu).toBe('vert')
    expect(f.plans[0].statut).toBe('brouillon')
    expect(() => lireFichier('{"format":"classe","version":0}')).toThrow()
    expect(() => lireFichier('{"format":"classe","version":3}')).toThrow(/plus récente/)
  })

  it("l'export écrit la version courante et celle de l'application", async () => {
    const st = memoryStorage()
    const f = await construireFichier({ classes: [], salles: [], plans: [] }, st)
    expect(f.version).toBe(2)
    expect(f.application).toBeDefined()
  })
})
