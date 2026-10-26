import type { PointerEvent, ReactNode, RefObject } from 'react'
import { emprise, PHOTO } from '../model/geometry'
import type { Meuble, Salle } from '../model/types'

type Props = {
  salle: Salle
  svgRef?: RefObject<SVGSVGElement | null>
  selectedIds?: string[]
  onMeublePointerDown?(e: PointerEvent, m: Meuble): void
  onFondPointerDown?(e: PointerEvent): void
  onPointerMove?(e: PointerEvent): void
  onPointerUp?(e: PointerEvent): void
  children?: ReactNode
}

/** Dessin de la salle (fond + tables). Les places/élèves sont passés en children. */
export function SalleSvg({
  salle, svgRef, selectedIds = [], onMeublePointerDown, onFondPointerDown, onPointerMove, onPointerUp, children,
}: Props) {
  const g = salle.grille || 10
  return (
    <svg
      ref={svgRef}
      className="salle-svg"
      viewBox={`0 0 ${salle.largeur} ${salle.hauteur}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <defs>
        <pattern id="grille" width={g * 2} height={g * 2} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={1.2} className="grille-point" />
        </pattern>
        <clipPath id="clip-photo">
          <circle cx={PHOTO.cx} cy={PHOTO.cy} r={PHOTO.r} />
        </clipPath>
      </defs>
      <rect className="salle-fond" width={salle.largeur} height={salle.hauteur} onPointerDown={onFondPointerDown} />
      <rect className="salle-grille" width={salle.largeur} height={salle.hauteur} fill="url(#grille)" pointerEvents="none" />
      {salle.meubles.map((m) => {
        const e = emprise(m)
        return (
          <g key={m.id} onPointerDown={onMeublePointerDown ? (ev) => onMeublePointerDown(ev, m) : undefined}
             className={onMeublePointerDown ? 'meuble-editable' : undefined}>
            <rect
              x={e.x} y={e.y} width={e.w} height={e.h} rx={8}
              className={`meuble ${m.type === 'prof' ? 'prof' : ''} ${selectedIds.includes(m.id) ? 'sel' : ''} ${m.type === 'chaise' ? 'chaise' : ''}`}
            />
            <Separations m={m} />
            {m.type === 'prof' && (
              <text x={e.x + e.w / 2} y={e.y + e.h / 2} className="etiquette">Bureau</text>
            )}
          </g>
        )
      })}
      {children}
    </svg>
  )
}

/** Traits qui séparent les places d'une table double / d'un îlot (tables en réalité individuelles). */
function Separations({ m }: { m: Meuble }) {
  if (m.type !== 'double' && m.type !== 'ilot') return null
  const cx = m.x + m.largeur / 2
  const cy = m.y + m.hauteur / 2
  return (
    <g transform={`rotate(${m.rotation} ${cx} ${cy})`} className="separation" pointerEvents="none">
      <line x1={cx} y1={m.y} x2={cx} y2={m.y + m.hauteur} />
      {m.type === 'ilot' && <line x1={m.x} y1={cy} x2={m.x + m.largeur} y2={cy} />}
    </g>
  )
}
