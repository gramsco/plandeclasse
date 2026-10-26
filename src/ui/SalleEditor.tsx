import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { aimanter, emprise, type Rect } from '../model/geometry'
import { TYPES_MEUBLE } from '../model/salles'
import type { Meuble, Salle, TypeMeuble } from '../model/types'
import { useApp } from '../store'
import { pointSvg } from './geo'
import { SalleSvg } from './SalleSvg'

type Drag = {
  depart: { x: number; y: number }
  origines: Meuble[]
  groupe: Rect
  autres: Rect[]
  deplace: boolean
  reduire?: string // clic simple sur un élément déjà sélectionné : on isole ce meuble au relâchement
}
type Marquee = { x0: number; y0: number; x1: number; y1: number; ajout: boolean; base: string[] }

const englobant = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x))
  const y = Math.min(...rs.map((r) => r.y))
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }
}

export function SalleEditor({ salle }: { salle: Salle }) {
  const { ajouterMeuble, deplacerMeubles, pivoterMeubles, dupliquerMeubles, supprimerMeubles, redimensionnerSalle } = useApp()
  const svgRef = useRef<SVGSVGElement>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [marquee, setMarquee] = useState<Marquee>()
  const drag = useRef<Drag | null>(null)

  const ids = salle.meubles.map((m) => m.id)
  const sel = selection.filter((id) => ids.includes(id))
  const nbPlaces = salle.meubles.reduce((n, m) => n + m.places.length, 0)

  // Les raccourcis lisent toujours l'état courant via une ref.
  const etat = useRef({ salle, sel })
  etat.current = { salle, sel }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const { salle, sel } = etat.current
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelection(salle.meubles.map((m) => m.id))
      } else if (e.key === 'Escape') setSelection([])
      else if (!sel.length) return
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        supprimerMeubles(salle.id, sel)
        setSelection([])
      } else if (e.key.toLowerCase() === 'r' && !mod) pivoterMeubles(salle.id, sel)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const pas = (salle.grille || 10) * (e.shiftKey ? 5 : 1)
        const dx = e.key === 'ArrowLeft' ? -pas : e.key === 'ArrowRight' ? pas : 0
        const dy = e.key === 'ArrowUp' ? -pas : e.key === 'ArrowDown' ? pas : 0
        deplacerMeubles(salle.id, salle.meubles.filter((m) => sel.includes(m.id)).map((m) => ({ id: m.id, x: m.x + dx, y: m.y + dy })))
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [supprimerMeubles, pivoterMeubles, deplacerMeubles])

  const debutMeuble = (e: PointerEvent, m: Meuble) => {
    if (e.button !== 0 || !svgRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const multi = e.shiftKey || e.metaKey || e.ctrlKey
    let groupe = sel
    let reduire: string | undefined
    if (multi) {
      groupe = sel.includes(m.id) ? sel.filter((i) => i !== m.id) : [...sel, m.id]
      setSelection(groupe)
      if (!groupe.includes(m.id)) return // retiré de la sélection : pas de glisser
    } else if (!sel.includes(m.id)) {
      groupe = [m.id]
      setSelection(groupe)
    } else if (sel.length > 1) reduire = m.id
    const origines = salle.meubles.filter((x) => groupe.includes(x.id))
    drag.current = {
      depart: pointSvg(svgRef.current, e.clientX, e.clientY),
      origines,
      groupe: englobant(origines.map(emprise)),
      autres: salle.meubles.filter((x) => !groupe.includes(x.id)).map(emprise),
      deplace: false,
      reduire,
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const debutFond = (e: PointerEvent) => {
    if (e.button !== 0 || !svgRef.current) return
    const p = pointSvg(svgRef.current, e.clientX, e.clientY)
    const ajout = e.shiftKey || e.metaKey || e.ctrlKey
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, ajout, base: ajout ? sel : [] })
    if (!ajout) setSelection([])
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const bouge = (e: PointerEvent) => {
    if (!svgRef.current) return
    const p = pointSvg(svgRef.current, e.clientX, e.clientY)
    if (marquee) {
      const m = { ...marquee, x1: p.x, y1: p.y }
      setMarquee(m)
      const [x0, x1] = [Math.min(m.x0, m.x1), Math.max(m.x0, m.x1)]
      const [y0, y1] = [Math.min(m.y0, m.y1), Math.max(m.y0, m.y1)]
      const dedans = salle.meubles
        .filter((t) => {
          const r = emprise(t)
          return r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0
        })
        .map((t) => t.id)
      setSelection([...new Set([...m.base, ...dedans])])
      return
    }
    const d = drag.current
    if (!d) return
    let dx = p.x - d.depart.x
    let dy = p.y - d.depart.y
    if (!d.deplace && Math.hypot(dx, dy) < 3) return
    d.deplace = true
    const r = { ...d.groupe, x: d.groupe.x + dx, y: d.groupe.y + dy }
    // Alt = déplacement libre ; sinon aimantation (voisins puis grille) du groupe entier.
    const a = e.altKey ? aimanter(r, [], { ...salle, grille: 0 }) : aimanter(r, d.autres, salle)
    dx += a.dx
    dy += a.dy
    deplacerMeubles(salle.id, d.origines.map((m) => ({ id: m.id, x: m.x + dx, y: m.y + dy })))
  }

  const fin = () => {
    const d = drag.current
    if (d && !d.deplace && d.reduire) setSelection([d.reduire])
    drag.current = null
    setMarquee(undefined)
  }

  const ajouter = (type: TypeMeuble) => setSelection([ajouterMeuble(salle.id, type)])

  return (
    <div className="editeur">
      <aside className="outils no-print">
        <h3>Ajouter</h3>
        {(Object.keys(TYPES_MEUBLE) as TypeMeuble[]).map((t) => (
          <button key={t} onClick={() => ajouter(t)}>+ {TYPES_MEUBLE[t].nom}</button>
        ))}

        <h3>Sélection {sel.length > 0 && <small>{sel.length} table(s)</small>}</h3>
        {sel.length > 0 ? (
          <div className="col">
            <button onClick={() => pivoterMeubles(salle.id, sel)}>↻ Pivoter <kbd>R</kbd></button>
            <button onClick={() => setSelection(dupliquerMeubles(salle.id, sel))}>Dupliquer</button>
            <button className="danger" onClick={() => { supprimerMeubles(salle.id, sel); setSelection([]) }}>
              Supprimer <kbd>Suppr</kbd>
            </button>
          </div>
        ) : (
          <p className="aide">Cliquez une table, ou tracez un rectangle sur le fond pour en sélectionner plusieurs.</p>
        )}
        <button onClick={() => setSelection(ids)}>Tout sélectionner <kbd>Ctrl/⌘ A</kbd></button>

        <h3>Salle</h3>
        <p className="aide">{nbPlaces} places</p>
        <div className="ligne">
          <label className="mini">
            Largeur
            <input type="number" step={50} value={salle.largeur} onChange={(e) => redimensionnerSalle(salle.id, Number(e.target.value), salle.hauteur)} />
          </label>
          <label className="mini">
            Hauteur
            <input type="number" step={50} value={salle.hauteur} onChange={(e) => redimensionnerSalle(salle.id, salle.largeur, Number(e.target.value))} />
          </label>
        </div>
        <p className="aide">
          <kbd>Maj</kbd>+clic ajoute à la sélection. Les flèches déplacent (<kbd>Maj</kbd> = ×5). Les tables s'aimantent entre elles et à la grille ; <kbd>Alt</kbd> pour déplacer librement.
        </p>
      </aside>
      <div className="toile">
        <SalleSvg
          salle={salle}
          svgRef={svgRef}
          selectedIds={sel}
          onMeublePointerDown={debutMeuble}
          onFondPointerDown={debutFond}
          onPointerMove={bouge}
          onPointerUp={fin}
        >
          {marquee && (
            <rect
              className="marquee"
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
            />
          )}
        </SalleSvg>
      </div>
    </div>
  )
}
