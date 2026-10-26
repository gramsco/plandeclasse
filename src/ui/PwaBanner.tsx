import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Tells the user the app works offline and offers updates (never applied automatically). */
export function PwaBanner() {
  const {
    needRefresh: [updateAvailable, setUpdateAvailable],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Look for a new version every hour if the application stays open.
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
  })
  if (!updateAvailable && !offlineReady) return null
  return (
    <div className="pwa-banner no-print" role="status">
      {updateAvailable ? (
        <>
          <span>Une nouvelle version est disponible. Vos données sont conservées.</span>
          <button className="primary" onClick={() => void updateServiceWorker(true)}>
            Mettre à jour
          </button>
          <button onClick={() => setUpdateAvailable(false)}>Plus tard</button>
        </>
      ) : (
        <>
          <span>L'application fonctionne maintenant hors ligne.</span>
          <button onClick={() => setOfflineReady(false)}>OK</button>
        </>
      )}
    </div>
  )
}
