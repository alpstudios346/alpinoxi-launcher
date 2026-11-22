/**
 * Alpinoxi Client — sosyal sunucu (arkadaş + parti)
 *
 * Başlatıcı varsayılan olarak ws://localhost:8787 adresine bağlanır
 * (Ayarlar > Sosyal sunucu). Çalıştırmak için proje kökünde:
 *
 *   npm run social
 */

import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? 8787)

/** @type {Map<import('ws').WebSocket, { id: string, name: string, friends: { id: string, username: string, status: string }[] }>} */
const clients = new Map()
/** @type {Map<string, { id: string, code: string, hostId: string, members: { id: string, username: string, isHost: boolean, ready: boolean }[], createdAt: number }>} */
const parties = new Map()

const wss = new WebSocketServer({ port: PORT })

function broadcastParty(party) {
  for (const [socket, client] of clients) {
    if (socket.readyState !== socket.OPEN) continue
    const inParty = party.members.some((m) => m.id === client.id)
    socket.send(
      JSON.stringify({
        t: 'social',
        friends: client.friends,
        party: inParty ? party : null
      })
    )
  }
}

function sendState(socket, client) {
  if (socket.readyState !== socket.OPEN) return
  const party = [...parties.values()].find((p) => p.members.some((m) => m.id === client.id)) ?? null
  socket.send(JSON.stringify({ t: 'social', friends: client.friends, party }))
}

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    const client = clients.get(socket)

    if (msg.t === 'hello' && !client) {
      const entry = { id: msg.id, name: msg.name ?? 'Gezgin', friends: [] }
      clients.set(socket, entry)
      sendState(socket, entry)
      return
    }

    if (!client) return

    if (msg.t === 'addFriend') {
      if (!client.friends.some((f) => f.username === msg.name)) {
        client.friends.push({ id: msg.id ?? crypto.randomUUID(), username: msg.name, status: 'offline' })
      }
      sendState(socket, client)
      return
    }

    if (msg.t === 'removeFriend') {
      client.friends = client.friends.filter((f) => f.id !== msg.id)
      sendState(socket, client)
      return
    }

    if (msg.t === 'party:create') {
      const party = {
        id: msg.id ?? crypto.randomUUID(),
        code: msg.code,
        hostId: client.id,
        members: [{ id: client.id, username: client.name, isHost: true, ready: true }],
        createdAt: Date.now()
      }
      parties.set(party.code, party)
      broadcastParty(party)
      return
    }

    if (msg.t === 'party:join') {
      const party = parties.get(msg.code)
      if (!party) {
        socket.send(JSON.stringify({ t: 'social', friends: client.friends, party: null }))
        return
      }
      if (!party.members.some((m) => m.id === client.id)) {
        party.members.push({ id: client.id, username: client.name, isHost: false, ready: true })
      }
      broadcastParty(party)
      return
    }

    if (msg.t === 'party:leave') {
      for (const [code, party] of parties) {
        party.members = party.members.filter((m) => m.id !== client.id)
        if (party.members.length === 0) parties.delete(code)
        else broadcastParty(party)
      }
      sendState(socket, client)
    }
  })

  socket.on('close', () => {
    const client = clients.get(socket)
    clients.delete(socket)
    if (!client) return
    for (const [code, party] of parties) {
      party.members = party.members.filter((m) => m.id !== client.id)
      if (party.members.length === 0) parties.delete(code)
      else broadcastParty(party)
    }
  })
})

console.log(`[Alpinoxi] Sosyal sunucu ws://localhost:${PORT} üzerinde çalışıyor`)
