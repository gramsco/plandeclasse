import { useState } from 'react'
import { fullName, type Student } from '../model/types'
import { matchesSearch } from '../model/search'
import { useApp } from '../store'
import { NewClassDialog } from './dialogs'
import { StudentsPanel } from './StudentsPanel'

export function ClassesView() {
  const { classes, currentClassId, selectClass, renameClass, duplicateClass, deleteClass, plans } = useApp()
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
      <div className="classes-layout">
        <nav className="class-list" aria-label="Classes">
          <input
            type="search"
            aria-label="Chercher un élève"
            placeholder="Chercher un élève…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul>
            {classes.map((c) => {
              const count = searching ? matchCount(c.students) : 0
              return (
                <li key={c.id}>
                  <button
                    className={`${c.id === currentClassId ? 'active' : ''} ${searching && count === 0 ? 'no-match' : ''}`}
                    aria-current={c.id === currentClassId ? 'true' : undefined}
                    onClick={() => selectClass(c.id)}
                  >
                    <span>{c.name}</span>
                    <small>{searching ? `${count} trouvé${count > 1 ? 's' : ''}` : c.students.length}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
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
