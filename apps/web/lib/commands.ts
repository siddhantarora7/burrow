/** The one thing to type to get a pet. */
export const INIT = 'npx burrow-pets init'

/** What to send a friend so their new pet moves straight into this garden. */
export const inviteCommand = (origin: string, burrowId: string) => `${INIT} ${origin.replace(/\/+$/, '')}/b/${burrowId}`
