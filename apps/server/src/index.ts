import { burrowName, isId, newId, parseToken, SECRET_LEN } from '@burrow/core'
import { json, parseClaim, sha256Hex, validateHatch } from './logic'

export { PetDO } from './pet'
export { BurrowDO } from './burrow'

const pet = (env: Env, id: string) => env.PET.get(env.PET.idFromName(id))
const burrow = (env: Env, id: string) => env.BURROW.get(env.BURROW.idFromName(id))

const bearer = (req: Request) => parseToken(req.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))

async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get('content-length') ?? 0) > 4096) return undefined
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const cors = {
      'access-control-allow-origin': env.WEB_ORIGIN,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const now = Date.now()

    if (req.method === 'POST' && url.pathname === '/v1/pets') {
      const hatch = validateHatch(await readJson(req))
      if (!hatch.ok) return json({ error: hatch.error }, 400, cors)
      const invited = hatch.value.burrowId
      // Check the friend's burrow before hatching, so a bad link never orphans a pet.
      if (invited) {
        if (!(await burrow(env, invited).exists())) return json({ error: 'burrow not found' }, 404, cors)
        if (await burrow(env, invited).isFull()) return json({ error: 'burrow is full' }, 409, cors)
      }
      const petId = newId()
      const secret = newId(SECRET_LEN)
      const burrowId = invited ?? newId()
      const profile = await pet(env, petId).hatch(petId, hatch.value, await sha256Hex(secret), now)
      const b = burrow(env, burrowId)
      if (!invited) await b.create({ id: burrowId, name: burrowName(profile.name), env: 'garden', createdAt: now, createdBy: petId })
      await b.join(profile, now)
      await pet(env, petId).addBurrow(burrowId)
      const claim = await pet(env, petId).newClaim(now)
      return json({ petId, token: `${petId}.${secret}`, burrowId, claim }, 201, cors)
    }

    if (req.method === 'POST' && url.pathname === '/v1/events') {
      const tok = bearer(req)
      if (!tok) return json({ error: 'bad token' }, 401)
      const r = await pet(env, tok.petId).event(tok.secret, await readJson(req), now)
      if (r.status === 204) return new Response(null, { status: 204 })
      if (r.status === 400) return json({ error: r.error }, 400)
      return json({ error: r.status === 401 ? 'bad token' : 'slow down' }, r.status)
    }

    // A fresh sign-in link for `npx burrow-pets open`.
    if (req.method === 'POST' && url.pathname === '/v1/claims') {
      const tok = bearer(req)
      if (!tok || !(await pet(env, tok.petId).auth(tok.secret))) return json({ error: 'bad token' }, 401)
      return json({ claim: await pet(env, tok.petId).newClaim(now) }, 201)
    }

    // The browser trades a one-time claim from the link's fragment for a web token.
    if (req.method === 'POST' && url.pathname === '/v1/claim') {
      const body = (await readJson(req)) as { claim?: unknown } | undefined
      const c = parseClaim(body?.claim)
      if (!c) return json({ error: 'bad claim' }, 400, cors)
      const r = await pet(env, c.petId).redeem(c.code, now)
      if (!r) return json({ error: 'this sign-in link was already used or has expired' }, 401, cors)
      return json({ petId: c.petId, token: r.token }, 200, cors)
    }

    const join = url.pathname.match(/^\/v1\/burrows\/([^/]+)\/join$/)
    if (req.method === 'POST' && join) {
      const tok = bearer(req)
      const profile = tok && (await pet(env, tok.petId).auth(tok.secret))
      if (!profile) return json({ error: 'bad token' }, 401)
      if (!isId(join[1])) return json({ error: 'burrow not found' }, 404)
      const b = burrow(env, join[1])
      const r = await b.join(profile, now)
      if (r === 'not_found') return json({ error: 'burrow not found' }, 404)
      if (r === 'full') return json({ error: 'burrow is full' }, 409)
      await pet(env, profile.petId).addBurrow(join[1])
      return json({ burrowId: join[1], name: (await b.info())!.name }, 200)
    }

    const snap = url.pathname.match(/^\/v1\/burrows\/([^/]+)\/snapshot$/)
    if (req.method === 'GET' && snap) {
      const s = isId(snap[1]) ? await burrow(env, snap[1]).snapshotJson(now) : null
      return s ? json(s, 200, { ...cors, 'cache-control': 'no-store' }) : json({ error: 'not found' }, 404, cors)
    }

    const ws = url.pathname.match(/^\/v1\/burrows\/([^/]+)\/ws$/)
    if (req.method === 'GET' && ws) {
      if (!isId(ws[1])) return json({ error: 'not found' }, 404, cors)
      return burrow(env, ws[1]).fetch(req)
    }

    if (url.pathname === '/') return json({ name: 'burrow api', ok: true }, 200, cors)
    return json({ error: 'not found' }, 404, cors)
  },
} satisfies ExportedHandler<Env>
