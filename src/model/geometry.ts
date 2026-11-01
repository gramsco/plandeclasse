import type { Furniture, Room } from './types'

export type Rect = { x: number; y: number; w: number; h: number }

/** Size of the student card drawn on a seat. */
export const CARD = { w: 94, h: 92 }
/** Photo (circle) inside the card. */
export const PHOTO = { cx: 47, cy: 33, r: 30 }

/** Rectangle actually occupied by a piece of furniture (accounts for rotation, centre preserved). */
export function footprint(f: Furniture): Rect {
  const cx = f.x + f.width / 2
  const cy = f.y + f.height / 2
  const turned = f.rotation === 90 || f.rotation === 270
  const w = turned ? f.height : f.width
  const h = turned ? f.width : f.height
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

export function seatCenter(f: Furniture, seat: { dx: number; dy: number }) {
  const cx = f.x + f.width / 2
  const cy = f.y + f.height / 2
  const { dx, dy } = seat
  switch (f.rotation) {
    case 90:
      return { x: cx - dy, y: cy + dx }
    case 180:
      return { x: cx - dx, y: cy - dy }
    case 270:
      return { x: cx + dy, y: cy - dx }
    default:
      return { x: cx + dx, y: cy + dy }
  }
}

/** Distance, from the middle of a seat, to the edge of the table on the side where the student sits. */
const SEAT_TO_EDGE = 46
/** The small chair drawn in the room editor on the side where the student sits. */
export const SEAT_MARK = { w: 44, d: 16 }

/**
 * Unit vector, in room coordinates, from a seat towards the side where its student sits (facing the table).
 * Students sit on the south side of an unrotated table, except the top row of an island, who sit on the north side.
 */
export function seatBack(f: Furniture, seat: { dx: number; dy: number }) {
  const from = seatCenter(f, seat)
  const to = seatCenter(f, { dx: seat.dx, dy: seat.dy + (seat.dy < 0 ? -1 : 1) })
  return { x: to.x - from.x, y: to.y - from.y }
}

/** Where the student of a seat sits, just outside the table: the middle of its chair mark. */
export function seatMarkCenter(f: Furniture, seat: { dx: number; dy: number }) {
  const c = seatCenter(f, seat)
  const back = seatBack(f, seat)
  const distance = SEAT_TO_EDGE + 2 + SEAT_MARK.d / 2
  return { x: c.x + back.x * distance, y: c.y + back.y * distance, back }
}

export type RoomSeat = { seatId: string; furnitureId: string; x: number; y: number; rotation: number }

/** Every seat of the room, in reading order (top to bottom, left to right). */
export function roomSeats(room: Room): RoomSeat[] {
  return room.furniture
    .flatMap((f) =>
      f.seats.map((s) => ({ seatId: s.id, furnitureId: f.id, rotation: f.rotation, ...seatCenter(f, s) })),
    )
    .sort((a, b) => Math.round(a.y / 20) - Math.round(b.y / 20) || a.x - b.x)
}

/**
 * "Semi-magnetic" snapping: sticks to the edges of other furniture within `threshold`, otherwise
 * to the grid, and stays inside the room. Returns the correction to apply.
 */
export function snap(
  rect: Rect,
  others: Rect[],
  room: { width: number; height: number; grid: number },
  threshold = 8,
): { dx: number; dy: number } {
  const axis = (pos: number, size: number, edges: number[], grid: number, max: number) => {
    let best: number | undefined
    for (const edge of edges) {
      for (const d of [edge - pos, edge - (pos + size)]) {
        if (Math.abs(d) <= threshold && (best === undefined || Math.abs(d) < Math.abs(best))) best = d
      }
    }
    const wanted = best ?? (grid ? Math.round(pos / grid) * grid - pos : 0)
    const clamped = Math.min(Math.max(pos + wanted, 0), Math.max(0, max - size))
    return clamped - pos
  }
  return {
    dx: axis(
      rect.x,
      rect.w,
      others.flatMap((o) => [o.x, o.x + o.w]),
      room.grid,
      room.width,
    ),
    dy: axis(
      rect.y,
      rect.h,
      others.flatMap((o) => [o.y, o.y + o.h]),
      room.grid,
      room.height,
    ),
  }
}
