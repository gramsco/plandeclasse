import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { footprint, snap, type Rect } from '../model/geometry'
import { FURNITURE_TYPES } from '../model/rooms'
import type { Furniture, FurnitureType, Room } from '../model/types'
import { useApp } from '../store'
import { toSvgPoint } from './geo'
import { ICON, RotateCw } from './icons'
import { RoomSvg } from './RoomSvg'

type DragState = {
  start: { x: number; y: number }
  originals: Furniture[]
  group: Rect // bounding box of the dragged furniture
  others: Rect[] // footprints of the furniture that is not dragged
  moved: boolean
  /** A plain click on an already selected item narrows the selection to it on release. */
  narrowTo?: string
}
type Marquee = { x0: number; y0: number; x1: number; y1: number; base: string[] }

const boundingBox = (rects: Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  return {
    x,
    y,
    w: Math.max(...rects.map((r) => r.x + r.w)) - x,
    h: Math.max(...rects.map((r) => r.y + r.h)) - y,
  }
}

export function RoomEditor({ room }: { room: Room }) {
  const { addFurniture, moveFurniture, rotateFurniture, duplicateFurnitureItems, deleteFurniture, resizeRoom } =
    useApp()
  const svgRef = useRef<SVGSVGElement>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [marquee, setMarquee] = useState<Marquee>()
  const drag = useRef<DragState | null>(null)

  const allIds = room.furniture.map((f) => f.id)
  const selected = selection.filter((id) => allIds.includes(id))
  const seatCount = room.furniture.reduce((n, f) => n + f.seats.length, 0)

  // The keyboard shortcuts always read the current state through a ref.
  const latest = useRef({ room, selected })
  useEffect(() => {
    latest.current = { room, selected }
  })
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const { room: currentRoom, selected: currentSelection } = latest.current
      const modifier = e.metaKey || e.ctrlKey
      if (modifier && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelection(currentRoom.furniture.map((f) => f.id))
      } else if (e.key === 'Escape') setSelection([])
      else if (!currentSelection.length) return
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteFurniture(currentRoom.id, currentSelection)
        setSelection([])
      } else if (e.key.toLowerCase() === 'r' && !modifier) rotateFurniture(currentRoom.id, currentSelection)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = (currentRoom.grid || 10) * (e.shiftKey ? 5 : 1)
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        moveFurniture(
          currentRoom.id,
          currentRoom.furniture
            .filter((f) => currentSelection.includes(f.id))
            .map((f) => ({ id: f.id, x: f.x + dx, y: f.y + dy })),
        )
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteFurniture, rotateFurniture, moveFurniture])

  const onFurniturePointerDown = (e: PointerEvent, furniture: Furniture) => {
    if (e.button !== 0 || !svgRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const multi = e.shiftKey || e.metaKey || e.ctrlKey
    let group = selected
    let narrowTo: string | undefined
    if (multi) {
      group = selected.includes(furniture.id)
        ? selected.filter((id) => id !== furniture.id)
        : [...selected, furniture.id]
      setSelection(group)
      if (!group.includes(furniture.id)) return // removed from the selection: nothing to drag
    } else if (!selected.includes(furniture.id)) {
      group = [furniture.id]
      setSelection(group)
    } else if (selected.length > 1) narrowTo = furniture.id
    const originals = room.furniture.filter((f) => group.includes(f.id))
    drag.current = {
      start: toSvgPoint(svgRef.current, e.clientX, e.clientY),
      originals,
      group: boundingBox(originals.map(footprint)),
      others: room.furniture.filter((f) => !group.includes(f.id)).map(footprint),
      moved: false,
      narrowTo,
    }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const onBackgroundPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !svgRef.current) return
    const point = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    setMarquee({ x0: point.x, y0: point.y, x1: point.x, y1: point.y, base: additive ? selected : [] })
    if (!additive) setSelection([])
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!svgRef.current) return
    const point = toSvgPoint(svgRef.current, e.clientX, e.clientY)
    if (marquee) {
      const next = { ...marquee, x1: point.x, y1: point.y }
      setMarquee(next)
      const [left, right] = [Math.min(next.x0, next.x1), Math.max(next.x0, next.x1)]
      const [top, bottom] = [Math.min(next.y0, next.y1), Math.max(next.y0, next.y1)]
      const inside = room.furniture
        .filter((f) => {
          const r = footprint(f)
          return r.x < right && r.x + r.w > left && r.y < bottom && r.y + r.h > top
        })
        .map((f) => f.id)
      setSelection([...new Set([...next.base, ...inside])])
      return
    }
    const state = drag.current
    if (!state) return
    let dx = point.x - state.start.x
    let dy = point.y - state.start.y
    if (!state.moved && Math.hypot(dx, dy) < 3) return
    state.moved = true
    const rect = { ...state.group, x: state.group.x + dx, y: state.group.y + dy }
    // Alt = free movement; otherwise the whole group snaps (neighbours first, then the grid).
    const correction = e.altKey ? snap(rect, [], { ...room, grid: 0 }) : snap(rect, state.others, room)
    dx += correction.dx
    dy += correction.dy
    moveFurniture(
      room.id,
      state.originals.map((f) => ({ id: f.id, x: f.x + dx, y: f.y + dy })),
    )
  }

  const onPointerUp = () => {
    const state = drag.current
    if (state && !state.moved && state.narrowTo) setSelection([state.narrowTo])
    drag.current = null
    setMarquee(undefined)
  }

  const add = (type: FurnitureType) => setSelection([addFurniture(room.id, type)])

  return (
    <div className="editor">
      <aside className="tools no-print">
        <h3>Ajouter</h3>
        {(Object.keys(FURNITURE_TYPES) as FurnitureType[]).map((type) => (
          <button key={type} onClick={() => add(type)}>
            + {FURNITURE_TYPES[type].label}
          </button>
        ))}

        <h3>Sélection {selected.length > 0 && <small>{selected.length} table(s)</small>}</h3>
        {selected.length > 0 ? (
          <div className="column">
            <button onClick={() => rotateFurniture(room.id, selected)}>
              <RotateCw size={ICON} /> Pivoter <kbd>R</kbd>
            </button>
            <button onClick={() => setSelection(duplicateFurnitureItems(room.id, selected))}>Dupliquer</button>
            <button
              className="danger"
              onClick={() => {
                deleteFurniture(room.id, selected)
                setSelection([])
              }}
            >
              Supprimer <kbd>Suppr</kbd>
            </button>
          </div>
        ) : (
          <p className="hint">Cliquez une table, ou tracez un rectangle sur le fond pour en sélectionner plusieurs.</p>
        )}
        <button onClick={() => setSelection(allIds)}>
          Tout sélectionner <kbd>Ctrl/⌘ A</kbd>
        </button>

        <h3>Salle</h3>
        <p className="hint">{seatCount} places</p>
        <div className="row">
          <label className="mini">
            Largeur
            <input
              type="number"
              step={50}
              value={room.width}
              onChange={(e) => resizeRoom(room.id, Number(e.target.value), room.height)}
            />
          </label>
          <label className="mini">
            Hauteur
            <input
              type="number"
              step={50}
              value={room.height}
              onChange={(e) => resizeRoom(room.id, room.width, Number(e.target.value))}
            />
          </label>
        </div>
        <p className="hint">
          <kbd>Maj</kbd>+clic ajoute à la sélection. Les flèches déplacent (<kbd>Maj</kbd> = ×5). Les tables s'aimantent
          entre elles et à la grille ; <kbd>Alt</kbd> pour déplacer librement.
        </p>
      </aside>
      <div className="canvas-area">
        <RoomSvg
          room={room}
          svgRef={svgRef}
          selectedIds={selected}
          onFurniturePointerDown={onFurniturePointerDown}
          onBackgroundPointerDown={onBackgroundPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
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
        </RoomSvg>
      </div>
    </div>
  )
}
