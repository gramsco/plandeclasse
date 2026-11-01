import { footprint, type Rect } from './geometry'
import { newId, type Furniture, type FurnitureType, type Room, type Rotation } from './types'

export const FURNITURE_TYPES: Record<
  FurnitureType,
  { label: string; width: number; height: number; seats: { dx: number; dy: number }[] }
> = {
  single: { label: 'Table individuelle', width: 100, height: 92, seats: [{ dx: 0, dy: 0 }] },
  double: {
    label: 'Table double',
    width: 200,
    height: 92,
    seats: [
      { dx: -50, dy: 0 },
      { dx: 50, dy: 0 },
    ],
  },
  island: {
    label: 'Îlot de 4',
    width: 200,
    height: 184,
    seats: [
      { dx: -50, dy: -46 },
      { dx: 50, dy: -46 },
      { dx: -50, dy: 46 },
      { dx: 50, dy: 46 },
    ],
  },
  chair: { label: "Chaise d'adulte (AESH)", width: 100, height: 92, seats: [{ dx: 0, dy: 0 }] },
  teacher: { label: 'Bureau du prof', width: 180, height: 70, seats: [] },
  door: { label: 'Porte', width: 90, height: 24, seats: [] },
  window: { label: 'Fenêtre', width: 140, height: 24, seats: [] },
  board: { label: 'Tableau noir', width: 240, height: 24, seats: [] },
  whiteboard: { label: 'Tableau blanc', width: 240, height: 24, seats: [] },
}

/** Blackboard or whiteboard: the front of the room, which students face. */
export const isBoard = (type: FurnitureType) => type === 'board' || type === 'whiteboard'

/** Items that stand against a wall: not tables, no seats, drawn in the room as part of the building. */
export const WALL_ITEMS: readonly FurnitureType[] = ['door', 'window', 'board', 'whiteboard']
export const isWallItem = (type: FurnitureType) => WALL_ITEMS.includes(type)

export function createFurniture(type: FurnitureType, x: number, y: number, rotation: Rotation = 0): Furniture {
  const t = FURNITURE_TYPES[type]
  return {
    id: newId(),
    type,
    x,
    y,
    rotation,
    width: t.width,
    height: t.height,
    seats: t.seats.map((s) => ({ id: newId(), ...s })),
  }
}

/** Creates furniture whose FOOTPRINT (after rotation) has its top-left corner at (fx, fy). */
function createAtFootprint(type: FurnitureType, fx: number, fy: number, rotation: Rotation = 0): Furniture {
  const f = createFurniture(type, 0, 0, rotation)
  const r = footprint(f)
  f.x += fx - r.x
  f.y += fy - r.y
  return f
}

const overlaps = (a: Rect, b: Rect) => !(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h)

/**
 * Creates furniture at the first free spot: scanning the room for tables, along its own wall for wall items
 * (board on the front wall, door on the back wall, windows on the left wall).
 */
export function createFurnitureIn(room: Room, type: FurnitureType): Furniture {
  const others = room.furniture.map(footprint)
  const isFree = (f: Furniture) => others.every((o) => !overlaps(footprint(f), o))
  const step = 20

  if (isWallItem(type)) {
    const t = FURNITURE_TYPES[type]
    const spots: Furniture[] =
      type === 'window'
        ? range(100, room.height - t.width, step).map((y) => createAtFootprint(type, 0, y, 90))
        : range(0, room.width - t.width, step).map((x) =>
            createAtFootprint(type, x, type === 'door' ? room.height - t.height : 0),
          )
    // Board centred, door near the right-hand corner: the closest free spot to that anchor.
    const anchor = type === 'window' ? 100 : isBoard(type) ? (room.width - t.width) / 2 : room.width - t.width - 40
    const key = (f: Furniture) => Math.abs((type === 'window' ? footprint(f).y : footprint(f).x) - anchor)
    const ordered = [...spots].sort((a, b) => key(a) - key(b))
    return ordered.find(isFree) ?? ordered[0] ?? createFurniture(type, 0, 0)
  }

  const furniture = createFurniture(type, 0, 0)
  for (let y = 20; y + furniture.height <= room.height; y += step)
    for (let x = 20; x + furniture.width <= room.width; x += step) {
      const candidate = { ...furniture, x, y }
      if (isFree(candidate)) return candidate
    }
  return furniture
}

const range = (from: number, to: number, step: number) => {
  const values: number[] = []
  for (let v = from; v <= to; v += step) values.push(v)
  return values
}

const emptyRoom = (name: string, width = 1200, height = 800): Room => ({
  id: newId(),
  name,
  width,
  height,
  grid: 10,
  furniture: [],
})

function addGrid(room: Room, type: FurnitureType, cols: number, rows: number, gapX: number, gapY: number, y0: number) {
  const t = FURNITURE_TYPES[type]
  const total = cols * t.width + (cols - 1) * gapX
  const x0 = Math.round((room.width - total) / 2 / 10) * 10
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      room.furniture.push(createFurniture(type, x0 + c * (t.width + gapX), y0 + r * (t.height + gapY)))
}

const addTeacherDesk = (room: Room) =>
  room.furniture.push(createFurniture('teacher', Math.round((room.width - 180) / 20) * 10, 40))

/** The board and the door, added once the tables are in place so that they find a free spot. */
const addBoardAndDoor = (room: Room) => {
  room.furniture.push(createFurnitureIn(room, 'board'))
  room.furniture.push(createFurnitureIn(room, 'door'))
  return room
}

export type RoomTemplate = { key: string; label: string; description: string; create: () => Room }

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    key: 'doubles-3x4',
    label: 'Tables doubles en rangées — 24 places',
    description: '3 colonnes × 4 rangées de tables doubles',
    create() {
      const room = emptyRoom('Salle (tables doubles)')
      addTeacherDesk(room)
      addGrid(room, 'double', 3, 4, 60, 28, 170)
      return addBoardAndDoor(room)
    },
  },
  {
    key: 'doubles-3x5',
    label: 'Tables doubles en rangées — 30 places',
    description: '3 colonnes × 5 rangées de tables doubles',
    create() {
      const room = emptyRoom('Salle (tables doubles)')
      addTeacherDesk(room)
      addGrid(room, 'double', 3, 5, 60, 28, 160)
      return addBoardAndDoor(room)
    },
  },
  {
    key: 'islands-3x2',
    label: 'Îlots de 4 — 24 places',
    description: '6 îlots de 4 élèves',
    create() {
      const room = emptyRoom('Salle (îlots)')
      addTeacherDesk(room)
      addGrid(room, 'island', 3, 2, 80, 40, 170)
      return addBoardAndDoor(room)
    },
  },
  {
    key: 'singles-6x5',
    label: 'Tables individuelles en rangées — 30 places',
    description: '6 colonnes × 5 rangées',
    create() {
      const room = emptyRoom('Salle (tables individuelles)')
      addTeacherDesk(room)
      addGrid(room, 'single', 6, 5, 20, 24, 160)
      return addBoardAndDoor(room)
    },
  },
  {
    key: 'u-20',
    label: 'En U — 20 places',
    description: 'Tables sur trois côtés, face au tableau',
    create() {
      const room = emptyRoom('Salle (en U)', 1400, 900)
      addTeacherDesk(room)
      for (let i = 0; i < 6; i++) {
        room.furniture.push(createAtFootprint('single', 80, 160 + i * 108, 90))
        room.furniture.push(createAtFootprint('single', 1400 - 80 - 92, 160 + i * 108, 270))
      }
      for (let i = 0; i < 8; i++) room.furniture.push(createAtFootprint('single', 188 + i * 108, 790, 0))
      return addBoardAndDoor(room)
    },
  },
  {
    key: 'empty',
    label: 'Salle vide',
    description: 'À composer vous-même',
    create: () => emptyRoom('Nouvelle salle'),
  },
]

export const findRoomTemplate = (key: string) => ROOM_TEMPLATES.find((t) => t.key === key)

export const duplicateFurniture = (f: Furniture, offset = 20): Furniture => ({
  ...structuredClone(f),
  id: newId(),
  x: f.x + offset,
  y: f.y + offset,
  seats: f.seats.map((s) => ({ ...s, id: newId() })),
})

export const duplicateRoom = (room: Room): Room => ({
  ...structuredClone(room),
  id: newId(),
  name: `${room.name} (copie)`,
  furniture: room.furniture.map((f) => duplicateFurniture(f, 0)),
})
