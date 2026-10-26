import { COMMON_ANNOTATIONS, type Student } from '../model/types'
import { useApp } from '../store'
import { askText } from './ask'
import { X } from './icons'

/** The annotations of a student (PAP, DYS…): click a chip to remove it, pick one in the list to add it. */
export function AnnotationEditor({ student }: { student: Student }) {
  const toggleAnnotation = useApp((s) => s.toggleAnnotation)
  return (
    <div className="annotations">
      {student.annotations.map((label) => (
        <button
          key={label}
          className="annotation-chip"
          title={`${COMMON_ANNOTATIONS[label] ?? label} — cliquer pour retirer`}
          onClick={() => toggleAnnotation(student.id, label)}
        >
          {label} <X size={12} />
        </button>
      ))}
      <select
        aria-label="Ajouter une annotation"
        value=""
        onChange={async (e) => {
          const label =
            e.target.value === '__other'
              ? (await askText('Nouvelle annotation', 'Annotation'))?.toUpperCase()
              : e.target.value
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
  )
}
