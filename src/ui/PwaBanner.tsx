import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Coming back to the window checks again, but not more often than this. */
const MIN_CHECK_GAP_MS = 60 * 1000

/** Tells the user the app works offline and offers updates (never applied automatically). */
export function PwaBanner() {
  const {
    needRefresh: [updateAvailable, setUpdateAvailable],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // The browser only looks for a new version when the app is opened (or once a day): for an
      // installed app that stays open, look every hour and whenever the user comes back to the window.
      let lastCheck = Date.now()
      const check = () => {
        lastCheck = Date.now()
        void registration.update().catch(() => undefined) // offline: try again later
      }
      setInterval(check, UPDATE_CHECK_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck > MIN_CHECK_GAP_MS) check()
      })
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
