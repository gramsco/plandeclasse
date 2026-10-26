import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { analyser } from '../model/analyse'
import { CARTE, centrePlace, PHOTO, placesSalle } from '../model/geometry'
import {
  estAesh, FEUX, LIBELLE_FEU, LIBELLE_STATUT, nomComplet,
  type Classe, type Eleve, type Feu, type Plan, type Regle, type Salle, type StatutPlan,
} from '../model/types'
import { useApp } from '../store'
import { SalleSvg } from './SalleSvg'

type Drag = { eleveId: string; x: number; y: number }
type Onglet = 'placer' | 'regles' | 'suivi'

const COULEUR_FEU: Record<Feu, string> = { vert: '#3fae5a', orange: '#f0a020', rouge: '#d9453b' }
const COULEUR_NIVEAU = { erreur: '#d9453b', attention: '#f0a020', info: '#4a82d6' }
type Options = { photos: boolean; prenoms: boolean; noms: boolean; couleurs: boolean; annotations: boolean; genre: boolean }
const COMPLET: Options = { photos: true, prenoms: true, noms: true, couleurs: true, annotations: true, genre: true }
const NEUTRE: Options = { photos: true, prenoms: true, noms: true, couleurs: false, annotations: false, genre: false }
const LIBELLE_OPTIONS: Record<keyof Options, string> = {
  photos: 'Photos', prenoms: 'Prénoms', noms: 'Noms', couleurs: 'Couleurs (feu tricolore, AESH)', annotations: 'Annotations (PAP…)', genre: 'Genre (F / G)',
}
const CLE_OPTIONS = 'optionsImpression'
const optionsEnregistrees = (): Options => {
  try {
    return { ...COMPLET, ...JSON.parse(localStorage.getItem(CLE_OPTIONS) ?? '{}') }
  } catch {
    return COMPLET
  }
}
const classesToile = (o: Options, retourne: boolean, apercu: boolean) =>
  ['toile', 'plan-print', retourne && 'retourne', apercu && 'apercu', !o.photos && 'sans-photo', !o.prenoms && 'sans-prenom', !o.noms && 'sans-nom', !o.couleurs && 'sans-feu', !o.annotations && 'sans-annot', !o.genre && 'sans-genre']
    .filter(Boolean)
    .join(' ')

const tronque = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function PlanEditor({ plan, classe, salle }: { plan: Plan; classe: Classe; salle: Salle }) {
  const { placer, viderPlan, remplirPlan, photoUrls, setVue, choisirSalle } = useApp()
  const [drag, setDrag] = useState<Drag>()
  const [options, setOptions] = useState<Options>(optionsEnregistrees)
  const [apercu, setApercu] = useState(false)
  const [retourne, setRetourne] = useState(false)
  const [onglet, setOnglet] = useState<Onglet>('placer')
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => localStorage.setItem(CLE_OPTIONS, JSON.stringify(options)), [options])

  const parId = new Map(classe.eleves.map((e) => [e.id, e]))
  const placeDe = new Map(Object.entries(plan.affectations).map(([place, eleve]) => [eleve, place]))
  const nonPlaces = classe.eleves.filter((e) => !placeDe.has(e.id))
  const analyse = useMemo(() => analyser(plan, classe, salle), [plan, classe, salle])
  const centres = useMemo(() => {
    const places = new Map(placesSalle(salle).map((p) => [p.placeId, p]))
    return new Map(Object.entries(plan.affectations).flatMap(([pl, el]) => (places.get(pl) ? [[el, places.get(pl)!] as const] : [])))
  }, [plan.affectations, salle])
  const nbProblemes = analyse.alertes.filter((a) => a.niveau !== 'info').length

  const commencer = (e: PointerEvent, eleveId: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    setDrag({ eleveId, x: e.clientX, y: e.clientY })
  }

  const actif = drag !== undefined
  useEffect(() => {
    if (!actif) return
    const move = (e: globalThis.PointerEvent) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY })
    const up = (e: globalThis.PointerEvent) => {
      setDrag((d) => {
        if (!d) return d
        const cible = document.elementFromPoint(e.clientX, e.clientY)
        const placeId = cible?.closest('[data-place-id]')?.getAttribute('data-place-id')
        if (placeId) placer(plan.id, d.eleveId, placeId)
        else if (cible?.closest('[data-zone="non-places"]')) placer(plan.id, d.eleveId, null)
        return undefined
      })
    }
    const annule = (e: KeyboardEvent) => e.key === 'Escape' && setDrag(undefined)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', annule)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', annule)
    }
  }, [actif, placer, plan.id])

  const url = (e: Eleve) => (e.photoId ? photoUrls[e.photoId] : undefined)
  const dragEleve = drag && parId.get(drag.eleveId)

  return (
    <div className="editeur">
      <aside className="outils no-print">
        <nav className="onglets-lateraux">
          <button className={onglet === 'placer' ? 'actif' : ''} onClick={() => setOnglet('placer')}>Placer</button>
          <button className={onglet === 'regles' ? 'actif' : ''} onClick={() => setOnglet('regles')}>
            Règles {nbProblemes > 0 && <span className="pastille">{nbProblemes}</span>}
          </button>
          <button className={onglet === 'suivi' ? 'actif' : ''} onClick={() => setOnglet('suivi')}>Suivi</button>
        </nav>

        {nbProblemes > 0 && onglet !== 'regles' && (
          <button className="bandeau-alerte" onClick={() => setOnglet('regles')}>
            ⚠ {nbProblemes} alerte{nbProblemes > 1 ? 's' : ''} — voir
          </button>
        )}

        {onglet === 'placer' && (
          <>
            <div data-zone="non-places" className={`non-places ${drag ? 'cible' : ''}`}>
              <h3>À placer <small>{nonPlaces.length}</small></h3>
              {nonPlaces.length === 0 && <p className="aide">Tout le monde est placé 🎉</p>}
              <ul>
                {nonPlaces.map((e) => (
                  <li key={e.id} className="puce" onPointerDown={(ev) => commencer(ev, e.id)}>
                    <Avatar eleve={e} url={url(e)} />
                    <span>{nomComplet(e)}</span>
                    {estAesh(e) ? <em className="badge-aesh">AESH</em> : <span className={`pt feu-${e.feu}`} />}
                  </li>
                ))}
              </ul>
            </div>
            <h3>Actions</h3>
            <button onClick={() => remplirPlan(plan.id)} disabled={nonPlaces.length === 0}>🎲 Placer au hasard les restants</button>
            <button onClick={() => confirm('Retirer tout le monde de sa place ?') && viderPlan(plan.id)}>Tout vider</button>
            <button onClick={() => { choisirSalle(salle.id); setVue('salles') }}>Modifier la salle…</button>
            <h3>Ce qui apparaît à l'impression</h3>
            <div className="ligne">
              <button onClick={() => setOptions(NEUTRE)}>Version neutre</button>
              <button onClick={() => setOptions(COMPLET)}>Tout afficher</button>
            </div>
            {(Object.keys(LIBELLE_OPTIONS) as (keyof Options)[]).map((k) => (
              <label key={k} className="coche">
                <input type="checkbox" checked={options[k]} onChange={(e) => setOptions({ ...options, [k]: e.target.checked })} /> {LIBELLE_OPTIONS[k]}
              </label>
            ))}
            <label className="coche"><input type="checkbox" checked={apercu} onChange={(e) => setApercu(e.target.checked)} /> Aperçu à l'écran</label>
            <label className="coche"><input type="checkbox" checked={retourne} onChange={(e) => setRetourne(e.target.checked)} /> Vue retournée (180°)</label>
            <button className="primaire" onClick={() => window.print()}>🖨 Imprimer / PDF</button>
            <p className="aide">Glissez les personnes sur les places. Déposer sur une place occupée échange les deux.</p>
          </>
        )}

        {onglet === 'regles' && <ReglesPanel plan={plan} classe={classe} alertes={analyse.alertes} />}
        {onglet === 'suivi' && <SuiviPanel plan={plan} />}
      </aside>

      <div className={classesToile(options, retourne, apercu)}>
        <h2 className="titre-impression">{plan.nom}</h2>
        <SalleSvg salle={salle} svgRef={svgRef}>
          {salle.meubles.flatMap((m) =>
            m.places.map((p) => {
              const c = centrePlace(m, p)
              const eleveId = plan.affectations[p.id]
              const e = eleveId ? parId.get(eleveId) : undefined
              const aesh = e ? estAesh(e) : false
              const effectif = e && !aesh ? analyse.feuEffectif[e.id] ?? e.feu : undefined
              const contamine = e && effectif && effectif !== e.feu
              return (
                <g key={p.id} data-place-id={p.id} transform={`translate(${c.x - CARTE.w / 2} ${c.y - CARTE.h / 2})`}>
                  <g className="contre">
                    {!e && <rect className="slot" width={CARTE.w} height={CARTE.h} rx={8} />}
                    {e && (
                      <g className={`carte-svg ${drag?.eleveId === e.id ? 'fantome' : ''}`} onPointerDown={(ev) => commencer(ev, e.id)}>
                        <rect className="carte-fond" width={CARTE.w} height={CARTE.h} rx={10} />
                        <title>{[nomComplet(e), e.genre, ...e.annotations].filter(Boolean).join(' · ')}</title>
                        {url(e)
                          ? <image className="p-photo" href={url(e)} x={PHOTO.cx - PHOTO.r} y={PHOTO.cy - PHOTO.r} width={PHOTO.r * 2} height={PHOTO.r * 2} clipPath="url(#clip-photo)" preserveAspectRatio="xMidYMid slice" />
                          : <circle className="p-photo avatar-vide" cx={PHOTO.cx} cy={PHOTO.cy} r={PHOTO.r} />}
                        <circle
                          className="p-feu" cx={PHOTO.cx} cy={PHOTO.cy} r={PHOTO.r + 1.5} fill="none" strokeWidth={4}
                          stroke={aesh ? '#4a82d6' : COULEUR_FEU[effectif!]}
                        />
                        {!aesh && (
                          <g className="p-feu">
                            <circle cx={11} cy={11} r={6} fill={COULEUR_FEU[effectif!]} stroke={contamine ? '#1f2933' : '#fff'} strokeWidth={contamine ? 2 : 1} />
                            {contamine && <text x={20} y={14} className="badge-svg">▲</text>}
                          </g>
                        )}
                        {aesh && <text className="p-annot badge-svg" x={4} y={13}>AESH</text>}
                        {e.genre && <text className="p-genre genre-svg" x={CARTE.w - 4} y={13}>{e.genre === 'fille' ? 'F' : 'G'}</text>}
                        {e.annotations.slice(0, 4).map((t, i) => (
                          <text key={t} className="p-annot annot-svg" x={CARTE.w - 4} y={e.genre ? 24 + i * 10 : 13 + i * 10}>{t}</text>
                        ))}
                        <g className="groupe-noms">
                          <text className="p-prenom prenom" x={CARTE.w / 2} y={79}>{tronque(e.prenom, 12)}</text>
                          <text className="p-nom nom" x={CARTE.w / 2} y={90}>{tronque(e.nom, 14)}</text>
                        </g>
                      </g>
                    )}
                  </g>
                </g>
              )
            }),
          )}
          <g className="liens" pointerEvents="none">
            {analyse.liens.map((l, i) => {
              const [a, b] = [centres.get(l.a), centres.get(l.b)]
              if (!a || !b) return null
              return (
                <line
                  key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={l.type === 'aesh' ? COULEUR_NIVEAU.info : COULEUR_NIVEAU[l.niveau]}
                  strokeWidth={l.type === 'aesh' ? 3 : 5}
                  strokeDasharray={l.type === 'aesh' ? '2 7' : '10 6'}
                  strokeLinecap="round"
                />
              )
            })}
          </g>
        </SalleSvg>
        <Legende />
      </div>

      {drag && dragEleve && (
        <div className="fantome-drag" style={{ left: drag.x, top: drag.y }}>
          <Avatar eleve={dragEleve} url={url(dragEleve)} />
          <span>{dragEleve.prenom}</span>
        </div>
      )}
    </div>
  )
}

function Legende() {
  return (
    <p className="legende">
      {FEUX.map((f) => (
        <span key={f} className="p-feu"><i className={`pt feu-${f}`} /> {LIBELLE_FEU[f]}</span>
      ))}
      <span className="p-feu"><i className="pt aesh" /> AESH</span>
    </p>
  )
}

function Avatar({ eleve, url }: { eleve: Eleve; url?: string }) {
  return url ? <img className="avatar" src={url} alt="" /> : <span className="avatar vide">{eleve.prenom.slice(0, 1)}</span>
}

// ---------- Règles & alertes ----------

function libelleRegle(r: Regle, parId: Map<string, Eleve>) {
  const n = (id: string) => (parId.get(id) ? nomComplet(parId.get(id)!) : '?')
  if (r.type === 'separer') return `${n(r.eleveA)} ≠ ${n(r.eleveB)} (séparés)`
  if (r.type === 'couleurs') return `${r.a} ≠ ${r.b} côte à côte`
  return `${n(r.eleve)} devient ${r.devient} près de ${n(r.avec)}`
}

function ReglesPanel({ plan, classe, alertes }: { plan: Plan; classe: Classe; alertes: ReturnType<typeof analyser>['alertes'] }) {
  const { ajouterRegle, supprimerRegle } = useApp()
  const eleves = classe.eleves.filter((e) => !estAesh(e))
  const parId = new Map(classe.eleves.map((e) => [e.id, e]))
  const [type, setType] = useState<Regle['type']>('separer')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [fa, setFa] = useState<Feu>('rouge')
  const [fb, setFb] = useState<Feu>('rouge')
  const [devient, setDevient] = useState<Feu>('orange')

  const valide = type === 'couleurs' || (a && b && a !== b)
  const ajouter = () => {
    if (!valide) return
    if (type === 'separer') ajouterRegle(plan.id, { type, eleveA: a, eleveB: b })
    else if (type === 'couleurs') ajouterRegle(plan.id, { type, a: fa, b: fb })
    else ajouterRegle(plan.id, { type, eleve: a, avec: b, devient })
  }
  const choixEleves = (valeur: string, set: (v: string) => void, vide: string) => (
    <select value={valeur} onChange={(e) => set(e.target.value)}>
      <option value="">{vide}</option>
      {eleves.map((e) => <option key={e.id} value={e.id}>{nomComplet(e)}</option>)}
    </select>
  )
  const choixFeu = (v: Feu, set: (f: Feu) => void) => (
    <select value={v} onChange={(e) => set(e.target.value as Feu)}>
      {FEUX.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
  )

  return (
    <>
      <h3>Alertes <small>{alertes.length}</small></h3>
      {alertes.length === 0 && <p className="aide">Aucune alerte ✔</p>}
      <ul className="alertes">
        {alertes.map((al) => (
          <li key={al.id} className={`alerte ${al.niveau}`}>{al.message}</li>
        ))}
      </ul>

      <h3>Règles de ce plan</h3>
      <ul className="regles">
        {plan.regles.map((r) => (
          <li key={r.id}>
            <span>{libelleRegle(r, parId)}</span>
            <button className="danger" aria-label="Supprimer la règle" onClick={() => supprimerRegle(plan.id, r.id)}>✕</button>
          </li>
        ))}
        {plan.regles.length === 0 && <li className="aide">Aucune règle.</li>}
      </ul>

      <div className="form-regle">
        <select value={type} onChange={(e) => setType(e.target.value as Regle['type'])}>
          <option value="separer">Séparer deux élèves</option>
          <option value="couleurs">Couleurs à ne pas rapprocher</option>
          <option value="influence">Un élève change de couleur près d'un autre</option>
        </select>
        {type === 'separer' && <>{choixEleves(a, setA, 'Élève 1…')}{choixEleves(b, setB, 'Élève 2…')}</>}
        {type === 'couleurs' && <div className="ligne">{choixFeu(fa, setFa)}<span>avec</span>{choixFeu(fb, setFb)}</div>}
        {type === 'influence' && (
          <>
            {choixEleves(a, setA, 'Cet élève…')}
            <div className="ligne"><span>devient</span>{choixFeu(devient, setDevient)}</div>
            {choixEleves(b, setB, 'près de…')}
          </>
        )}
        <button className="primaire" disabled={!valide} onClick={ajouter}>Ajouter la règle</button>
        <p className="aide">« Côte à côte » = erreur ; devant, derrière, diagonale ou de l'autre côté d'une allée = attention. L'influence joue côte à côte et devant/derrière.</p>
      </div>
    </>
  )
}

// ---------- Hypothèses ----------

function SuiviPanel({ plan }: { plan: Plan }) {
  const { plans, classes, dupliquerPlan, definirStatut, modifierNotes, choisirPlan } = useApp()
  const freres = plans.filter((p) => p.classeId === plan.classeId)
  const parent = plan.parentId ? plans.find((p) => p.id === plan.parentId) : undefined
  const classe = classes.find((c) => c.id === plan.classeId)

  return (
    <>
      <h3>Statut de cette hypothèse</h3>
      <select value={plan.statut} onChange={(e) => definirStatut(plan.id, e.target.value as StatutPlan)}>
        {(Object.keys(LIBELLE_STATUT) as StatutPlan[]).map((s) => <option key={s} value={s}>{LIBELLE_STATUT[s]}</option>)}
      </select>
      <p className="aide">
        Créé le {new Date(plan.creeLe).toLocaleDateString('fr-FR')}
        {plan.testeDepuis && ` · en test depuis le ${new Date(plan.testeDepuis).toLocaleDateString('fr-FR')}`}
        {parent && <> · dérivé de <button className="lien" onClick={() => choisirPlan(parent.id)}>{parent.nom}</button></>}
      </p>
      <h3>Observations</h3>
      <textarea rows={6} value={plan.notes} placeholder="Ce que ça donne dans la vraie classe : bavardages, élèves à changer…" onChange={(e) => modifierNotes(plan.id, e.target.value)} />
      <button className="primaire" onClick={() => dupliquerPlan(plan.id)}>Essayer autre chose : nouvelle hypothèse à partir de celle-ci</button>

      <h3>Hypothèses pour {classe?.nom} <small>{freres.length}</small></h3>
      <ul className="hypotheses">
        {freres.map((p) => (
          <li key={p.id}>
            <button className={p.id === plan.id ? 'actif' : ''} onClick={() => choisirPlan(p.id)}>
              <span className={`statut statut-${p.statut}`}>{LIBELLE_STATUT[p.statut]}</span> {p.nom}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
