import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import path from 'path'
import fs from 'fs'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import crypto from 'crypto'
import sodium from 'sodium-native'

// Admin Public Key for verifying room creation/deletion
const ADMIN_PUBLIC_KEY_HEX = 'f2c0cca99b616ba0c69c2cc2895ccd979ff4f8a1c04de2dc01e2cd7528c59c0f'
const ADMIN_PUBLIC_KEY = b4a.from(ADMIN_PUBLIC_KEY_HEX, 'hex')
const LOBBY_TOPIC = b4a.from(crypto.createHash('sha256').update('p2p-cord-lobby-v1').digest())

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
// Map peerId -> socket
const peers = new Map<string, any>()
let swarm: any
let lobbySwarm: any // Dedicated swarm for the lobby (or reuse main swarm with different topic management)

// Public Rooms State: Map<RoomName, { timestamp, signature }>
// We store more details to verify validity and allow gossip
interface PublicRoomData {
    name: string
    timestamp: number
    signature: string // Hex string
}
let publicRooms = new Map<string, PublicRoomData>()

let screenShareCallback: ((response: Electron.Streams) => void) | null = null
let pendingSources: Electron.DesktopCapturerSource[] = []

const storePath = path.join(app.getPath('userData'), 'store.json')
console.log("Store path:", storePath)

function getStore() {
    try {
        if (!fs.existsSync(storePath)) return {}
        return JSON.parse(fs.readFileSync(storePath, 'utf-8'))
    } catch (e) {
        console.error("Error reading store", e)
        return {}
    }
}

function setStore(key: string, value: any) {
    try {
        const dir = path.dirname(storePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        const store = getStore()
        store[key] = value
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2))
    } catch (e) {
        console.error("Error writing store", e)
    }
}

// Load public rooms from store on startup
function loadPublicRooms() {
    const stored = getStore()['public-rooms']
    if (stored && Array.isArray(stored)) {
        stored.forEach((r: PublicRoomData) => {
            // Verify signature before loading? Ideally yes, but trusted local store is okay.
            // We verify to be safe against corruption.
            if (verifyRoomAction(r.name, r.timestamp, 'add', r.signature)) {
                 publicRooms.set(r.name, r)
            }
        })
    }
}

function savePublicRooms() {
    const rooms = Array.from(publicRooms.values())
    setStore('public-rooms', rooms)
}

function verifyRoomAction(name: string, timestamp: number, action: 'add' | 'delete', signatureHex: string): boolean {
    try {
        const msg = `${action}:${name}:${timestamp}`
        const sig = b4a.from(signatureHex, 'hex')
        const msgBuf = b4a.from(msg)
        return sodium.crypto_sign_verify_detached(sig, msgBuf, ADMIN_PUBLIC_KEY)
    } catch (e) {
        console.error("Verification error", e)
        return false
    }
}

function signRoomAction(name: string, timestamp: number, action: 'add' | 'delete', secretKey: Buffer): string {
    const msg = `${action}:${name}:${timestamp}`
    const sig = Buffer.alloc(sodium.crypto_sign_BYTES)
    sodium.crypto_sign_detached(sig, b4a.from(msg), secretKey)
    return sig.toString('hex')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC!, 'icon.png'),
    backgroundColor: '#111827', // dark-900
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true // Ensure DevTools is enabled
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    // Send initial public rooms
    win?.webContents.send('public-rooms-update', Array.from(publicRooms.keys()))
  })
  
  // Enable DevTools shortcut
  win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
          win?.webContents.toggleDevTools()
          event.preventDefault()
      }
      if (input.control && input.shift && input.key.toLowerCase() === 'i' && input.type === 'keyDown') {
          win?.webContents.toggleDevTools()
          event.preventDefault()
      }
  })

  // Remove default menu
  win.setMenu(null)
  
  // Force DevTools to open
  win.webContents.openDevTools()
  console.log("Main process: DevTools opened and menu removed.")

  // Handle permissions
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture', 'videoCapture', 'display-capture', 'clipboard-read', 'clipboard-write']
    console.log(`Permission requested: ${permission}`)
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      console.warn(`Permission denied: ${permission}`)
      callback(false)
    }
  })

  // Handle Screen Sharing Request
  win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      pendingSources = sources
      
      const sentSources = sources.map(s => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail.toDataURL(),
          display_id: s.display_id,
          appIcon: s.appIcon ? s.appIcon.toDataURL() : null
      }))
      
      screenShareCallback = callback
      win?.webContents.send('get-screen-sources', sentSources)
    }).catch(console.error)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    if (swarm) swarm.destroy()
    if (lobbySwarm) lobbySwarm.destroy()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  loadPublicRooms()
  createWindow()
  
  // Initialize Hyperswarm for Rooms
  swarm = new Hyperswarm()
  
  swarm.on('connection', (socket: any, info: any) => {
    const peerId = b4a.toString(socket.remotePublicKey, 'hex')
    console.log('New peer connected (Room):', peerId, 'Initiator:', info.client)
    peers.set(peerId, socket)
    
    // Notify Renderer
    win?.webContents.send('peer-connected', { peerId, initiator: info.client })

    socket.on('data', (data: Buffer) => {
      // Forward data to Renderer (signaling)
      // We assume data is a string (JSON stringified)
      const message = data.toString()
      win?.webContents.send('peer-data', { peerId, message })
    })

    socket.on('close', () => {
      console.log('Peer disconnected (Room):', peerId)
      peers.delete(peerId)
      win?.webContents.send('peer-disconnected', peerId)
    })
    
    socket.on('error', (err: any) => {
        console.error('Socket error', err)
    })
  })

  // Initialize Lobby Swarm
  // We use a separate swarm instance or just join a different topic?
  // Hyperswarm can handle multiple topics. But 'connection' event fires for all.
  // We need to distinguish connections.
  // Actually, Hyperswarm doesn't easily tell you WHICH topic a connection is for in the connection event directly without some mapping or handshake.
  // But since we use one swarm for everything, we can just use a handshake protocol.
  // HOWEVER, for simplicity, let's use a separate swarm for the Lobby to keep traffic separate.
  lobbySwarm = new Hyperswarm()
  
  lobbySwarm.on('connection', (socket: any, info: any) => {
      const peerId = b4a.toString(socket.remotePublicKey, 'hex')
      console.log('New peer connected (Lobby):', peerId)
      
      // Send our known public rooms to the new peer
      const roomList = Array.from(publicRooms.values()).map(r => ({
          type: 'public-room-gossip',
          action: 'add',
          name: r.name,
          timestamp: r.timestamp,
          signature: r.signature
      }))
      
      roomList.forEach(msg => {
          socket.write(JSON.stringify(msg) + '\n')
      })

      socket.on('data', (data: Buffer) => {
          try {
              const lines = data.toString().split('\n')
              for (const line of lines) {
                  if (!line.trim()) continue
                  const msg = JSON.parse(line)
                  handleLobbyMessage(msg)
              }
          } catch (e) {
              console.error("Lobby message error", e)
          }
      })
  })

  lobbySwarm.join(LOBBY_TOPIC, { client: true, server: true })
  lobbySwarm.flush().then(() => console.log('Joined Lobby'))
})

function handleLobbyMessage(msg: any) {
    if (msg.type === 'public-room-gossip') {
        const { action, name, timestamp, signature } = msg
        
        if (action === 'add') {
            if (verifyRoomAction(name, timestamp, 'add', signature)) {
                // Check if we already have it or if it's newer/valid
                const existing = publicRooms.get(name)
                // We overwrite if we don't have it, or if this is valid (timestamps don't matter much for ADD unless we track updates, but for now just ADD)
                // Actually, if we have a DELETE with a higher timestamp, we should ignore.
                // But we don't store DELETEs indefinitely.
                if (!existing) {
                    publicRooms.set(name, { name, timestamp, signature })
                    savePublicRooms()
                    win?.webContents.send('public-rooms-update', Array.from(publicRooms.keys()))
                }
            }
        } else if (action === 'delete') {
             if (verifyRoomAction(name, timestamp, 'delete', signature)) {
                 if (publicRooms.has(name)) {
                     const existing = publicRooms.get(name)
                     // Only delete if this delete is newer than the add?
                     // We assume delete timestamp > add timestamp
                     if (existing && timestamp > existing.timestamp) {
                         publicRooms.delete(name)
                         savePublicRooms()
                         win?.webContents.send('public-rooms-update', Array.from(publicRooms.keys()))
                     }
                 }
             }
        }
    }
}

function broadcastLobby(msg: any) {
    const data = JSON.stringify(msg) + '\n'
    for (const socket of lobbySwarm.connections) {
        socket.write(data)
    }
}

// IPC Handlers
ipcMain.on('select-screen-source', (_event, sourceId) => {
    if (screenShareCallback) {
        if (sourceId) {
            const source = pendingSources.find(s => s.id === sourceId)
            if (source) {
                // Determine audio support? Loopback audio usually only works for screens, not windows on some OS
                // But we try 'loopback' anyway.
                screenShareCallback({ video: source, audio: 'loopback' })
            }
        }
        // Reset
        screenShareCallback = null
        pendingSources = []
    }
})

ipcMain.on('join-room', (_event, topicStr) => {
  if (!swarm) return
  // Topic needs to be 32 bytes buffer
  // If the user provides a string, we might hash it or decode it if it's hex
  // For now, let's assume it's a hex string, or we hash it if it's a name
  let topic: Buffer
  try {
      if (topicStr.length === 64) {
          topic = b4a.from(topicStr, 'hex')
      } else {
          // If it's a human readable name, hash it
          topic = b4a.from(crypto.createHash('sha256').update(topicStr).digest())
      }
      
      const discovery = swarm.join(topic, { client: true, server: true })
      discovery.flushed().then(() => {
          console.log('Joined topic:', b4a.toString(topic, 'hex'))
      })
  } catch (e) {
      console.error('Error joining topic:', e)
  }
})

ipcMain.on('leave-room', (_event, topicStr) => {
  if (!swarm) return
  try {
      let topic: Buffer
      if (topicStr.length === 64) {
          topic = b4a.from(topicStr, 'hex')
      } else {
          topic = b4a.from(crypto.createHash('sha256').update(topicStr).digest())
      }
      swarm.leave(topic)
      console.log('Left topic:', b4a.toString(topic, 'hex'))
  } catch (e) {
      console.error('Error leaving topic:', e)
  }
})

ipcMain.on('send-message', (_event, { peerId, message }) => {
    const socket = peers.get(peerId)
    if (socket) {
        socket.write(Buffer.from(message))
    }
})

ipcMain.on('copy-to-clipboard', (_event, text) => {
    try {
        const { clipboard } = require('electron')
        clipboard.writeText(text)
    } catch (e) {
        console.error('Clipboard error:', e)
    }
})

ipcMain.handle('get-store-value', (_event, key) => {
    return getStore()[key]
})

ipcMain.on('set-store-value', (_event, key, value) => {
    setStore(key, value)
})

// Public Room IPC Handlers
ipcMain.handle('create-public-room', (_event, { name, password }) => {
    try {
        // 1. Derive Secret Key
        const seed = Buffer.alloc(sodium.crypto_sign_SEEDBYTES)
        sodium.crypto_generichash(seed, Buffer.from(password))
        
        const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES)
        const secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES)
        sodium.crypto_sign_seed_keypair(publicKey, secretKey, seed)

        // 2. Verify Key matches Admin Public Key
        // This ensures only the correct password works
        if (!b4a.equals(publicKey, ADMIN_PUBLIC_KEY)) {
            return { success: false, error: 'Invalid Admin Password' }
        }

        // 3. Create Signed Message
        const timestamp = Date.now()
        const signature = signRoomAction(name, timestamp, 'add', secretKey)

        // 4. Update Local State
        publicRooms.set(name, { name, timestamp, signature })
        savePublicRooms()
        
        // 5. Broadcast
        broadcastLobby({
            type: 'public-room-gossip',
            action: 'add',
            name,
            timestamp,
            signature
        })
        
        // 6. Notify Renderer
        win?.webContents.send('public-rooms-update', Array.from(publicRooms.keys()))

        return { success: true }
    } catch (e: any) {
        console.error("Create room failed", e)
        return { success: false, error: e.message }
    }
})

ipcMain.handle('delete-public-room', (_event, { name, password }) => {
    try {
        // 1. Derive Secret Key
        const seed = Buffer.alloc(sodium.crypto_sign_SEEDBYTES)
        sodium.crypto_generichash(seed, Buffer.from(password))
        
        const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES)
        const secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES)
        sodium.crypto_sign_seed_keypair(publicKey, secretKey, seed)

        if (!b4a.equals(publicKey, ADMIN_PUBLIC_KEY)) {
            return { success: false, error: 'Invalid Admin Password' }
        }

        const timestamp = Date.now()
        const signature = signRoomAction(name, timestamp, 'delete', secretKey)

        // 4. Update Local State
        if (publicRooms.has(name)) {
            publicRooms.delete(name)
            savePublicRooms()
        }
        
        // 5. Broadcast
        broadcastLobby({
            type: 'public-room-gossip',
            action: 'delete',
            name,
            timestamp,
            signature
        })
        
        // 6. Notify Renderer
        win?.webContents.send('public-rooms-update', Array.from(publicRooms.keys()))
        
        return { success: true }
    } catch (e: any) {
        console.error("Delete room failed", e)
        return { success: false, error: e.message }
    }
})

ipcMain.handle('get-public-rooms', () => {
    return Array.from(publicRooms.keys())
})

