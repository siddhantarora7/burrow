'use client'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { ClientMsg, ServerMsg } from '@burrow/core'
import { initialState, reduce } from './burrowState'
import { clearMe, readMe, redeemClaimInUrl } from './me'

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '')

export function useBurrow(id: string) {
  const [state, dispatch] = useReducer(reduce, initialState)
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined
    let stopped = false

    const send = (m: ClientMsg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m))
    const connect = () => {
      ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/v1/burrows/${id}/ws`)
      socket.current = ws
      ws.onopen = () => {
        retry = 0
        // say who we are on every (re)connect; the server answers welcome
        send({ t: 'hello', token: readMe()?.token })
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 25_000)
      }
      ws.onmessage = (e) => {
        if (e.data === 'pong') return
        try {
          const msg = JSON.parse(e.data as string) as ServerMsg
          if (msg.t === 'welcome' && msg.me === null && readMe()) clearMe() // the server no longer knows this token
          dispatch({ kind: 'msg', msg, clientNow: Date.now() })
        } catch {
          // ignore malformed frames
        }
      }
      ws.onclose = (e) => {
        clearInterval(ping)
        if (stopped || e.code === 4404) return
        dispatch({ kind: 'status', status: 'reconnecting' })
        timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++))
      }
    }
    // a sign-in link is redeemed before the first hello, so it can be used straight away
    redeemClaimInUrl(API_URL).then(() => {
      if (!stopped) connect()
    })
    // A laptop waking from sleep: reconnect right away instead of waiting out the backoff.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ws?.readyState === WebSocket.CLOSED) {
        clearTimeout(timer)
        retry = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(ping)
      document.removeEventListener('visibilitychange', onVisible)
      ws?.close()
    }
  }, [id])

  const poke = useCallback((to: string) => {
    const ws = socket.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'poke', to } satisfies ClientMsg))
  }, [])

  return { ...state, poke }
}
