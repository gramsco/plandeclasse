import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { analyze } from '../model/analysis'
import { CARD, PHOTO, roomSeats, seatCenter } from '../model/geometry'
import { FILL_STRATEGY_LABELS, type FillStrategy } from '../model/plan'
import {
  fullName,
  GENDER_LABELS,
  isAesh,
  TRAFFIC_LIGHTS,
  TRAFFIC_LIGHT_LABELS,
  type Plan,
  type Room,
  type SchoolClass,
  type Student,
  type TrafficLight,
} from '../model/types'
import { useApp } from '../store'
import {
  canvasClassName,
  FULL_OPTIONS,
  loadPrintOptions,
  NEUTRAL_OPTIONS,
  PRINT_OPTION_LABELS,
  savePrintOptions,
  type PrintOptions,
} from './printOptions'
import { CrownShape, NeutralAvatarShapes } from './NeutralAvatar'
import { RoomSvg } from './RoomSvg'
import { RulesPanel } from './RulesPanel'
import { TrackingPanel } from './TrackingPanel'

type DragState = { studentId: string; x: number; y: number }
type SideTab = 'place' | 'rules' | 'tracking'
const COLLAPSED_KEY = 'sideCollapsed'

const LIGHT_COLORS: Record<TrafficLight, string> = { green: '#3fae5a', orange: '#f0a020', red: '#d9453b' }
const LEVEL_COLORS = { error: '#d9453b', warning: '#f0a020', info: '#4a82d6' }
const AESH_COLOR = '#4a82d6'

const truncate = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + '…' : text)

type Props = { plan: Plan; schoolClass: SchoolClass; room: Room }

export function PlanEditor({ plan, schoolClass, room }: Props) {
  const { assignSeat, clearPlan, fillPlan, applyPlanToRoom, rooms, photoUrls, setView, selectRoom } = useApp()
  const [drag, setDrag] = useState<DragState>()
  const [options, setOptions] = useState<PrintOptions>(loadPrintOptions)
  const [previewMode, setPreviewMode] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [tab, setTab] = useState<SideTab>('place')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')
  const [strategy, setStrategy] = useState<FillStrategy>('random')
  const [otherRoomId, setOtherRoomId] = useState('')
  useEffect(() => savePrintOptions(options), [options])
  useEffect(() => localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'), [collapsed])
  const otherRooms = rooms.filter((r) => r.id !== room.id)

  const studentsById = new Map(schoolClass.students.map((s) => [s.id, s]))
  const placedStudentIds = new Set(Object.values(plan.assignments))
  const unplaced = schoolClass.students.filter((s) => !placedStudentIds.has(s.id))
  const analysis = useMemo(() => analyze(plan, schoolClass, room), [plan, schoolClass, room])
  const centers = useMemo(() => {
    const seats = new Map(roomSeats(room).map((s) => [s.seatId, s]))
    return new Map(
      Object.entries(plan.assignments).flatMap(([seatId, studentId]) => {
        const seat = seats.get(seatId)
        return seat ? [[studentId, seat] as const] : []
      }),
    )
  }, [plan.assignments, room])
  const problemCount = analysis.alerts.filter((a) => a.level !== 'info').length

  const startDrag = (e: PointerEvent, studentId: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    setDrag({ studentId, x: e.clientX, y: e.clientY })
  }

  const dragging = drag !== undefined
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: globalThis.PointerEvent) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY })
    const onUp = (e: globalThis.PointerEvent) => {
      setDrag((d) => {
        if (!d) return d
        const target = document.elementFromPoint(e.clientX, e.clientY)
        const seatId = target?.closest('[data-seat-id]')?.getAttribute('data-seat-id')
        if (seatId) assignSeat(plan.id, d.studentId, seatId)
        else if (target?.closest('[data-zone="unplaced"]')) assignSeat(plan.id, d.studentId, null)
        return undefined
      })
    }
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setDrag(undefined)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dragging, assignSeat, plan.id])

  const photoUrl = (s: Student) => (s.photoId ? photoUrls[s.photoId] : undefined)
  const draggedStudent = drag && studentsById.get(drag.studentId)

  return (
    <div className={`editor ${collapsed ? 'side-collapsed' : ''}`}>
      <aside className="tools no-print">
        <button
          className="side-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Afficher le menu' : 'Masquer le menu'}
          title={collapsed ? 'Afficher le menu' : 'Masquer le menu'}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '▶' : '◀ Masquer le menu'}
        </button>
        {!collapsed && (
          <>
            <nav className="side-tabs">
              <button className={tab === 'place' ? 'active' : ''} onClick={() => setTab('place')}>
                Placer
              </button>
              <button className={tab === 'rules' ? 'active' : ''} onClick={() => setTab('rules')}>
                Règles {problemCount > 0 && <span className="badge">{problemCount}</span>}
              </button>
              <button className={tab === 'tracking' ? 'active' : ''} onClick={() => setTab('tracking')}>
                Suivi
              </button>
            </nav>

            {problemCount > 0 && tab !== 'rules' && (
              <button className="alert-banner" onClick={() => setTab('rules')}>
                ⚠ {problemCount} alerte{problemCount > 1 ? 's' : ''} — voir
              </button>
            )}

            {tab === 'place' && (
              <>
                <div data-zone="unplaced" className={`unplaced ${drag ? 'drop-target' : ''}`}>
                  <h3>
                    À placer <small>{unplaced.length}</small>
                  </h3>
                  {unplaced.length === 0 && <p className="hint">Tout le monde est placé 🎉</p>}
                  <ul>
                    {unplaced.map((s) => (
                      <li key={s.id} className="student-chip" onPointerDown={(e) => startDrag(e, s.id)}>
                        <Avatar student={s} url={photoUrl(s)} />
                        <span>{fullName(s)}</span>
                        {isAesh(s) ? <em className="aesh-badge">AESH</em> : <span className={`dot light-${s.light}`} />}
                      </li>
                    ))}
                  </ul>
                </div>
                <h3>Actions</h3>
                <select
                  aria-label="Façon de placer au hasard"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as FillStrategy)}
                >
                  {(Object.keys(FILL_STRATEGY_LABELS) as FillStrategy[]).map((key) => (
                    <option key={key} value={key}>
                      {FILL_STRATEGY_LABELS[key]}
                    </option>
                  ))}
                </select>
                <button onClick={() => fillPlan(plan.id, strategy)} disabled={unplaced.length === 0}>
                  🎲 Placer au hasard les restants
                </button>
                <button onClick={() => confirm('Retirer tout le monde de sa place ?') && clearPlan(plan.id)}>
                  Tout vider
                </button>
                <button
                  onClick={() => {
                    selectRoom(room.id)
                    setView('rooms')
                  }}
                >
                  Modifier la salle…
                </button>
                {otherRooms.length > 0 && (
                  <div className="row">
                    <select
                      aria-label="Autre salle"
                      value={otherRoomId}
                      onChange={(e) => setOtherRoomId(e.target.value)}
                    >
                      <option value="">Appliquer à la salle…</option>
                      {otherRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button disabled={!otherRoomId} onClick={() => applyPlanToRoom(plan.id, otherRoomId)}>
                      Appliquer
                    </button>
                  </div>
                )}
                <h3>Ce qui apparaît à l'impression</h3>
                <div className="row">
                  <button onClick={() => setOptions(NEUTRAL_OPTIONS)}>Version neutre</button>
                  <button onClick={() => setOptions(FULL_OPTIONS)}>Tout afficher</button>
                </div>
                {(Object.keys(PRINT_OPTION_LABELS) as (keyof PrintOptions)[]).map((key) => (
                  <label key={key} className="check">
                    <input
                      type="checkbox"
                      checked={options[key]}
                      onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                    />{' '}
                    {PRINT_OPTION_LABELS[key]}
                  </label>
                ))}
                <label className="check">
                  <input type="checkbox" checked={previewMode} onChange={(e) => setPreviewMode(e.target.checked)} />{' '}
                  Aperçu à l'écran
                </label>
                <label className="check">
                  <input type="checkbox" checked={flipped} onChange={(e) => setFlipped(e.target.checked)} /> Vue
                  retournée (180°)
                </label>
                <button className="primary" onClick={() => window.print()}>
                  🖨 Imprimer / PDF
                </button>
                <p className="hint">
                  Glissez les personnes sur les places. Déposer sur une place occupée échange les deux.
                </p>
              </>
            )}

            {tab === 'rules' && <RulesPanel plan={plan} schoolClass={schoolClass} alerts={analysis.alerts} />}
            {tab === 'tracking' && <TrackingPanel plan={plan} />}
          </>
        )}
      </aside>

      <div className={canvasClassName(options, flipped, previewMode)}>
        <h2 className="print-title">{plan.name}</h2>
        <RoomSvg room={room}>
          {room.furniture.flatMap((furniture) =>
            furniture.seats.map((seat) => {
              const center = seatCenter(furniture, seat)
              const studentId = plan.assignments[seat.id]
              const student = studentId ? studentsById.get(studentId) : undefined
              const aesh = student ? isAesh(student) : false
              const light = student && !aesh ? (analysis.effectiveLight[student.id] ?? student.light) : undefined
              const worsened = student && light && light !== student.light
              return (
                <g
                  key={seat.id}
                  data-seat-id={seat.id}
                  transform={`translate(${center.x - CARD.w / 2} ${center.y - CARD.h / 2})`}
                >
                  <g className="upright">
                    {!student && <rect className="slot" width={CARD.w} height={CARD.h} rx={8} />}
                    {student && (
                      <StudentCard
                        student={student}
                        photoUrl={photoUrl(student)}
                        ringColor={aesh ? AESH_COLOR : LIGHT_COLORS[light!]}
                        light={light}
                        worsened={Boolean(worsened)}
                        isDragged={drag?.studentId === student.id}
                        onPointerDown={(e) => startDrag(e, student.id)}
                      />
                    )}
                  </g>
                </g>
              )
            }),
          )}
          <g className="links" pointerEvents="none">
            {analysis.links.map((link, i) => {
              const [a, b] = [centers.get(link.a), centers.get(link.b)]
              if (!a || !b) return null
              const isAeshLink = link.type === 'aesh'
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isAeshLink ? LEVEL_COLORS.info : LEVEL_COLORS[link.level]}
                  strokeWidth={isAeshLink ? 3 : 5}
                  strokeDasharray={isAeshLink ? '2 7' : '10 6'}
                  strokeLinecap="round"
                />
              )
            })}
          </g>
        </RoomSvg>
        <Legend />
      </div>

      {drag && draggedStudent && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <Avatar student={draggedStudent} url={photoUrl(draggedStudent)} />
          <span>{draggedStudent.firstName}</span>
        </div>
      )}
    </div>
  )
}

type StudentCardProps = {
  student: Student
  photoUrl?: string
  ringColor: string
  light?: TrafficLight
  worsened: boolean
  isDragged: boolean
  onPointerDown(e: PointerEvent): void
}

/** The card drawn on an occupied seat. The `opt-*` classes mark what the print options can hide. */
function StudentCard({ student, photoUrl, ringColor, light, worsened, isDragged, onPointerDown }: StudentCardProps) {
  const aesh = isAesh(student)
  return (
    <g className={`card-svg ${isDragged ? 'ghost' : ''}`} onPointerDown={onPointerDown}>
      <rect className="card-bg" width={CARD.w} height={CARD.h} rx={10} />
      <title>
        {[
          fullName(student),
          student.delegate && 'délégué',
          student.gender && GENDER_LABELS[student.gender],
          ...student.annotations,
        ]
          .filter(Boolean)
          .join(' · ')}
      </title>
      {photoUrl ? (
        <image
          className="opt-photo"
          href={photoUrl}
          x={PHOTO.cx - PHOTO.r}
          y={PHOTO.cy - PHOTO.r}
          width={PHOTO.r * 2}
          height={PHOTO.r * 2}
          clipPath="url(#photo-clip)"
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <svg
          className="opt-photo"
          x={PHOTO.cx - PHOTO.r}
          y={PHOTO.cy - PHOTO.r}
          width={PHOTO.r * 2}
          height={PHOTO.r * 2}
          viewBox="0 0 100 100"
        >
          <NeutralAvatarShapes />
        </svg>
      )}
      <circle
        className="opt-colors"
        cx={PHOTO.cx}
        cy={PHOTO.cy}
        r={PHOTO.r + 1.5}
        fill="none"
        strokeWidth={4}
        stroke={ringColor}
      />
      {!aesh && light && (
        <g className="opt-colors">
          <circle
            cx={11}
            cy={11}
            r={6}
            fill={LIGHT_COLORS[light]}
            stroke={worsened ? '#1f2933' : '#fff'}
            strokeWidth={worsened ? 2 : 1}
          />
          {worsened && (
            <text x={20} y={14} className="badge-svg">
              ▲
            </text>
          )}
        </g>
      )}
      {student.delegate && (
        <g
          className="opt-delegate"
          transform={`translate(${PHOTO.cx + PHOTO.r - 20} ${PHOTO.cy + PHOTO.r - 16}) scale(1.4)`}
        >
          <title>Délégué</title>
          <CrownShape />
        </g>
      )}
      {aesh && (
        <text className="opt-annotations badge-svg" x={4} y={13}>
          AESH
        </text>
      )}
      {student.gender && (
        <text className="opt-gender gender-svg" x={CARD.w - 4} y={13}>
          {student.gender === 'girl' ? 'F' : 'G'}
        </text>
      )}
      {student.annotations.slice(0, 4).map((label, i) => (
        <text
          key={label}
          className="opt-annotations annotation-svg"
          x={CARD.w - 4}
          y={student.gender ? 24 + i * 10 : 13 + i * 10}
        >
          {label}
        </text>
      ))}
      <g className="names-group">
        <text className="opt-first-name first-name" x={CARD.w / 2} y={79}>
          {truncate(student.firstName, 12)}
        </text>
        <text className="opt-last-name last-name" x={CARD.w / 2} y={90}>
          {truncate(student.lastName, 14)}
        </text>
      </g>
    </g>
  )
}

function Legend() {
  return (
    <p className="legend">
      {TRAFFIC_LIGHTS.map((light) => (
        <span key={light} className="opt-colors">
          <i className={`dot light-${light}`} /> {TRAFFIC_LIGHT_LABELS[light]}
        </span>
      ))}
      <span className="opt-colors">
        <i className="dot aesh" /> AESH
      </span>
    </p>
  )
}

function Avatar({ student, url }: { student: Student; url?: string }) {
  return url ? (
    <img className="avatar" src={url} alt="" />
  ) : (
    <span className="avatar empty">{student.firstName.slice(0, 1)}</span>
  )
}
