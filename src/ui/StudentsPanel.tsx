import { useRef, useState, type DragEvent } from 'react'
import {
  COMMON_ANNOTATIONS,
  fullName,
  GENDER_LABELS,
  isAesh,
  parseStudentList,
  TRAFFIC_LIGHT_LABELS,
  type SchoolClass,
  type Student,
} from '../model/types'
import { addFakePhotos, generateAvatar } from '../storage/avatar'
import { matchesSearch } from '../model/search'
import { resizePhoto } from '../storage/photo'
import { useApp } from '../store'
import { askConfirm } from './ask'
import { Crown, ICON } from './icons'
import { AnnotationEditor } from './AnnotationEditor'
import { StudentsTable } from './StudentsTable'
import { GenderPicker } from './GenderPicker'
import { Modal } from './Modal'
import { NeutralAvatar } from './NeutralAvatar'
import { TrafficLightPicker } from './TrafficLightPicker'

const VIEW_MODE_KEY = 'studentsViewMode'

const genderSummary = (students: Student[]) => {
  const girls = students.filter((s) => s.gender === 'girl').length
  const boys = students.filter((s) => s.gender === 'boy').length
  return girls + boys > 0 ? ` (${girls} filles, ${boys} garçons)` : ''
}

export function StudentsPanel({ schoolClass, query = '' }: { schoolClass: SchoolClass; query?: string }) {
  const { addStudent, addAesh, addStudents, shuffleLights } = useApp()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [mode, setMode] = useState<'cards' | 'table'>(() =>
    localStorage.getItem(VIEW_MODE_KEY) === 'table' ? 'table' : 'cards',
  )
  const chooseMode = (next: 'cards' | 'table') => {
    setMode(next)
    localStorage.setItem(VIEW_MODE_KEY, next)
  }
  const students = schoolClass.students.filter((s) => !isAesh(s))
  const aesh = schoolClass.students.filter(isAesh)
  const shownStudents = students.filter((s) => matchesSearch(fullName(s), query))
  const shownAesh = aesh.filter((s) => matchesSearch(fullName(s), query))

  // An AESH is often added before anyone knows their name: it gets a default one to rename later.
  const submit = (add: (firstName: string, lastName: string) => void, fallbackName?: string) => {
    const first = firstName.trim() || fallbackName
    if (!first) return
    add(first, lastName.trim())
    setFirstName('')
    setLastName('')
  }

  return (
    <section className="students">
      <h2>
        {schoolClass.name}{' '}
        <small>
          {students.length} élèves
          {genderSummary(students)}
          {aesh.length > 0 && ` · ${aesh.length} AESH`}
        </small>
      </h2>
      <form
        className="add-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit(addStudent)
        }}
      >
        <input placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <button type="submit">Ajouter un élève</button>
        <button
          type="button"
          onClick={() => submit(addAesh, 'AESH')}
          title="Ajoute une personne qui accompagne un ou plusieurs élèves"
        >
          Ajouter un AESH
        </button>
        <button type="button" onClick={() => setBulkOpen(!bulkOpen)}>
          Coller une liste
        </button>
      </form>
      <details className="test-tools">
        <summary>Outils de test</summary>
        <div className="row">
          <button
            type="button"
            onClick={async () => {
              const confirmed = await askConfirm('Remplacer les feux de tous les élèves ?', {
                message: 'Ils seront remplacés par une répartition aléatoire.',
                confirmLabel: 'Remplacer',
              })
              if (confirmed) shuffleLights()
            }}
            title="1-2 rouges, 5-6 oranges, le reste vert (pour tester)"
          >
            Feux aléatoires
          </button>
          <button
            type="button"
            onClick={() => void addFakePhotos(schoolClass.id)}
            title="Dessine un visage pour chaque personne sans photo (pour tester)"
          >
            Photos fictives
          </button>
        </div>
      </details>
      {bulkOpen && (
        <div className="bulk">
          <textarea
            rows={6}
            placeholder={'Une ligne par élève\nPrénom Nom  ou  Nom, Prénom'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <button
            onClick={() => {
              addStudents(parseStudentList(bulkText))
              setBulkText('')
              setBulkOpen(false)
            }}
          >
            Importer
          </button>
        </div>
      )}
      <div className="view-switch" role="group" aria-label="Affichage">
        <button
          aria-pressed={mode === 'cards'}
          className={mode === 'cards' ? 'active' : ''}
          onClick={() => chooseMode('cards')}
        >
          Fiches
        </button>
        <button
          aria-pressed={mode === 'table'}
          className={mode === 'table' ? 'active' : ''}
          onClick={() => chooseMode('table')}
        >
          Tableau
        </button>
      </div>
      {mode === 'table' && shownStudents.length + shownAesh.length > 0 && (
        <StudentsTable students={[...shownStudents, ...shownAesh]} />
      )}
      <ul className="student-grid">
        {mode === 'cards' && shownStudents.map((s) => <StudentCard key={s.id} student={s} schoolClass={schoolClass} />)}
      </ul>
      {query.trim() && shownStudents.length + shownAesh.length === 0 && (
        <p className="empty">Personne ne correspond à « {query.trim()} » dans cette classe.</p>
      )}
      {mode === 'cards' && (shownAesh.length > 0 || !query.trim()) && (
        <>
          <h3>AESH de la classe</h3>
          {shownAesh.length === 0 && <p className="hint">Aucun AESH. Utilisez « Ajouter un AESH » ci-dessus.</p>}
          <ul className="student-grid">
            {shownAesh.map((s) => (
              <StudentCard key={s.id} student={s} schoolClass={schoolClass} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function StudentCard({ student, schoolClass }: { student: Student; schoolClass: SchoolClass }) {
  const {
    photoUrls,
    updateStudent,
    deleteStudent,
    setPhoto,
    removePhoto,
    setLight,
    setGender,
    setDelegate,
    setDeputy,
    setSupports,
  } = useApp()
  const [open, setOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const photoUrl = student.photoId ? photoUrls[student.photoId] : undefined
  const aesh = isAesh(student)

  const receivePhoto = async (file?: File) => {
    if (!file?.type.startsWith('image/')) return
    await setPhoto(student.id, await resizePhoto(file))
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    void receivePhoto(e.dataTransfer.files[0])
  }
  const supported = student.supports
    .map((id) => schoolClass.students.find((s) => s.id === id))
    .filter((s): s is Student => Boolean(s))

  return (
    <li className={`card ${aesh ? 'card-aesh' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <button
        type="button"
        className="card-head"
        aria-label={`Modifier ${fullName(student) || 'cette fiche'}`}
        onClick={() => setOpen(true)}
      >
        <span className="mini-avatar">{photoUrl ? <img src={photoUrl} alt="" /> : <NeutralAvatar />}</span>
        <span className="card-summary">
          <strong>{fullName(student) || 'Sans nom'}</strong>
          <span className="tags">
            {aesh && <span className="tag tag-aesh">AESH</span>}
            {student.delegate && (
              <span className="tag tag-gold">
                <Crown size={12} /> Délégué
              </span>
            )}
            {student.deputy && (
              <span className="tag tag-silver">
                <Crown size={12} /> Suppléant
              </span>
            )}
            {student.gender && <span className="tag">{GENDER_LABELS[student.gender]}</span>}
            {!aesh && (
              <span className="tag">
                <i className={`dot light-${student.light}`} /> {TRAFFIC_LIGHT_LABELS[student.light]}
              </span>
            )}
            {student.note && <span className="tag">Note</span>}
            {student.annotations.map((label) => (
              <span key={label} className="tag tag-note" title={COMMON_ANNOTATIONS[label] ?? label}>
                {label}
              </span>
            ))}
          </span>
        </span>
      </button>
      {!open && student.note && (
        <div className="card-popover" role="tooltip">
          {student.note}
        </div>
      )}
      {open && (
        <Modal title={fullName(student) || 'Fiche'} wide onClose={() => setOpen(false)}>
          <div className="card-body student-edit">
            <button
              className="photo"
              title="Choisir une photo (ou glisser un fichier)"
              onClick={() => fileInput.current?.click()}
            >
              {photoUrl ? <img src={photoUrl} alt="" /> : <NeutralAvatar />}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void receivePhoto(e.target.files?.[0])}
            />
            <input
              aria-label="Prénom"
              value={student.firstName}
              onChange={(e) => updateStudent(student.id, { firstName: e.target.value })}
            />
            <input
              aria-label="Nom"
              value={student.lastName}
              onChange={(e) => updateStudent(student.id, { lastName: e.target.value })}
            />
            {aesh ? (
              <details className="supports">
                <summary>
                  {supported.length
                    ? `Accompagne : ${supported.map((s) => s.firstName).join(', ')}`
                    : 'Choisir les élèves accompagnés'}
                </summary>
                <div className="checklist">
                  {schoolClass.students
                    .filter((s) => !isAesh(s))
                    .map((s) => (
                      <label key={s.id} className="check">
                        <input
                          type="checkbox"
                          checked={student.supports.includes(s.id)}
                          onChange={(e) =>
                            setSupports(
                              student.id,
                              e.target.checked
                                ? [...student.supports, s.id]
                                : student.supports.filter((id) => id !== s.id),
                            )
                          }
                        />
                        {fullName(s)}
                      </label>
                    ))}
                </div>
              </details>
            ) : (
              <>
                <GenderPicker value={student.gender} onChange={(gender) => setGender(student.id, gender)} />
                <button
                  role="switch"
                  aria-checked={student.delegate}
                  className={`delegate-toggle ${student.delegate ? 'active' : ''}`}
                  title="Délégué de la classe"
                  onClick={() => setDelegate(student.id, !student.delegate)}
                >
                  <Crown size={ICON} /> Délégué
                </button>
                <button
                  role="switch"
                  aria-checked={student.deputy}
                  className={`delegate-toggle deputy ${student.deputy ? 'active' : ''}`}
                  title="Suppléant du délégué de la classe"
                  onClick={() => setDeputy(student.id, !student.deputy)}
                >
                  Suppléant
                </button>
                <TrafficLightPicker value={student.light} onChange={(light) => setLight(student.id, light)} />
              </>
            )}
            {!aesh && <AnnotationEditor student={student} />}
            <label className="note-field">
              Note (visible ici seulement, jamais sur le plan)
              <textarea
                rows={3}
                value={student.note}
                onChange={(e) => updateStudent(student.id, { note: e.target.value })}
              />
            </label>
            <div className="actions">
              <button
                title="Dessine un visage au hasard à la place de la photo"
                onClick={async () => {
                  if (
                    photoUrl &&
                    !(await askConfirm('Remplacer la photo ?', {
                      message: 'La photo actuelle sera remplacée par un avatar au hasard.',
                      confirmLabel: 'Remplacer',
                    }))
                  )
                    return
                  await setPhoto(
                    student.id,
                    await generateAvatar(Math.floor(Math.random() * 1_000_000), student.gender),
                  )
                }}
              >
                Avatar au hasard
              </button>
              {photoUrl && <button onClick={() => removePhoto(student.id)}>Retirer la photo</button>}
              <button className="danger" onClick={() => deleteStudent(student.id)}>
                Supprimer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </li>
  )
}
