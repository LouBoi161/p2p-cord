import { contextBridge, ipcRenderer, clipboard } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  joinRoom: (topic: string) => ipcRenderer.send('join-room', topic),
  leaveRoom: (topic: string) => ipcRenderer.send('leave-room', topic),
  sendMessage: (peerId: string, message: string) => ipcRenderer.send('send-message', { peerId, message }),
  copyToClipboard: (text: string) => ipcRenderer.send('copy-to-clipboard', text),
  onPeerData: (callback: (event: any, data: { peerId: string, message: string }) => void) => 
    ipcRenderer.on('peer-data', callback),
  onPeerConnected: (callback: (event: any, data: { peerId: string, initiator: boolean }) => void) => 
    ipcRenderer.on('peer-connected', callback),
  onPeerDisconnected: (callback: (event: any, peerId: string) => void) => 
    ipcRenderer.on('peer-disconnected', callback),
  getStoreValue: (key: string) => ipcRenderer.invoke('get-store-value', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.send('set-store-value', key, value),
  
  // Screen Share Picker
  onGetScreenSources: (callback: (event: any, sources: any[]) => void) => 
      ipcRenderer.on('get-screen-sources', callback),
  selectScreenSource: (sourceId: string) => ipcRenderer.send('select-screen-source', sourceId),

  // Public Rooms
  createPublicRoom: (name: string, password: string) => ipcRenderer.invoke('create-public-room', { name, password }),
  deletePublicRoom: (name: string, password: string) => ipcRenderer.invoke('delete-public-room', { name, password }),
  getPublicRooms: () => ipcRenderer.invoke('get-public-rooms'),
  onPublicRoomsUpdate: (callback: (event: any, rooms: string[]) => void) => 
      ipcRenderer.on('public-rooms-update', callback),
})
