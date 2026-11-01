import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Object3D,
  type Material,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { footprint, seatCenter, seatMarkCenter, type Rect } from '../model/geometry'
import { lookoutSeats } from '../model/plan'
import { isBoard, isWallItem } from '../model/rooms'
import {
  fullName,
  type Furniture,
  type Plan,
  type Room,
  type SchoolClass,
  type Student,
  type TrafficLight,
} from '../model/types'
import { ICON, Maximize, Minimize } from './icons'

/** Room pixels to scene units: a double desk is about 1.2 units wide. */
const SCALE = 0.01
const LIGHT_COLORS: Record<TrafficLight, string> = { green: '#3fae5a', orange: '#f0a030', red: '#d9473f' }
const DESK_HEIGHT = 0.75
const SEAT_HEIGHT = 0.45
const PAWN_HEIGHT = 1.0
const WALL_HEIGHT = 2.8
const WALL_THICKNESS = 0.08
const EYE_HEIGHT = 1.6
/** Eye height of a seated student. */
const STUDENT_EYE_HEIGHT = 1.15

type ViewMode = 'desk' | 'free' | 'student'
const VIEW_MODES: { mode: ViewMode; label: string; hint: string }[] = [
  { mode: 'desk', label: 'Vue du bureau', hint: 'Glissez pour regarder autour de vous depuis le bureau du prof.' },
  {
    mode: 'student',
    label: 'Vue élève',
    hint: 'Glissez pour regarder autour de vous depuis la place choisie.',
  },
  { mode: 'free', label: 'Vue libre', hint: 'Glissez pour tourner, molette pour zoomer, clic droit pour déplacer.' },
]

type Props = {
  room: Room
  /** Without a plan, the room is shown empty (room editor). */
  plan?: Plan
  schoolClass?: SchoolClass
  photoUrls?: Record<string, string>
}

type Tracker = <T extends { dispose(): void }>(item: T) => T

/** The room in 3D, read-only. Loaded on demand so three.js stays out of the main bundle. */
export default function Scene3D({ room, plan, schoolClass, photoUrls = {} }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const [chosenMode, setMode] = useState<ViewMode>('desk')
  const [fullscreen, setFullscreen] = useState(false)
  // The scene is built once per content; the camera follows the mode without rebuilding it.
  const applyMode = useRef<(mode: ViewMode, seatId: string) => void>(undefined)

  useEffect(() => {
    const node = root.current
    const onChange = () => setFullscreen(document.fullscreenElement === node)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement === node) void document.exitFullscreen()
    }
  }, [])

  const toggleFullscreen = () =>
    void (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())

  // The scene only needs rebuilding when a photo it shows changes, not each time the store loads another one.
  const photoKey = (schoolClass?.students ?? []).map((s) => (s.photoId ? (photoUrls[s.photoId] ?? '') : '')).join('|')
  const seats = useMemo(() => lookoutSeats(room, plan, schoolClass), [room, plan, schoolClass])
  const [seatChoice, setSeatChoice] = useState('')
  const seatId = seats.some((seat) => seat.id === seatChoice) ? seatChoice : (seats[0]?.id ?? '')
  // No seat to look from (everyone was removed): back to the desk view, so the buttons match the camera.
  const mode = chosenMode === 'student' && seats.length === 0 ? 'desk' : chosenMode
  const currentView = useRef({ mode, seatId })
  useEffect(() => {
    currentView.current = { mode, seatId }
    applyMode.current?.(mode, seatId)
  }, [mode, seatId])

  useEffect(() => {
    const element = host.current
    if (!element) return
    let alive = true
    const disposables: { dispose(): void }[] = []
    const track: Tracker = (item) => (disposables.push(item), item)

    const renderer = new WebGLRenderer({ antialias: true })
    renderer.setSize(element.clientWidth, element.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    element.appendChild(renderer.domElement)

    const width = room.width * SCALE
    const depth = room.height * SCALE
    const scene = new Scene()
    scene.background = new Color('#f7f2e8')
    scene.add(new AmbientLight('#ffffff', 1.6))
    const sun = new DirectionalLight('#ffffff', 1.8)
    sun.position.set(width, 8, depth)
    scene.add(sun)

    const camera = new PerspectiveCamera(65, element.clientWidth / element.clientHeight, 0.1, 100)
    const controls = new OrbitControls(camera, renderer.domElement)

    // Desk view: at the teacher's desk, looking at the class. A target right in front of the camera turns the
    // orbit into a look-around (negative speed: drag the view, not the scene).
    const teacher = room.furniture.find((f) => f.type === 'teacher')
    const desk = teacher ? footprint(teacher) : { x: room.width / 2, y: 0, w: 0, h: 0 }
    const eye = new Vector3((desk.x + desk.w / 2) * SCALE, EYE_HEIGHT, (desk.y + desk.h / 2) * SCALE)
    const forward = new Vector3(width / 2, 0.9, depth / 2).sub(eye)
    if (forward.lengthSq() < 0.01) forward.set(0, 0, 1)
    forward.normalize()

    // What each seat sees, and what to hide when looking from it (its own pawn and card would block the view).
    const seatViews = new Map<string, { eye: Vector3; forward: Vector3; hide: Object3D[] }>()
    const lookAround = (from: Vector3, direction: Vector3) => {
      camera.position.copy(from)
      controls.target.copy(from).addScaledVector(direction, 0.01)
      controls.rotateSpeed = -0.4
      controls.enableZoom = false
      controls.enablePan = false
      controls.maxPolarAngle = Math.PI
    }

    applyMode.current = (next, seat) => {
      const view = next === 'student' ? seatViews.get(seat) : undefined
      const shown = next === 'student' && !view ? 'desk' : next
      for (const v of seatViews.values()) v.hide.forEach((o) => (o.visible = true))
      if (view) {
        view.hide.forEach((o) => (o.visible = false))
        lookAround(view.eye, view.forward)
      } else if (shown === 'desk') {
        lookAround(eye, forward)
      } else {
        camera.position.set(width / 2, Math.max(width, depth) * 0.6, depth * 1.05)
        controls.target.set(width / 2, 0, depth / 2)
        controls.rotateSpeed = 1
        controls.enableZoom = true
        controls.enablePan = true
        controls.maxPolarAngle = Math.PI / 2 - 0.05
      }
      controls.update()
    }

    const material = (color: string, extra?: ConstructorParameters<typeof MeshStandardMaterial>[0]) =>
      track(new MeshStandardMaterial({ color, ...extra }))
    const geometries = new Map<string, BufferGeometry>()
    const geometry = (key: string, make: () => BufferGeometry) => {
      let g = geometries.get(key)
      if (!g) geometries.set(key, (g = track(make())))
      return g
    }
    const add = (g: BufferGeometry, m: Material, x: number, y: number, z: number) => {
      const mesh = new Mesh(g, m)
      mesh.position.set(x, y, z)
      scene.add(mesh)
      return mesh
    }
    const box = (w: number, h: number, d: number, m: Material, x: number, y: number, z: number) =>
      add(track(new BoxGeometry(w, h, d)), m, x, y, z)

    // Floor, and four walls drawn from the inside only: from above, the near walls disappear.
    const floor = add(track(new PlaneGeometry(width, depth)), material('#e4dcc8'), width / 2, 0, depth / 2)
    floor.rotation.x = -Math.PI / 2
    add(
      track(new BoxGeometry(width, WALL_HEIGHT, depth)),
      material('#efe9da', { side: BackSide }),
      width / 2,
      WALL_HEIGHT / 2 - 0.02,
      depth / 2,
    )

    const wood = material('#c9a574')
    const students = new Map((schoolClass?.students ?? []).map((s) => [s.id, s]))
    // `photoKey` lists the photo URL of each student, in the order of the class.
    const urls = photoKey.split('|')
    const photoOf = new Map((schoolClass?.students ?? []).map((s, i) => [s.id, urls[i] || undefined]))
    const lightMaterials = new Map<TrafficLight, Material>()
    const shirt = (light: TrafficLight) => {
      let m = lightMaterials.get(light)
      if (!m) lightMaterials.set(light, (m = material(LIGHT_COLORS[light])))
      return m
    }

    const focus = room.furniture.find((f) => isBoard(f.type)) ?? teacher
    const front = focus && centreOf(focus)
    for (const f of room.furniture) {
      const r = footprint(f)
      if (isWallItem(f.type)) {
        wallItem(f, r, room, { box, material, add, scene, track })
        continue
      }
      const isChair = f.type === 'chair'
      const height = isChair ? SEAT_HEIGHT : DESK_HEIGHT
      const color = f.type === 'teacher' ? material('#8a6a4a') : isChair ? material('#9aa3c4') : wood
      box(r.w * SCALE, height, r.h * SCALE, color, (r.x + r.w / 2) * SCALE, height / 2, (r.y + r.h / 2) * SCALE)

      for (const seat of f.seats) {
        const c = seatCenter(f, seat)
        // The student sits where the 2D editor draws the chair mark.
        const mark = seatMarkCenter(f, seat)
        const position = isChair
          ? new Vector3(c.x * SCALE, 0, c.y * SCALE)
          : new Vector3(mark.x * SCALE, 0, mark.y * SCALE)
        const base = isChair ? SEAT_HEIGHT : 0
        const hide: Object3D[] = []

        const student = students.get(plan?.assignments[seat.id] ?? '')
        if (student) {
          // A plain pawn in the traffic-light colour, with the avatar floating above it.
          hide.push(
            add(
              geometry('pawn', () => new CylinderGeometry(0.1, 0.22, PAWN_HEIGHT, 20)),
              shirt(student.light),
              position.x,
              base + PAWN_HEIGHT / 2,
              position.z,
            ),
          )
          const card = studentCard(student, photoOf.get(student.id), track, () => alive)
          card.position.set(position.x, base + PAWN_HEIGHT + 0.3, position.z)
          scene.add(card)
          hide.push(card)
        }

        // Students look at the board, or at the teacher's desk when there is none.
        const toFront = front
          ? new Vector3(front.x - position.x, 0, front.z - position.z)
          : new Vector3(-mark.back.x, 0, -mark.back.y)
        if (toFront.lengthSq() < 0.01) toFront.set(0, 0, 1)
        seatViews.set(seat.id, {
          eye: new Vector3(position.x, STUDENT_EYE_HEIGHT, position.z),
          forward: toFront.normalize(),
          hide,
        })
      }
    }

    applyMode.current(currentView.current.mode, currentView.current.seatId)

    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      controls.update()
      renderer.render(scene, camera)
    }
    loop()

    const onResize = () => {
      renderer.setSize(element.clientWidth, element.clientHeight)
      camera.aspect = element.clientWidth / element.clientHeight
      camera.updateProjectionMatrix()
    }
    // Also fires when entering or leaving fullscreen.
    const observer = new ResizeObserver(onResize)
    observer.observe(element)

    return () => {
      alive = false
      applyMode.current = undefined
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      // dispose() leaves the WebGL context alive, and browsers only allow about sixteen of them.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [room, plan, schoolClass, photoKey])

  return (
    <div ref={root} className="scene3d">
      <div className="scene3d-bar">
        <div className="segmented" role="group" aria-label="Point de vue">
          {VIEW_MODES.map((v) => (
            <button
              key={v.mode}
              aria-pressed={mode === v.mode}
              disabled={v.mode === 'student' && seats.length === 0}
              onClick={() => setMode(v.mode)}
            >
              {v.label}
            </button>
          ))}
        </div>
        {mode === 'student' && (
          <label className="seat-picker">
            Place de
            <select value={seatId} onChange={(e) => setSeatChoice(e.target.value)}>
              {seats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <button onClick={toggleFullscreen} aria-pressed={fullscreen}>
          {fullscreen ? <Minimize size={ICON} /> : <Maximize size={ICON} />}{' '}
          {fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        </button>
      </div>
      <div ref={host} className="scene3d-host" />
      <p className="hint">{VIEW_MODES.find((v) => v.mode === mode)?.hint}</p>
    </div>
  )
}

type WallContext = {
  box(w: number, h: number, d: number, m: Material, x: number, y: number, z: number): Mesh
  material(color: string, extra?: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial
  add(g: BufferGeometry, m: Material, x: number, y: number, z: number): Mesh
  scene: Scene
  track: Tracker
}

const centreOf = (f: Furniture) => {
  const r = footprint(f)
  return new Vector3((r.x + r.w / 2) * SCALE, 0, (r.y + r.h / 2) * SCALE)
}

/** Door, window or board, as a thin slab flush against the wall it stands on. */
function wallItem(f: Furniture, r: Rect, room: Room, { box, material, add, scene, track }: WallContext) {
  const horizontal = r.w >= r.h
  const length = (horizontal ? r.w : r.h) * SCALE
  // The nearest wall: top or bottom for a horizontal item, left or right for a vertical one.
  const start = horizontal ? r.y : r.x
  const end = (horizontal ? room.height : room.width) - (start + (horizontal ? r.h : r.w))
  const inward = start <= end ? 1 : -1
  const wall = (inward === 1 ? start : start + (horizontal ? r.h : r.w)) * SCALE
  const across = wall + (inward * WALL_THICKNESS) / 2
  const along = (horizontal ? r.x + r.w / 2 : r.y + r.h / 2) * SCALE

  const slab = (h: number, y: number, m: Material) =>
    horizontal
      ? box(length, h, WALL_THICKNESS, m, along, y, across)
      : box(WALL_THICKNESS, h, length, m, across, y, along)

  if (isBoard(f.type)) {
    const white = f.type === 'whiteboard'
    slab(1.1, 1.45, material(white ? '#f4f4f0' : '#2f5d46'))
    slab(0.04, 0.9, material(white ? '#9aa0a6' : '#d8c9a8'))
    // The same sample text on both: only the surface and the ink change.
    const writing = new Mesh(
      track(new PlaneGeometry(length - 0.1, 1.0)),
      track(new MeshStandardMaterial({ map: track(boardTexture(white)) })),
    )
    const out = across + inward * (WALL_THICKNESS / 2 + 0.004)
    writing.position.set(horizontal ? along : out, 1.45, horizontal ? out : along)
    // A plane faces +z; turn it to face into the room.
    writing.rotation.y = horizontal ? (inward === 1 ? 0 : Math.PI) : inward === 1 ? Math.PI / 2 : -Math.PI / 2
    scene.add(writing)
  } else if (f.type === 'door') {
    slab(2.05, 1.025, material('#a4693a'))
    const handle = add(track(new SphereGeometry(0.045, 10, 8)), material('#d4af37'), 0, 1.0, 0)
    const offset = length / 2 - 0.12
    const out = across + inward * (WALL_THICKNESS / 2 + 0.02)
    handle.position.set(horizontal ? along + offset : out, 1.0, horizontal ? out : along + offset)
  } else {
    const glass = slab(1.2, 1.6, material('#bfe6ff', { transparent: true, opacity: 0.45, depthWrite: false }))
    const frame = new LineSegments(
      track(new EdgesGeometry(glass.geometry)),
      track(new LineBasicMaterial({ color: '#7a5a3a' })),
    )
    frame.position.copy(glass.position)
    scene.add(frame)
  }
}

const CARD_W = 256
const CARD_H = 320

/** A billboard with the student's photo (or initials), ringed in the traffic-light colour, and the name below. */
function studentCard(
  student: Student,
  url: string | undefined,
  track: <T extends { dispose(): void }>(item: T) => T,
  isAlive: () => boolean,
) {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')!
  const texture = track(new CanvasTexture(canvas))

  const draw = (photo?: HTMLImageElement) => {
    ctx.clearRect(0, 0, CARD_W, CARD_H)
    ctx.beginPath()
    ctx.arc(128, 124, 112, 0, Math.PI * 2)
    ctx.fillStyle = LIGHT_COLORS[student.light]
    ctx.fill()
    ctx.save()
    ctx.beginPath()
    ctx.arc(128, 124, 98, 0, Math.PI * 2)
    ctx.clip()
    if (photo) {
      // Cover-fit the photo in the circle.
      const side = Math.min(photo.naturalWidth, photo.naturalHeight)
      ctx.drawImage(
        photo,
        (photo.naturalWidth - side) / 2,
        (photo.naturalHeight - side) / 2,
        side,
        side,
        30,
        26,
        196,
        196,
      )
    } else {
      ctx.fillStyle = '#e8e4f4'
      ctx.fillRect(0, 0, CARD_W, CARD_H)
      ctx.fillStyle = '#3d4a8f'
      ctx.font = 'bold 96px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase(), 128, 128)
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillRect(0, 252, CARD_W, 56)
    ctx.fillStyle = '#1c2540'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(fullName(student), 128, 280, 240)
    texture.needsUpdate = true
  }

  draw()
  if (url) {
    const image = new Image()
    image.onload = () => isAlive() && draw(image)
    image.src = url
  }

  const sprite = new Sprite(track(new SpriteMaterial({ map: texture })))
  sprite.scale.set(0.6, 0.75, 1)
  return sprite
}

const BOARD_TEXT = ['Lundi 12 octobre', 'Calcul mental', '7 × 8 = 56', 'Exercices 3 et 4 page 52']
const BOARD_FONT = "'Bradley Hand', 'Segoe Print', 'Chalkboard SE', 'Comic Sans MS', cursive"

/** Hand-written looking text: every letter is a little off its line and its angle (same jitter on every board). */
function boardTexture(whiteboard: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 420
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = whiteboard ? '#ffffff' : '#2f5d46'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = whiteboard ? '#1d3f9a' : '#f1efe6'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `bold 62px ${BOARD_FONT}`

  let seed = 7
  const jitter = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647 - 0.5
  }
  BOARD_TEXT.forEach((line, row) => {
    let x = 50 + (row === 0 ? 0 : 30)
    const y = 95 + row * 100
    for (const char of line) {
      ctx.save()
      ctx.translate(x, y + jitter() * 8 + row * 1.5)
      ctx.rotate(jitter() * 0.1 + (row - 1.5) * 0.004)
      ctx.fillText(char, 0, 0)
      ctx.restore()
      x += ctx.measureText(char).width + jitter() * 2
    }
  })
  return new CanvasTexture(canvas)
}
