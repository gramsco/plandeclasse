import { fullName, isAesh, type Student } from '../model/types'
import { useApp } from '../store'
import { TrafficLightPicker } from './TrafficLightPicker'
import { AnnotationEditor } from './AnnotationEditor'
import { GenderPicker } from './GenderPicker'
import { PhotoButton } from './PhotoButton'

/** One row per person, to change the same field of many students quickly. */
export function StudentsTable({ students }: { students: Student[] }) {
  const photoUrls = useApp((s) => s.photoUrls)
  const { updateStudent, setGender, setLight, setDelegate, setDeputy } = useApp()
  return (
    <div className="table-wrap">
      <table className="students-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Photo</span>
            </th>
            <th scope="col">Prénom</th>
            <th scope="col">Nom</th>
            <th scope="col">Genre</th>
            <th scope="col">Feu</th>
            <th scope="col">Délégué</th>
            <th scope="col">Suppléant</th>
            <th scope="col">Annotations</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const aesh = isAesh(student)
            const name = fullName(student) || 'sans nom'
            return (
              <tr key={student.id} className={aesh ? 'row-aesh' : undefined}>
                <td>
                  <PhotoButton student={student} url={student.photoId ? photoUrls[student.photoId] : undefined} />
                </td>
                <td>
                  <input
                    aria-label={`Prénom de ${name}`}
                    value={student.firstName}
                    onChange={(e) => updateStudent(student.id, { firstName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Nom de ${name}`}
                    value={student.lastName}
                    onChange={(e) => updateStudent(student.id, { lastName: e.target.value })}
                  />
                </td>
                {aesh ? (
                  <>
                    <td colSpan={4} className="muted-cell">
                      AESH
                    </td>
                    <td />
                  </>
                ) : (
                  <>
                    <td>
                      <GenderPicker value={student.gender} onChange={(gender) => setGender(student.id, gender)} />
                    </td>
                    <td>
                      <TrafficLightPicker value={student.light} onChange={(light) => setLight(student.id, light)} />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${name} est délégué`}
                        checked={student.delegate}
                        onChange={(e) => setDelegate(student.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${name} est suppléant`}
                        checked={student.deputy}
                        onChange={(e) => setDeputy(student.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <AnnotationEditor student={student} />
                    </td>
                  </>
                )}
                <td>
                  <input
                    aria-label={`Note de ${name}`}
                    value={student.note}
                    onChange={(e) => updateStudent(student.id, { note: e.target.value })}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
