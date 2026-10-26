import { useState } from 'react'
import { fullName, type Student } from '../model/types'
import { matchesSearch } from '../model/search'
import { useApp } from '../store'
import { askConfirm, askText } from './ask'
import { NewClassDialog } from './dialogs'
import { ListNav } from './ListNav'
import { StudentsPanel } from './StudentsPanel'

export function ClassesView() {
  const { classes, currentClassId, selectClass, renameClass, reorderClasses, duplicateClass, deleteClass, plans } =
    useApp()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState('')
  const schoolClass = classes.find((c) => c.id === currentClassId)
  const planCount = plans.filter((p) => p.classId === currentClassId).length
  const searching = query.trim() !== ''
  const matchCount = (students: Student[]) => students.filter((s) => matchesSearch(fullName(s), query)).length

  return (
    <>
      <div className="toolbar">
        <button onClick={() => setDialogOpen(true)}>+ Nouvelle classe</button>
        {schoolClass && (
          <>
            <button
              onClick={async () => {
                const name = await askText('Renommer la classe', 'Nouveau nom', schoolClass.name)
                if (name) renameClass(schoolClass.id, name)
              }}
            >
              Renommer
            </button>
            <button onClick={() => void duplicateClass(schoolClass.id)}>Dupliquer</button>
            <button
              className="danger"
              onClick={async () => {
                const confirmed = await askConfirm(`Supprimer « ${schoolClass.name} » ?`, {
                  message: `Ses élèves, leurs photos et ${planCount} plan(s) seront supprimés.`,
                  confirmLabel: 'Supprimer',
                })
                if (confirmed) deleteClass(schoolClass.id)
              }}
            >
              Supprimer
            </button>
          </>
        )}
      </div>
      <div className="classes-layout">
        <ListNav
          label="Classes"
          currentId={currentClassId}
          onSelect={selectClass}
          onReorder={reorderClasses}
          header={
            <input
              type="search"
              aria-label="Chercher un élève"
              placeholder="Chercher un élève…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          }
          items={classes.map((c) => {
            const count = searching ? matchCount(c.students) : 0
            return {
              id: c.id,
              label: c.name,
              detail: searching ? `${count} trouvé${count > 1 ? 's' : ''}` : String(c.students.length),
              muted: searching && count === 0,
            }
          })}
        />
        <main>
          {schoolClass ? (
            <StudentsPanel schoolClass={schoolClass} query={query} />
          ) : (
            <p className="empty">Aucune classe. Créez-en une pour saisir vos élèves.</p>
          )}
        </main>
      </div>
      {dialogOpen && <NewClassDialog onClose={() => setDialogOpen(false)} />}
    </>
  )
}
