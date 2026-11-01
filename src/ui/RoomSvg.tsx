import type { PointerEvent, ReactNode, RefObject } from 'react'
import { footprint, PHOTO, SEAT_MARK, seatMarkCenter } from '../model/geometry'
import { FURNITURE_TYPES, isWallItem } from '../model/rooms'
import type { Furniture, Room } from '../model/types'

type Props = {
  room: Room
  svgRef?: RefObject<SVGSVGElement | null>
  selectedIds?: string[]
  /** Draws a small chair on the side where each student sits (room editor). */
  showSides?: boolean
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
  showSides = false,
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
              className={`furniture ${f.type} ${selectedIds.includes(f.id) ? 'selected' : ''}`}
            />
            <Dividers furniture={f} />
            {showSides && f.type !== 'chair' && <SeatMarks furniture={f} />}
            {isWallItem(f.type) && (
              <text
                x={box.x + box.w / 2}
                y={box.y + box.h / 2}
                className="label wall-label"
                transform={box.h > box.w ? `rotate(-90 ${box.x + box.w / 2} ${box.y + box.h / 2})` : undefined}
              >
                {FURNITURE_TYPES[f.type].label}
              </text>
            )}
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

/** A small chair next to each seat, on the side where the student sits (facing the table). */
function SeatMarks({ furniture: f }: { furniture: Furniture }) {
  return (
    <g className="seat-marks" pointerEvents="none">
      {f.seats.map((seat) => {
        const { x, y, back } = seatMarkCenter(f, seat)
        // The mark is drawn for a student on the south side, then turned to the actual side.
        const angle = (Math.atan2(back.y, back.x) * 180) / Math.PI - 90
        return (
          <rect
            key={seat.id}
            className="seat-mark"
            x={-SEAT_MARK.w / 2}
            y={-SEAT_MARK.d / 2}
            width={SEAT_MARK.w}
            height={SEAT_MARK.d}
            rx={6}
            transform={`translate(${x} ${y}) rotate(${angle})`}
          />
        )
      })}
    </g>
  )
}
