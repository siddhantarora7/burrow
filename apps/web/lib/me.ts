// Which pet this browser speaks for. A one-time claim from the link's fragment is traded for a web
// token, kept in localStorage. Web tokens can say hello and poke; they can never post events.
export interface Me { petId: string; token: string }

const KEY = 'burrow:me'

export function claimInHash(hash: string): string | null {
  const m = /^#claim=(.+)$/.exec(hash)
  return m ? decodeURIComponent(m[1]!) : null
}

export function readMe(): Me | null {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Me | null
    return m && typeof m.petId === 'string' && typeof m.token === 'string' ? m : null
  } catch {
    return null
  }
}

export function writeMe(m: Me): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    // private mode: signed in for this visit only
  }
}

export function clearMe(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
}

// Shared by every caller, so a second mount (React re-running an effect) waits for the first redemption.
let redeeming: Promise<void> = Promise.resolve()

/**
 * If the URL carries a claim, strip it from the address bar (so it is never bookmarked or shared) and
 * trade it for a web token. A used or expired claim leaves any existing sign-in alone. Resolves once
 * any redemption in flight has finished.
 */
export function redeemClaimInUrl(apiUrl: string): Promise<void> {
  const claim = claimInHash(location.hash)
  if (!claim) return redeeming
  history.replaceState(null, '', location.pathname + location.search)
  redeeming = (async () => {
    try {
      const res = await fetch(`${apiUrl}/v1/claim`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claim }) })
      if (!res.ok) return
      const body = (await res.json()) as Partial<Me>
      if (typeof body.petId === 'string' && typeof body.token === 'string') writeMe({ petId: body.petId, token: body.token })
    } catch {
      // offline: the page still works as a plain viewer
    }
  })()
  return redeeming
}
