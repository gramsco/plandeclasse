import { lazy } from 'react'

// Loaded on demand: three.js must never weigh on the normal app.
export const Scene3D = lazy(() => import('./Scene3D'))
