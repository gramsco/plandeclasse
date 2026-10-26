import { useRegisterSW } from 'virtual:pwa-register/react'

/** Informe de la disponibilité hors ligne et propose les mises à jour (jamais appliquées d'office). */
export function PwaBanner() {
  const {
    needRefresh: [maj, setMaj],
    offlineReady: [horsLigne, setHorsLigne],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Vérifie une nouvelle version toutes les heures si l'application reste ouverte.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000)
    },
  })
  if (!maj && !horsLigne) return null
  return (
    <div className="pwa-banner no-print" role="status">
      {maj ? (
        <>
          <span>Une nouvelle version est disponible. Vos données sont conservées.</span>
          <button className="primaire" onClick={() => void updateServiceWorker(true)}>Mettre à jour</button>
          <button onClick={() => setMaj(false)}>Plus tard</button>
        </>
      ) : (
        <>
          <span>L'application fonctionne maintenant hors ligne.</span>
          <button onClick={() => setHorsLigne(false)}>OK</button>
        </>
      )}
    </div>
  )
}
