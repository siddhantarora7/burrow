'use client'
import { useEffect, useReducer } from 'react'
import type { ServerMsg } from '@burrow/core'
import { initialState, reduce } from './burrowState'

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '')

export function useBurrow(id: string) {
  const [state, dispatch] = useReducer(reduce, initialState)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let ping: ReturnType<typeof setInterval> | undefined
    let stopped = false

    const connect = () => {
      ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/v1/burrows/${id}/ws`)
      ws.onopen = () => {
        retry = 0
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 25_000)
      }
      ws.onmessage = (e) => {
        if (e.data === 'pong') return
        try {
          dispatch({ kind: 'msg', msg: JSON.parse(e.data as string) as ServerMsg, clientNow: Date.now() })
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
    connect()
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

  return state
}
