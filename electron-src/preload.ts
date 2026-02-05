import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  joinRoom: (topic: string) => ipcRenderer.send('join-room', topic),
  leaveRoom: (topic: string) => ipcRenderer.send('leave-room', topic),
  sendMessage: (peerId: string, message: string) => ipcRenderer.send('send-message', { peerId, message }),
  onPeerData: (callback: (event: any, data: { peerId: string, message: string }) => void) => 
    ipcRenderer.on('peer-data', callback),
  onPeerConnected: (callback: (event: any, data: { peerId: string, initiator: boolean }) => void) => 
    ipcRenderer.on('peer-connected', callback),
  onPeerDisconnected: (callback: (event: any, peerId: string) => void) => 
    ipcRenderer.on('peer-disconnected', callback),
})
