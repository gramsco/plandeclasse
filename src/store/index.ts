import { indexedDbStorage } from '../storage/indexeddb'
import { createAppStore } from './store'

export const storage = indexedDbStorage()
export const useApp = createAppStore(storage)
export type { View } from './store'
