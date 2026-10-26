import { create } from 'zustand'
import { base64VersBlob, type FichierClasse } from '../io/fichier'
import { aimanter, emprise } from '../model/geometry'
import { migrer, VERSION_DONNEES, type Donnees } from '../model/migrations'
import { placer as placerAff, purgerAffectations, purgerRegles, remplirAleatoire } from '../model/plan'
import { classeDemo, melangerFeux } from '../model/demo'
import { creerMeuble, dupliquerMeuble, dupliquerSalle, modeleSalle } from '../model/salles'
import {
  newAesh,
  newClasse,
  newEleve,
  newId,
  normaliserClasse,
  normaliserPlan,
  normaliserSalle,
  type Classe,
  type Eleve,
  type Feu,
  type Genre,
  type Plan,
  type Regle,
  type StatutPlan,
  type Rotation,
  type Salle,
  type TypeMeuble,
} from '../model/types'
import type { Storage } from '../storage/storage'

type SansId<T> = T extends { id: string } ? Omit<T, 'id'> : never

export type Vue = 'plans' | 'classes' | 'salles' | 'aide'

type State = {
  pret: boolean
  erreurVersion?: string // données écrites par une version plus récente : on n'y touche pas
  vue: Vue
  classes: Classe[]
  salles: Salle[]
  plans: Plan[]
  courante?: string
  salleCourante?: string
  planCourant?: string
  photoUrls: Record<string, string>
}

type Actions = {
  init(): Promise<void>
  setVue(v: Vue): void

  ajouterClasse(nom: string, nbEleves?: number): string
  ajouterClasseDemo(): string
  renommerClasse(id: string, nom: string): void
  dupliquerClasse(id: string): Promise<void>
  supprimerClasse(id: string): void
  choisirClasse(id: string): void
  ajouterEleves(eleves: Eleve[]): void
  ajouterEleve(prenom: string, nom: string): void
  ajouterAesh(prenom: string, nom: string): void
  definirFeu(id: string, feu: Feu): void
  definirGenre(id: string, genre: Genre | undefined): void
  feuxAleatoires(): void
  basculerAnnotation(id: string, label: string): void
  definirAccompagnes(aeshId: string, eleveIds: string[]): void
  modifierEleve(id: string, patch: Partial<Pick<Eleve, 'prenom' | 'nom'>>): void
  supprimerEleve(id: string): void
  definirPhoto(eleveId: string, blob: Blob): Promise<void>
  retirerPhoto(eleveId: string): void

  ajouterSalle(modeleKey: string): string
  renommerSalle(id: string, nom: string): void
  dupliquerSalle(id: string): void
  supprimerSalle(id: string): void
  choisirSalle(id: string): void
  redimensionnerSalle(id: string, largeur: number, hauteur: number): void
  ajouterMeuble(salleId: string, type: TypeMeuble): string
  deplacerMeubles(salleId: string, positions: { id: string; x: number; y: number }[]): void
  pivoterMeubles(salleId: string, ids: string[]): void
  dupliquerMeubles(salleId: string, ids: string[]): string[]
  supprimerMeubles(salleId: string, ids: string[]): void

  creerPlan(classeId: string, salleId: string): string
  renommerPlan(id: string, nom: string): void
  supprimerPlan(id: string): void
  choisirPlan(id: string): void
  placer(planId: string, eleveId: string, placeId: string | null): void
  viderPlan(planId: string): void
  remplirPlan(planId: string): void
  ajouterRegle(planId: string, regle: SansId<Regle>): void
  supprimerRegle(planId: string, regleId: string): void
  dupliquerPlan(planId: string): string | undefined
  definirStatut(planId: string, statut: StatutPlan): void
  modifierNotes(planId: string, notes: string): void

  importer(fichier: FichierClasse, mode: 'fusion' | 'remplacer'): Promise<void>
}

export type AppStore = State & Actions

export function createAppStore(storage: Storage, debounceMs = 300) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  return create<AppStore>((set, get) => {
    const planifier = (kind: 'classes' | 'salles' | 'plans', id: string) => {
      const key = `${kind}:${id}`
      clearTimeout(timers.get(key))
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key)
          if (kind === 'classes') {
            const x = get().classes.find((c) => c.id === id)
            if (x) void storage.saveClass(x)
          } else if (kind === 'salles') {
            const x = get().salles.find((c) => c.id === id)
            if (x) void storage.saveSalle(x)
          } else {
            const x = get().plans.find((c) => c.id === id)
            if (x) void storage.savePlan(x)
          }
        }, debounceMs),
      )
    }
    const annuler = (kind: string, id: string) => clearTimeout(timers.get(`${kind}:${id}`))

    /** Retire des plans les affectations devenues invalides (élève / table supprimés). */
    const purger = () => {
      const { plans, classes, salles } = get()
      let change = false
      const next = plans.map((p) => {
        const classe = classes.find((c) => c.id === p.classeId)
        const aff = purgerAffectations(p, classe, salles.find((s) => s.id === p.salleId))
        const regles = purgerRegles(p.regles, classe)
        if (Object.keys(aff).length === Object.keys(p.affectations).length && regles.length === p.regles.length) return p
        change = true
        planifier('plans', p.id)
        return { ...p, affectations: aff, regles }
      })
      if (change) set({ plans: next })
    }

    const majClasse = (id: string, fn: (c: Classe) => Classe) => {
      set((s) => ({ classes: s.classes.map((c) => (c.id === id ? fn(c) : c)) }))
      planifier('classes', id)
      purger()
    }
    const majSalle = (id: string, fn: (s: Salle) => Salle) => {
      set((s) => ({ salles: s.salles.map((x) => (x.id === id ? fn(x) : x)) }))
      planifier('salles', id)
      purger()
    }
    const majPlan = (id: string, fn: (p: Plan) => Plan) => {
      set((s) => ({ plans: s.plans.map((x) => (x.id === id ? fn(x) : x)) }))
      planifier('plans', id)
    }
    const majCourante = (fn: (c: Classe) => Classe) => {
      const { courante } = get()
      if (courante) majClasse(courante, fn)
    }

    const chargerUrl = async (photoId: string) => {
      if (get().photoUrls[photoId]) return
      const blob = await storage.getPhoto(photoId)
      if (blob) set((s) => ({ photoUrls: { ...s.photoUrls, [photoId]: URL.createObjectURL(blob) } }))
    }

    const supprimerPhotos = (ids: (string | undefined)[]) => {
      for (const id of ids) {
        if (!id) continue
        void storage.deletePhoto(id)
        const url = get().photoUrls[id]
        if (url) URL.revokeObjectURL(url)
        set((s) => {
          const { [id]: _, ...reste } = s.photoUrls
          return { photoUrls: reste }
        })
      }
    }

    const retirerPlans = (filtre: (p: Plan) => boolean) => {
      for (const p of get().plans.filter(filtre)) {
        annuler('plans', p.id)
        void storage.deletePlan(p.id)
      }
      set((s) => {
        const plans = s.plans.filter((p) => !filtre(p))
        return { plans, planCourant: plans.some((p) => p.id === s.planCourant) ? s.planCourant : plans[0]?.id }
      })
    }

    const eleveParId = (id: string) => get().classes.flatMap((c) => c.eleves).find((e) => e.id === id)
    const salleParId = (id: string) => get().salles.find((s) => s.id === id)

    return {
      pret: false,
      vue: 'plans',
      classes: [],
      salles: [],
      plans: [],
      photoUrls: {},

      async init() {
        const brut = {
          classes: await storage.loadClasses(),
          salles: await storage.loadSalles(),
          plans: await storage.loadPlans(),
        }
        const vide = !brut.classes.length && !brut.salles.length && !brut.plans.length
        // Sans marqueur de version : base vide = à jour ; base remplie = données d'avant le versionnage (v1).
        const stockee = (await storage.getMeta<number>('versionDonnees')) ?? (vide ? VERSION_DONNEES : 1)
        if (stockee > VERSION_DONNEES) {
          set({
            pret: true,
            erreurVersion: `Vos données ont été enregistrées par une version plus récente de l'application (format ${stockee}, celle-ci comprend jusqu'au format ${VERSION_DONNEES}). Rechargez la page pour obtenir la dernière version. Vos données n'ont pas été modifiées.`,
          })
          return
        }
        let donnees: Donnees = brut
        if (stockee < VERSION_DONNEES) {
          // Filet de sécurité : copie des données d'origine avant toute migration.
          await storage.setMeta('sauvegardeAvantMigration', {
            version: stockee,
            date: new Date().toISOString(),
            donnees: brut,
          })
          donnees = migrer(brut, stockee)
          await Promise.all([
            ...donnees.classes.map((c) => storage.saveClass(normaliserClasse(c))),
            ...donnees.salles.map((x) => storage.saveSalle(normaliserSalle(x))),
            ...donnees.plans.map((p) => storage.savePlan(normaliserPlan(p))),
          ])
        }
        await storage.setMeta('versionDonnees', VERSION_DONNEES)
        const classes = donnees.classes.map(normaliserClasse)
        const salles = donnees.salles.map(normaliserSalle)
        const plans = donnees.plans.map(normaliserPlan)
        set({
          classes,
          salles,
          plans,
          courante: classes[0]?.id,
          salleCourante: salles[0]?.id,
          planCourant: plans[0]?.id,
          pret: true,
        })
        const ids = new Set(classes.flatMap((c) => c.eleves.map((e) => e.photoId)))
        for (const id of await storage.listPhotoIds()) if (!ids.has(id)) void storage.deletePhoto(id)
        for (const id of ids) if (id) void chargerUrl(id)
      },

      setVue: (vue) => set({ vue }),

      // ---- Classes ----
      ajouterClasse(nom, nbEleves = 0) {
        const c = newClasse(nom, nbEleves)
        set((s) => ({ classes: [...s.classes, c], courante: c.id }))
        planifier('classes', c.id)
        return c.id
      },
      ajouterClasseDemo() {
        const c = classeDemo()
        set((s) => ({ classes: [...s.classes, c], courante: c.id }))
        planifier('classes', c.id)
        return c.id
      },
      renommerClasse: (id, nom) => majClasse(id, (c) => ({ ...c, nom })),
      choisirClasse: (id) => set({ courante: id }),

      async dupliquerClasse(id) {
        const src = get().classes.find((c) => c.id === id)
        if (!src) return
        const idMap = new Map<string, string>()
        const eleves: Eleve[] = []
        for (const e of src.eleves) {
          let photoId: string | undefined
          if (e.photoId) {
            const blob = await storage.getPhoto(e.photoId)
            if (blob) {
              photoId = newId()
              await storage.putPhoto(photoId, blob)
              void chargerUrl(photoId)
            }
          }
          const nid = newId()
          idMap.set(e.id, nid)
          eleves.push({ ...e, id: nid, photoId })
        }
        const copie: Classe = {
          ...structuredClone(src),
          id: newId(),
          nom: `${src.nom} (copie)`,
          eleves: eleves.map((e) => ({ ...e, accompagne: e.accompagne.map((id) => idMap.get(id) ?? id) })),
        }
        set((s) => ({ classes: [...s.classes, copie], courante: copie.id }))
        planifier('classes', copie.id)
      },

      supprimerClasse(id) {
        const c = get().classes.find((x) => x.id === id)
        if (!c) return
        annuler('classes', id)
        supprimerPhotos(c.eleves.map((e) => e.photoId))
        void storage.deleteClass(id)
        retirerPlans((p) => p.classeId === id)
        set((s) => {
          const classes = s.classes.filter((x) => x.id !== id)
          return { classes, courante: s.courante === id ? classes[0]?.id : s.courante }
        })
      },

      ajouterEleves: (eleves) => majCourante((c) => ({ ...c, eleves: [...c.eleves, ...eleves] })),
      ajouterEleve: (prenom, nom) => get().ajouterEleves([newEleve(prenom, nom)]),
      ajouterAesh: (prenom, nom) => get().ajouterEleves([newAesh(prenom, nom)]),
      definirFeu: (id, feu) =>
        majCourante((c) => ({ ...c, eleves: c.eleves.map((e) => (e.id === id ? { ...e, feu } : e)) })),
      basculerAnnotation: (id, label) => {
        const l = label.trim()
        if (!l) return
        majCourante((c) => ({
          ...c,
          eleves: c.eleves.map((e) =>
            e.id !== id ? e : { ...e, annotations: e.annotations.includes(l) ? e.annotations.filter((a) => a !== l) : [...e.annotations, l] },
          ),
        }))
      },
      feuxAleatoires: () => majCourante((c) => ({ ...c, eleves: melangerFeux(c.eleves) })),
      definirGenre: (id, genre) =>
        majCourante((c) => ({ ...c, eleves: c.eleves.map((e) => (e.id === id ? { ...e, genre } : e)) })),
      definirAccompagnes: (aeshId, eleveIds) =>
        majCourante((c) => ({
          ...c,
          eleves: c.eleves.map((e) => (e.id === aeshId ? { ...e, accompagne: eleveIds } : e)),
        })),
      modifierEleve: (id, patch) =>
        majCourante((c) => ({ ...c, eleves: c.eleves.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      supprimerEleve(id) {
        supprimerPhotos([eleveParId(id)?.photoId])
        majCourante((c) => ({
          ...c,
          eleves: c.eleves
            .filter((x) => x.id !== id)
            .map((x) => (x.accompagne.includes(id) ? { ...x, accompagne: x.accompagne.filter((i) => i !== id) } : x)),
        }))
      },

      async definirPhoto(eleveId, blob) {
        const ancien = eleveParId(eleveId)?.photoId
        const photoId = newId()
        await storage.putPhoto(photoId, blob)
        set((s) => ({ photoUrls: { ...s.photoUrls, [photoId]: URL.createObjectURL(blob) } }))
        supprimerPhotos([ancien])
        majCourante((c) => ({
          ...c,
          eleves: c.eleves.map((e) => (e.id === eleveId ? { ...e, photoId } : e)),
        }))
      },

      retirerPhoto(eleveId) {
        supprimerPhotos([eleveParId(eleveId)?.photoId])
        majCourante((c) => ({
          ...c,
          eleves: c.eleves.map((x) => (x.id === eleveId ? { ...x, photoId: undefined } : x)),
        }))
      },

      // ---- Salles ----
      ajouterSalle(modeleKey) {
        const s = (modeleSalle(modeleKey) ?? modeleSalle('vide')!).creer()
        set((st) => ({ salles: [...st.salles, s], salleCourante: s.id }))
        planifier('salles', s.id)
        return s.id
      },
      renommerSalle: (id, nom) => majSalle(id, (s) => ({ ...s, nom })),
      choisirSalle: (id) => set({ salleCourante: id }),
      dupliquerSalle(id) {
        const src = salleParId(id)
        if (!src) return
        const copie = dupliquerSalle(src)
        set((s) => ({ salles: [...s.salles, copie], salleCourante: copie.id }))
        planifier('salles', copie.id)
      },
      supprimerSalle(id) {
        annuler('salles', id)
        void storage.deleteSalle(id)
        retirerPlans((p) => p.salleId === id)
        set((s) => {
          const salles = s.salles.filter((x) => x.id !== id)
          return { salles, salleCourante: s.salleCourante === id ? salles[0]?.id : s.salleCourante }
        })
      },
      redimensionnerSalle: (id, largeur, hauteur) =>
        majSalle(id, (s) => ({ ...s, largeur: Math.max(400, largeur), hauteur: Math.max(300, hauteur) })),

      ajouterMeuble(salleId, type) {
        const m = creerMeuble(type, 0, 0)
        const salle = salleParId(salleId)
        if (salle) {
          // Premier emplacement libre sur la grille, en balayant la salle.
          const libre = (x: number, y: number) => {
            const r = emprise({ ...m, x, y })
            return salle.meubles.every((o) => {
              const e = emprise(o)
              return r.x >= e.x + e.w || e.x >= r.x + r.w || r.y >= e.y + e.h || e.y >= r.y + r.h
            })
          }
          const pas = 20
          scan: for (let y = 20; y + m.hauteur <= salle.hauteur; y += pas)
            for (let x = 20; x + m.largeur <= salle.largeur; x += pas)
              if (libre(x, y)) {
                m.x = x
                m.y = y
                break scan
              }
        }
        majSalle(salleId, (s) => ({ ...s, meubles: [...s.meubles, m] }))
        return m.id
      },
      deplacerMeubles: (salleId, positions) => {
        const par = new Map(positions.map((p) => [p.id, p]))
        majSalle(salleId, (s) => ({
          ...s,
          meubles: s.meubles.map((m) => {
            const p = par.get(m.id)
            return p ? { ...m, x: p.x, y: p.y } : m
          }),
        }))
      },
      pivoterMeubles: (salleId, ids) =>
        majSalle(salleId, (s) => ({
          ...s,
          meubles: s.meubles.map((m) => {
            if (!ids.includes(m.id)) return m
            const next = { ...m, rotation: ((m.rotation + 90) % 360) as Rotation }
            // On garde l'emprise dans la salle et alignée sur la grille.
            const { dx, dy } = aimanter(emprise(next), [], s)
            return { ...next, x: next.x + dx, y: next.y + dy }
          }),
        })),
      dupliquerMeubles(salleId, ids) {
        const copies = (salleParId(salleId)?.meubles ?? []).filter((m) => ids.includes(m.id)).map((m) => dupliquerMeuble(m))
        majSalle(salleId, (s) => ({ ...s, meubles: [...s.meubles, ...copies] }))
        return copies.map((m) => m.id)
      },
      supprimerMeubles: (salleId, ids) =>
        majSalle(salleId, (s) => ({ ...s, meubles: s.meubles.filter((m) => !ids.includes(m.id)) })),

      // ---- Plans ----
      creerPlan(classeId, salleId) {
        const c = get().classes.find((x) => x.id === classeId)
        const s = salleParId(salleId)
        const plan: Plan = {
          id: newId(),
          nom: `${c?.nom ?? 'Classe'} — ${s?.nom ?? 'Salle'}`,
          classeId,
          salleId,
          affectations: {},
          regles: [],
          statut: 'brouillon',
          notes: '',
          creeLe: new Date().toISOString(),
        }
        set((st) => ({ plans: [...st.plans, plan], planCourant: plan.id, vue: 'plans' }))
        planifier('plans', plan.id)
        return plan.id
      },
      renommerPlan: (id, nom) => majPlan(id, (p) => ({ ...p, nom })),
      choisirPlan: (id) => set({ planCourant: id }),
      supprimerPlan: (id) => retirerPlans((p) => p.id === id),
      placer: (planId, eleveId, placeId) =>
        majPlan(planId, (p) => ({ ...p, affectations: placerAff(p.affectations, eleveId, placeId) })),
      viderPlan: (planId) => majPlan(planId, (p) => ({ ...p, affectations: {} })),
      remplirPlan(planId) {
        const p = get().plans.find((x) => x.id === planId)
        const c = p && get().classes.find((x) => x.id === p.classeId)
        const s = p && salleParId(p.salleId)
        if (p && c && s) majPlan(planId, (x) => ({ ...x, affectations: remplirAleatoire(x, c, s) }))
      },
      ajouterRegle: (planId, regle) =>
        majPlan(planId, (p) => ({ ...p, regles: [...p.regles, { ...regle, id: newId() } as Regle] })),
      supprimerRegle: (planId, regleId) =>
        majPlan(planId, (p) => ({ ...p, regles: p.regles.filter((r) => r.id !== regleId) })),

      dupliquerPlan(planId) {
        const src = get().plans.find((p) => p.id === planId)
        if (!src) return
        const copie: Plan = {
          ...structuredClone(src),
          id: newId(),
          nom: `${src.nom.replace(/ \(hyp\. \d+\)$/, '')} (hyp. ${get().plans.filter((p) => p.classeId === src.classeId && p.salleId === src.salleId).length + 1})`,
          regles: src.regles.map((r) => ({ ...r, id: newId() })),
          statut: 'brouillon',
          notes: '',
          parentId: src.id,
          creeLe: new Date().toISOString(),
          testeDepuis: undefined,
        }
        set((st) => ({ plans: [...st.plans, copie], planCourant: copie.id }))
        planifier('plans', copie.id)
        return copie.id
      },
      definirStatut: (planId, statut) =>
        majPlan(planId, (p) => ({
          ...p,
          statut,
          testeDepuis: statut === 'en_test' && !p.testeDepuis ? new Date().toISOString() : p.testeDepuis,
        })),
      modifierNotes: (planId, notes) => majPlan(planId, (p) => ({ ...p, notes })),

      async importer(f, mode) {
        if (mode === 'remplacer') {
          const { classes, salles, plans } = get()
          await Promise.all([
            ...classes.map((c) => storage.deleteClass(c.id)),
            ...salles.map((x) => storage.deleteSalle(x.id)),
            ...plans.map((p) => storage.deletePlan(p.id)),
            ...(await storage.listPhotoIds()).map((id) => storage.deletePhoto(id)),
          ])
          for (const url of Object.values(get().photoUrls)) URL.revokeObjectURL(url)
          set({ classes: [], salles: [], plans: [], photoUrls: {}, courante: undefined, salleCourante: undefined, planCourant: undefined })
        }
        const urls: Record<string, string> = {}
        for (const [id, ph] of Object.entries(f.photos)) {
          const blob = base64VersBlob(ph.base64, ph.type)
          await storage.putPhoto(id, blob)
          const ancienne = get().photoUrls[id]
          if (ancienne) URL.revokeObjectURL(ancienne)
          urls[id] = URL.createObjectURL(blob)
        }
        await Promise.all([
          ...f.classes.map((c) => storage.saveClass(c)),
          ...f.salles.map((x) => storage.saveSalle(x)),
          ...f.plans.map((p) => storage.savePlan(p)),
        ])
        const fusion = <T extends { id: string }>(avant: T[], nouveaux: T[]) => [
          ...avant.filter((x) => !nouveaux.some((n) => n.id === x.id)),
          ...nouveaux,
        ]
        set((s) => {
          const classes = fusion(s.classes, f.classes)
          const salles = fusion(s.salles, f.salles)
          const plans = fusion(s.plans, f.plans)
          return {
            classes,
            salles,
            plans,
            photoUrls: { ...s.photoUrls, ...urls },
            courante: s.courante ?? classes[0]?.id,
            salleCourante: s.salleCourante ?? salles[0]?.id,
            planCourant: s.planCourant ?? plans[0]?.id,
          }
        })
        purger()
      },
    }
  })
}
