import { EPOCH } from '../model/types'

const LAST_SYNC_KEY = 'lastSyncSent'

/** When this device last handed its edits over; what is older than that was already sent. */
export const getLastSync = () => localStorage.getItem(LAST_SYNC_KEY) ?? EPOCH
export const setLastSync = (at: string) => localStorage.setItem(LAST_SYNC_KEY, at)
export const hasLastSync = () => localStorage.getItem(LAST_SYNC_KEY) !== null
