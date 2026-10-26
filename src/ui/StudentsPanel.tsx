import { useRef, useState, type DragEvent } from 'react'
import { COMMON_ANNOTATIONS, fullName, isAesh, parseStudentList, type SchoolClass, type Student } from '../model/types'
import { addFakePhotos, generateAvatar } from '../storage/avatar'
import { matchesSearch } from '../model/search'
import { resizePhoto } from '../storage/photo'
import { useApp } from '../store'
import { NeutralAvatar } from './NeutralAvatar'
import { TrafficLightPicker } from './TrafficLightPicker'

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
  const students = schoolClass.students.filter((s) => !isAesh(s))
  const aesh = schoolClass.students.filter(isAesh)
  const shownStudents = students.filter((s) => matchesSearch(fullName(s), query))
  const shownAesh = aesh.filter((s) => matchesSearch(fullName(s), query))

  const submit = (add: (firstName: string, lastName: string) => void) => {
    if (!firstName.trim()) return
    add(firstName.trim(), lastName.trim())
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
          onClick={() => submit(addAesh)}
          title="Ajoute une personne qui accompagne un ou plusieurs élèves"
        >
          Ajouter un AESH
        </button>
        <button type="button" onClick={() => setBulkOpen(!bulkOpen)}>
          Coller une liste
        </button>
        <button
          type="button"
          onClick={() =>
            confirm('Remplacer les feux de tous les élèves par une répartition aléatoire ?') && shuffleLights()
          }
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
      </form>
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
      <ul className="student-grid">
        {shownStudents.map((s) => (
          <StudentCard key={s.id} student={s} schoolClass={schoolClass} />
        ))}
      </ul>
      {query.trim() && shownStudents.length + shownAesh.length === 0 && (
        <p className="empty">Personne ne correspond à « {query.trim()} » dans cette classe.</p>
      )}
      {shownAesh.length > 0 && (
        <>
          <h3>AESH</h3>
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
    toggleAnnotation,
  } = useApp()
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
                        e.target.checked ? [...student.supports, s.id] : student.supports.filter((id) => id !== s.id),
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
          <div className="gender-picker" role="radiogroup" aria-label="Genre">
            {(['girl', 'boy'] as const).map((gender) => (
              <button
                key={gender}
                role="radio"
                aria-checked={student.gender === gender}
                className={student.gender === gender ? 'active' : ''}
                onClick={() => setGender(student.id, student.gender === gender ? undefined : gender)}
              >
                {gender === 'girl' ? 'Fille' : 'Garçon'}
              </button>
            ))}
          </div>
          <button
            role="switch"
            aria-checked={student.delegate}
            className={`delegate-toggle ${student.delegate ? 'active' : ''}`}
            title="Délégué de la classe"
            onClick={() => setDelegate(student.id, !student.delegate)}
          >
            👑 Délégué
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
      {!aesh && (
        <div className="annotations">
          {student.annotations.map((label) => (
            <button
              key={label}
              className="annotation-chip"
              title={`${COMMON_ANNOTATIONS[label] ?? label} — cliquer pour retirer`}
              onClick={() => toggleAnnotation(student.id, label)}
            >
              {label} ✕
            </button>
          ))}
          <select
            aria-label="Ajouter une annotation"
            value=""
            onChange={(e) => {
              const label = e.target.value === '__other' ? prompt('Annotation ?')?.trim().toUpperCase() : e.target.value
              if (label && !student.annotations.includes(label)) toggleAnnotation(student.id, label)
            }}
          >
            <option value="">+ Annotation</option>
            {Object.entries(COMMON_ANNOTATIONS)
              .filter(([label]) => !student.annotations.includes(label))
              .map(([label, meaning]) => (
                <option key={label} value={label}>
                  {label} — {meaning}
                </option>
              ))}
            <option value="__other">Autre…</option>
          </select>
        </div>
      )}
      <div className="actions">
        <button
          title="Dessine un visage au hasard à la place de la photo"
          onClick={async () =>
            setPhoto(student.id, await generateAvatar(Math.floor(Math.random() * 1_000_000), student.gender))
          }
        >
          Avatar au hasard
        </button>
        {photoUrl && <button onClick={() => removePhoto(student.id)}>Retirer la photo</button>}
        <button className="danger" onClick={() => deleteStudent(student.id)}>
          Supprimer
        </button>
      </div>
    </li>
  )
}
