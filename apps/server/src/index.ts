import { isId, newId, parseToken, SECRET_LEN } from '@burrow/core'
import { json, sha256Hex, validateHatch } from './logic'

export { PetDO } from './pet'
export { BurrowDO } from './burrow'

const pet = (env: Env, id: string) => env.PET.get(env.PET.idFromName(id))
const burrow = (env: Env, id: string) => env.BURROW.get(env.BURROW.idFromName(id))

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
      const petId = newId()
      const secret = newId(SECRET_LEN)
      const burrowId = newId()
      const profile = await pet(env, petId).hatch(petId, hatch.value, await sha256Hex(secret), now)
      const b = burrow(env, burrowId)
      await b.create({ id: burrowId, name: `${profile.name}'s burrow`, env: 'garden', createdAt: now, createdBy: petId })
      await b.join(profile, now)
      await pet(env, petId).addBurrow(burrowId)
      return json({ petId, token: `${petId}.${secret}`, burrowId }, 201, cors)
    }

    if (req.method === 'POST' && url.pathname === '/v1/events') {
      const tok = parseToken(req.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))
      if (!tok) return json({ error: 'bad token' }, 401)
      const r = await pet(env, tok.petId).event(tok.secret, await readJson(req), now)
      if (r.status === 204) return new Response(null, { status: 204 })
      if (r.status === 400) return json({ error: r.error }, 400)
      return json({ error: r.status === 401 ? 'bad token' : 'slow down' }, r.status)
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
