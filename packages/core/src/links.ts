import { isId } from './ids'

/** The burrow id in a pasted link (`…/b/<id>`, any host, query or fragment) or a bare id; null otherwise. */
export function parseBurrowLink(input: string): string | null {
  const s = input.trim().toLowerCase()
  const id = isId(s) ? s : /(?:^|\/)b\/([^/?#]+)\/?(?:[?#].*)?$/.exec(s)?.[1]
  return id && isId(id) ? id : null
}
