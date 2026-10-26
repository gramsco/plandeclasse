import { useState } from 'react'
import { useApp } from '../store'
import { NewClassDialog } from './dialogs'
import { StudentsPanel } from './StudentsPanel'

export function ClassesView() {
  const { classes, currentClassId, selectClass, renameClass, duplicateClass, deleteClass, plans } = useApp()
  const [dialogOpen, setDialogOpen] = useState(false)
  const schoolClass = classes.find((c) => c.id === currentClassId)
  const planCount = plans.filter((p) => p.classId === currentClassId).length

  return (
    <>
      <div className="toolbar">
        <select value={currentClassId ?? ''} onChange={(e) => selectClass(e.target.value)} disabled={!classes.length}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button onClick={() => setDialogOpen(true)}>+ Nouvelle classe</button>
        {schoolClass && (
          <>
            <button
              onClick={() => {
                const name = prompt('Nouveau nom ?', schoolClass.name)?.trim()
                if (name) renameClass(schoolClass.id, name)
              }}
            >
              Renommer
            </button>
            <button onClick={() => void duplicateClass(schoolClass.id)}>Dupliquer</button>
            <button
              className="danger"
              onClick={() =>
                confirm(`Supprimer « ${schoolClass.name} », ses photos et ${planCount} plan(s) ?`) &&
                deleteClass(schoolClass.id)
              }
            >
              Supprimer
            </button>
          </>
        )}
      </div>
      <main>
        {schoolClass ? (
          <StudentsPanel schoolClass={schoolClass} />
        ) : (
          <p className="empty">Aucune classe. Créez-en une pour saisir vos élèves.</p>
        )}
      </main>
      {dialogOpen && <NewClassDialog onClose={() => setDialogOpen(false)} />}
    </>
  )
}
