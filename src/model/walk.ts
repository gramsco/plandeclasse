import { footprint, type Rect } from './geometry'
import { isWallItem } from './rooms'
import type { Room } from './types'

/** How close, in room pixels, a walking person gets to a table or a wall. */
export const WALK_RADIUS = 12

const inside = (rect: Rect, x: number, y: number) =>
  x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h

/**
 * Where a person who walks from `from` towards `to` ends up: inside the room and not through a table. Each axis
 * is tried on its own, so that walking into a table slides along it. A table the person already stands in (the
 * teacher starts at their own desk) does not block, so that one can always walk out of it.
 */
export function stepInRoom(room: Room, from: { x: number; y: number }, to: { x: number; y: number }) {
  const r = WALK_RADIUS
  const blocking = room.furniture
    .filter((f) => !isWallItem(f.type))
    .map(footprint)
    .map((o) => ({ x: o.x - r, y: o.y - r, w: o.w + 2 * r, h: o.h + 2 * r }))
    .filter((o) => !inside(o, from.x, from.y))
  const free = (x: number, y: number) =>
    x >= r && x <= room.width - r && y >= r && y <= room.height - r && !blocking.some((o) => inside(o, x, y))

  let { x, y } = from
  if (free(to.x, y)) x = to.x
  if (free(x, to.y)) y = to.y
  return { x, y }
}
