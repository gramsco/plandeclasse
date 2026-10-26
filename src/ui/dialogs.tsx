import { useMemo, useState } from 'react'
import { findRoomTemplate, ROOM_TEMPLATES } from '../model/rooms'
import { createDemoClass } from '../storage/avatar'
import { useApp } from '../store'
import { Modal } from './Modal'
import { RoomSvg } from './RoomSvg'

/** Preview of the general shape of a room template. */
function TemplatePreview({ templateKey }: { templateKey: string }) {
  const room = useMemo(() => findRoomTemplate(templateKey)?.create(), [templateKey])
  if (!room) return null
  const seatCount = room.furniture.reduce((n, f) => n + f.seats.length, 0)
  return (
    <figure className="preview">
      <RoomSvg room={room} />
      <figcaption>{seatCount} places</figcaption>
    </figure>
  )
}

function RoomPreview({ roomId }: { roomId: string }) {
  const room = useApp((s) => s.rooms.find((r) => r.id === roomId))
  if (!room) return null
  return (
    <figure className="preview">
      <RoomSvg room={room} />
    </figure>
  )
}

export function NewClassDialog({ onClose }: { onClose(): void }) {
  const { addClass } = useApp()
  const [name, setName] = useState('')
  const [studentCount, setStudentCount] = useState(24)
  return (
    <Modal title="Nouvelle classe" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          addClass(name.trim() || 'Nouvelle classe', studentCount)
          onClose()
        }}
      >
        <label>
          Nom
          <input autoFocus value={name} placeholder="6e A" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Nombre d'élèves à créer
          <input
            type="number"
            min={0}
            max={60}
            value={studentCount}
            onChange={(e) => setStudentCount(Number(e.target.value))}
          />
          <small>Des élèves « Élève 1… » à renommer (ou 0 pour coller votre liste ensuite).</small>
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="push-left"
            onClick={() => {
              void createDemoClass()
              onClose()
            }}
          >
            Classe fictive de test (28 élèves)
          </button>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary">Créer</button>
        </div>
      </form>
    </Modal>
  )
}

export function NewRoomDialog({ onClose }: { onClose(): void }) {
  const addRoom = useApp((s) => s.addRoom)
  const [templateKey, setTemplateKey] = useState(ROOM_TEMPLATES[0].key)
  return (
    <Modal title="Nouvelle salle" onClose={onClose} wide>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          addRoom(templateKey)
          onClose()
        }}
      >
        <div className="choices-preview">
          <div className="choices">
            {ROOM_TEMPLATES.map((template) => (
              <label key={template.key} className={templateKey === template.key ? 'active' : ''}>
                <input
                  type="radio"
                  name="template"
                  checked={templateKey === template.key}
                  onChange={() => setTemplateKey(template.key)}
                />
                <b>{template.label}</b>
                <small>{template.description}</small>
              </label>
            ))}
          </div>
          <TemplatePreview templateKey={templateKey} />
        </div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary">Créer</button>
        </div>
      </form>
    </Modal>
  )
}

/** A plan puts a class in a room. Both can be created on the fly. */
export function NewPlanDialog({ onClose }: { onClose(): void }) {
  const { classes, rooms, addClass, addRoom, createPlan } = useApp()
  const [classChoice, setClassChoice] = useState(classes[0]?.id ?? 'new')
  const [newClassName, setNewClassName] = useState('')
  const [studentCount, setStudentCount] = useState(24)
  const [roomChoice, setRoomChoice] = useState(rooms[0]?.id ?? `template:${ROOM_TEMPLATES[0].key}`)
  const [alreadyAdopted, setAlreadyAdopted] = useState(false)

  return (
    <Modal title="Nouveau plan de classe" onClose={onClose} wide>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          const classId =
            classChoice === 'new'
              ? addClass(newClassName.trim() || 'Nouvelle classe', studentCount)
              : classChoice === 'demo'
                ? await createDemoClass()
                : classChoice
          const roomId = roomChoice.startsWith('template:') ? addRoom(roomChoice.slice('template:'.length)) : roomChoice
          createPlan(classId, roomId, alreadyAdopted ? 'adopted' : 'draft')
          onClose()
        }}
      >
        <label>
          Classe (les élèves)
          <select value={classChoice} onChange={(e) => setClassChoice(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.students.length} élèves)
              </option>
            ))}
            <option value="new">+ Nouvelle classe…</option>
            <option value="demo">+ Classe fictive de test (28 élèves)</option>
          </select>
        </label>
        {classChoice === 'new' && (
          <div className="row">
            <input placeholder="Nom (6e A)" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
            <input
              type="number"
              min={0}
              max={60}
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              title="Nombre d'élèves"
            />
          </div>
        )}
        <label>
          Salle (le lieu)
          <select value={roomChoice} onChange={(e) => setRoomChoice(e.target.value)}>
            {rooms.length > 0 && (
              <optgroup label="Mes salles">
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Nouvelle salle depuis un modèle">
              {ROOM_TEMPLATES.map((template) => (
                <option key={template.key} value={`template:${template.key}`}>
                  {template.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {roomChoice.startsWith('template:') ? (
          <TemplatePreview templateKey={roomChoice.slice('template:'.length)} />
        ) : (
          <RoomPreview roomId={roomChoice} />
        )}
        <label className="check">
          <input type="checkbox" checked={alreadyAdopted} onChange={(e) => setAlreadyAdopted(e.target.checked)} /> Je
          suis déjà sûr de ce plan : le créer directement comme plan retenu
        </label>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="primary">Créer le plan</button>
        </div>
      </form>
    </Modal>
  )
}
