'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeriveResult, Member, PetState } from '@burrow/core'
import { alertChip, alertsFor, pokeAlerts, type Alert } from './alerts'
import { notify } from './notify'

const KEY = 'burrow:alerts'

/** A soft two-note chime, synthesised so there is no asset to load. */
function chime(ctx: AudioContext) {
  const t = ctx.currentTime
  for (const [i, f] of [660, 880].entries()) {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    const s = t + i * 0.16
    g.gain.setValueAtTime(0, s)
    g.gain.linearRampToValueAtTime(0.12, s + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5)
    o.connect(g).connect(ctx.destination)
    o.start(s)
    o.stop(s + 0.55)
  }
}

const permissionNow = (): NotificationPermission => (typeof Notification === 'undefined' ? 'denied' : Notification.permission)

/**
 * In-tab alerts for your own pet: a chime, plus a system notification when the tab is not in front.
 * Sound unlocks on the first click or key press anywhere on the page (browsers require a gesture).
 */
export function useAlerts({ me, members, states, pokes }: {
  me: string | null
  members: Member[]
  states: Map<string, DeriveResult>
  pokes: ReadonlyArray<{ from: string; to: string; t: number }>
}) {
  const [on, setOn] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [soundReady, setSoundReady] = useState(false)
  const audio = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) !== 'off')
    } catch {
      // keep the default
    }
    setPermission(permissionNow())
    const unlock = () => {
      if (typeof AudioContext === 'undefined') return
      audio.current ??= new AudioContext()
      audio.current.resume().then(() => setSoundReady(audio.current?.state === 'running'), () => {})
    }
    addEventListener('pointerdown', unlock)
    addEventListener('keydown', unlock)
    return () => {
      removeEventListener('pointerdown', unlock)
      removeEventListener('keydown', unlock)
    }
  }, [])

  const fire = useCallback((alerts: Alert[]) => {
    if (!on) return
    for (const a of alerts) {
      if (audio.current?.state === 'running') chime(audio.current)
      // the title and the chime are enough while you are looking at the garden
      if (document.hidden || !document.hasFocus()) notify(a.title, a.body)
    }
  }, [on])

  const names = useRef(new Map<string, string>())
  names.current = new Map(members.map((m) => [m.petId, m.name]))

  const prev = useRef<Map<string, PetState> | null>(null)
  useEffect(() => {
    if (!members.length) return
    const next = new Map(members.map((m) => [m.petId, states.get(m.petId)?.state ?? 'sleep'] as const))
    fire(alertsFor(prev.current, next, me, names.current))
    prev.current = next
  }, [members, states, me, fire])

  const seenPoke = useRef(0)
  useEffect(() => {
    fire(pokeAlerts(pokes, me, seenPoke.current, names.current))
    seenPoke.current = Math.max(seenPoke.current, ...pokes.map((p) => p.t))
  }, [pokes, me, fire])

  const setOnStored = (next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      // this visit only
    }
  }
  /** The chip does the next useful thing: turn on, unlock sound (the click itself does), ask for notifications, or turn off. */
  const press = useCallback(async () => {
    const ask = typeof Notification !== 'undefined' && Notification.permission === 'default'
    if (!on) setOnStored(true)
    else if (!soundReady) return
    else if (!ask) return setOnStored(false)
    if (ask) setPermission(await Notification.requestPermission())
  }, [on, soundReady])

  return { label: alertChip({ on, permission, soundReady }), press }
}
