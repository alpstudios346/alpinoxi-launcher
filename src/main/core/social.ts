import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import WebSocket from 'ws'
import type { Friend, Party } from '@shared/types'
import type { SocialPayload } from '@shared/ipc'
import { dirs } from './paths'
import { getSettings } from './settings'
import { currentAccount } from './auth'
import { JsonStore } from './store'

type Listener = (payload: SocialPayload) => void

let socket: WebSocket | null = null
let listener: Listener | null = null
const friendsLocal: Friend[] = []

const stateStore = (): JsonStore<{ friends: Friend[] }> =>
  new JsonStore<{ friends: Friend[] }>(join(dirs.settings, 'friends.json'), { friends: [] })

const state: SocialPayload = { friends: [], party: null, connected: false }

export function onSocialUpdate(cb: Listener): void {
  listener = cb
}

function emit(): void {
  listener?.({ ...state, friends: [...state.friends] })
}

export function socialState(): SocialPayload {
  return { ...state, friends: [...state.friends], party: state.party ? { ...state.party } : null }
}

export function connectSocial(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
  const account = currentAccount()
  const url = getSettings().socialServerUrl
  if (!url) return
  try {
    socket = new WebSocket(url)
  } catch {
    state.connected = false
    emit()
    return
  }
  socket.on('open', () => {
    state.connected = true
    state.selfId = account?.uuid ?? randomUUID()
    state.friends = stateStore().get().friends
    socket?.send(JSON.stringify({ t: 'hello', id: state.selfId, name: account?.username ?? 'Gezgin' }))
    emit()
  })
  socket.on('message', (raw: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(raw.toString()) as { t: string } & Partial<SocialPayload>
      if (msg.t === 'social') {
        if (msg.friends) state.friends = msg.friends
        if ('party' in msg) state.party = (msg.party as Party | null) ?? null
        stateStore().replace({ friends: state.friends })
        emit()
      }
    } catch {
      /* ignore malformed frames */
    }
  })
  socket.on('close', () => {
    state.connected = false
    emit()
  })
  socket.on('error', () => {
    state.connected = false
    emit()
  })
}

export function disconnectSocial(): void {
  socket?.close()
  socket = null
  state.connected = false
  emit()
}

function send(payload: Record<string, unknown>): void {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
}

export function addFriend(username: string): Friend[] {
  const friend: Friend = { id: randomUUID(), username, status: 'offline' }
  friendsLocal.push(friend)
  send({ t: 'addFriend', name: username })
  if (!state.friends.some((f) => f.username === username)) state.friends.push(friend)
  stateStore().replace({ friends: state.friends })
  emit()
  return state.friends
}

export function removeFriend(id: string): Friend[] {
  state.friends = state.friends.filter((f) => f.id !== id)
  send({ t: 'removeFriend', id })
  stateStore().replace({ friends: state.friends })
  emit()
  return state.friends
}

export function createParty(): Party {
  const account = currentAccount()
  const party: Party = {
    id: randomUUID(),
    code: Math.random().toString(36).slice(2, 8).toUpperCase(),
    hostId: account?.uuid ?? 'self',
    members: [{ id: account?.uuid ?? 'self', username: account?.username ?? 'Sen', isHost: true, ready: true }],
    createdAt: Date.now()
  }
  send({ t: 'party:create', code: party.code })
  state.party = party
  emit()
  return party
}

export function joinParty(code: string): Party {
  send({ t: 'party:join', code })
  const account = currentAccount()
  const party: Party = {
    id: randomUUID(),
    code,
    hostId: 'unknown',
    members: [{ id: account?.uuid ?? 'self', username: account?.username ?? 'Sen', isHost: false, ready: true }],
    createdAt: Date.now()
  }
  state.party = party
  emit()
  return party
}

export function leaveParty(): void {
  send({ t: 'party:leave' })
  state.party = null
  emit()
}
