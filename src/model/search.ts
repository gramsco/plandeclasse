/** Lowercase, accents removed, so that searches ignore both. */
export const normalizeText = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** True when `text` contains `query`, ignoring case and accents; an empty query matches everything. */
export const matchesSearch = (text: string, query: string) => normalizeText(text).includes(normalizeText(query.trim()))
