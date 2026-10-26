import type { PointerEvent, ReactNode, RefObject } from 'react'
import { footprint, PHOTO } from '../model/geometry'
import type { Furniture, Room } from '../model/types'

type Props = {
  room: Room
  svgRef?: RefObject<SVGSVGElement | null>
  selectedIds?: string[]
  onFurniturePointerDown?(e: PointerEvent, furniture: Furniture): void
  onBackgroundPointerDown?(e: PointerEvent): void
  onPointerMove?(e: PointerEvent): void
  onPointerUp?(e: PointerEvent): void
  children?: ReactNode
}

/** Draws the room (background + furniture). Seats and students are passed as children. */
export function RoomSvg({
  room,
  svgRef,
  selectedIds = [],
  onFurniturePointerDown,
  onBackgroundPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: Props) {
  const grid = room.grid || 10
  return (
    <svg
      ref={svgRef}
      className="room-svg"
      viewBox={`0 0 ${room.width} ${room.height}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <defs>
        <pattern id="grid" width={grid * 2} height={grid * 2} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={1.2} className="grid-dot" />
        </pattern>
        <clipPath id="photo-clip">
          <circle cx={PHOTO.cx} cy={PHOTO.cy} r={PHOTO.r} />
        </clipPath>
      </defs>
      <rect
        className="room-background"
        width={room.width}
        height={room.height}
        onPointerDown={onBackgroundPointerDown}
      />
      <rect className="room-grid" width={room.width} height={room.height} fill="url(#grid)" pointerEvents="none" />
      {room.furniture.map((f) => {
        const box = footprint(f)
        return (
          <g
            key={f.id}
            onPointerDown={onFurniturePointerDown ? (e) => onFurniturePointerDown(e, f) : undefined}
            className={onFurniturePointerDown ? 'furniture-editable' : undefined}
          >
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              rx={8}
              className={`furniture ${f.type === 'teacher' ? 'teacher' : ''} ${selectedIds.includes(f.id) ? 'selected' : ''} ${f.type === 'chair' ? 'chair' : ''}`}
            />
            <Dividers furniture={f} />
            {f.type === 'teacher' && (
              <text x={box.x + box.w / 2} y={box.y + box.h / 2} className="label">
                Bureau
              </text>
            )}
          </g>
        )
      })}
      {children}
    </svg>
  )
}

/** Lines separating the seats of a double table or an island (really individual tables pushed together). */
function Dividers({ furniture: f }: { furniture: Furniture }) {
  if (f.type !== 'double' && f.type !== 'island') return null
  const cx = f.x + f.width / 2
  const cy = f.y + f.height / 2
  return (
    <g transform={`rotate(${f.rotation} ${cx} ${cy})`} className="divider" pointerEvents="none">
      <line x1={cx} y1={f.y} x2={cx} y2={f.y + f.height} />
      {f.type === 'island' && <line x1={f.x} y1={cy} x2={f.x + f.width} y2={cy} />}
    </g>
  )
}
