import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import path from 'path'
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import crypto from 'crypto'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
// Map peerId -> socket
const peers = new Map<string, any>()
let swarm: any

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
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
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Grant access to the first screen available
      if (sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' })
      } else {
          // No screens available?
          console.error("No screens found for sharing")
      }
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
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  createWindow()
  
  // Initialize Hyperswarm
  swarm = new Hyperswarm()
  
  swarm.on('connection', (socket: any, info: any) => {
    const peerId = b4a.toString(socket.remotePublicKey, 'hex')
    console.log('New peer connected:', peerId, 'Initiator:', info.client)
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
      console.log('Peer disconnected:', peerId)
      peers.delete(peerId)
      win?.webContents.send('peer-disconnected', peerId)
    })
    
    socket.on('error', (err: any) => {
        console.error('Socket error', err)
    })
  })
})

// IPC Handlers
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
