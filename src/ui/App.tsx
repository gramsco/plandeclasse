import { useEffect, useState } from 'react'
import { demanderPersistance } from '../storage/indexeddb'
import { useApp, type Vue } from '../store'
import { AideView } from './AideView'
import { ClassesView } from './ClassesView'
import { derniereSauvegarde, FichierMenu } from './FichierMenu'
import { PlansView } from './PlansView'
import { PwaBanner } from './PwaBanner'
import { SallesView } from './SallesView'

const ONGLETS: { vue: Vue; label: string }[] = [
  { vue: 'plans', label: 'Plans' },
  { vue: 'classes', label: 'Classes (élèves)' },
  { vue: 'salles', label: 'Salles' },
  { vue: 'aide', label: 'Aide' },
]

export function App() {
  const { pret, init, classes, vue, setVue, erreurVersion } = useApp()
  const [usage, setUsage] = useState<string>()
  const [, rafraichir] = useState(0)

  useEffect(() => {
    void init()
    void demanderPersistance()
  }, [init])

  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} Mo utilisés · `)
    })
  }, [classes])

  if (!pret) return <p className="chargement">Chargement…</p>
  if (erreurVersion)
    return (
      <div className="bloque">
        <h2>Version de l'application trop ancienne</h2>
        <p>{erreurVersion}</p>
        <button className="primaire" onClick={() => location.reload()}>Recharger</button>
        <PwaBanner />
      </div>
    )

  return (
    <div className="app">
      <header className="bar no-print">
        <h1>Plan de classe</h1>
        <nav className="onglets">
          {ONGLETS.map((o) => (
            <button key={o.vue} className={vue === o.vue ? 'actif' : ''} onClick={() => setVue(o.vue)}>{o.label}</button>
          ))}
        </nav>
        <FichierMenu onChange={() => rafraichir((n) => n + 1)} />
      </header>
      <PwaBanner />
      {vue === 'plans' && <PlansView />}
      {vue === 'classes' && <ClassesView />}
      {vue === 'salles' && <SallesView />}
      {vue === 'aide' && <AideView />}
      <footer className="no-print">
        <p>
        {usage}Données stockées uniquement sur cet ordinateur (<button className="lien" onClick={() => setVue('aide')}>en savoir plus</button>) ·{' '}
        <Sauvegarde vide={!classes.length} /> · v{__APP_VERSION__}
        </p>
        <a className="lien-github" href="https://github.com/gramsco/plandeclasse" target="_blank" rel="noopener noreferrer" aria-label="Code source sur GitHub" title="Code source sur GitHub">
          <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </footer>
    </div>
  )
}

function Sauvegarde({ vide }: { vide: boolean }) {
  const d = derniereSauvegarde()
  if (!d) return <span className={vide ? '' : 'alerte-sauvegarde'}>{vide ? 'aucune sauvegarde' : 'jamais exporté : pensez à ⬇ Exporter'}</span>
  const jours = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  return <span className={jours > 14 ? 'alerte-sauvegarde' : ''}>dernier export : {jours === 0 ? "aujourd'hui" : `il y a ${jours} j`}</span>
}
