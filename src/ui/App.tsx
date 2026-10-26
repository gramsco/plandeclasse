import { useEffect, useState } from 'react'
import { requestPersistence } from '../storage/indexeddb'
import { useApp, type View } from '../store'
import { AskHost } from './ask'
import { ClassesView } from './ClassesView'
import { getLastExport, FileMenu } from './FileMenu'
import { HelpView } from './HelpView'
import { PlansView } from './PlansView'
import { PwaBanner } from './PwaBanner'
import { ReleaseNotesDialog } from './ReleaseNotesDialog'
import { RoomsView } from './RoomsView'

const TABS: { view: View; label: string }[] = [
  { view: 'plans', label: 'Plans' },
  { view: 'classes', label: 'Classes (élèves)' },
  { view: 'rooms', label: 'Salles' },
  { view: 'help', label: 'Aide' },
]

const REPOSITORY_URL = 'https://github.com/gramsco/plandeclasse'

export function App() {
  const { ready, init, classes, view, setView, versionError } = useApp()
  const [usage, setUsage] = useState<string>()
  const [now, setNow] = useState(() => Date.now())
  const [notesOpen, setNotesOpen] = useState(false)

  useEffect(() => {
    void init()
    void requestPersistence()
  }, [init])

  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => {
      if (estimate.usage !== undefined) setUsage(`${(estimate.usage / 1024 / 1024).toFixed(1)} Mo utilisés · `)
    })
    // Re-measured whenever the data changes.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [classes])

  if (!ready) return <p className="loading">Chargement…</p>
  if (versionError)
    return (
      <div className="blocked">
        <h2>Version de l'application trop ancienne</h2>
        <p>{versionError}</p>
        <button className="primary" onClick={() => location.reload()}>
          Recharger
        </button>
        <PwaBanner />
      </div>
    )

  return (
    <div className="app">
      <header className="app-bar no-print">
        <h1>Plan de classe</h1>
        <nav className="tabs">
          {TABS.map((tab) => (
            <button key={tab.view} className={view === tab.view ? 'active' : ''} onClick={() => setView(tab.view)}>
              {tab.label}
            </button>
          ))}
        </nav>
        <FileMenu onExported={() => setNow(Date.now())} />
      </header>
      <PwaBanner />
      {view === 'plans' && <PlansView />}
      {view === 'classes' && <ClassesView />}
      {view === 'rooms' && <RoomsView />}
      {view === 'help' && <HelpView />}
      <footer className="no-print">
        <p>
          {usage}Données stockées uniquement sur cet ordinateur (
          <button className="link-button" onClick={() => setView('help')}>
            en savoir plus
          </button>
          ) · <BackupStatus isEmpty={!classes.length} now={now} /> ·{' '}
          <button className="link-button" title="Voir les notes de version" onClick={() => setNotesOpen(true)}>
            v{__APP_VERSION__}
          </button>
        </p>
        <a
          className="github-link"
          href={REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Code source sur GitHub"
          title="Code source sur GitHub"
        >
          <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </footer>
      <AskHost />
      {notesOpen && <ReleaseNotesDialog onClose={() => setNotesOpen(false)} />}
    </div>
  )
}

/** Reminds the user to export: the export file is the only real backup. */
function BackupStatus({ isEmpty, now }: { isEmpty: boolean; now: number }) {
  const lastExport = getLastExport()
  if (!lastExport)
    return (
      <span className={isEmpty ? '' : 'backup-warning'}>
        {isEmpty ? 'aucune sauvegarde' : 'jamais exporté : pensez à exporter'}
      </span>
    )
  const days = Math.floor((now - new Date(lastExport).getTime()) / 86_400_000)
  return (
    <span className={days > 14 ? 'backup-warning' : ''}>
      dernier export : {days === 0 ? "aujourd'hui" : `il y a ${days} j`}
    </span>
  )
}
