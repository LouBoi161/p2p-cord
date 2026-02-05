/// <reference types="vite/client" />

interface ElectronAPI {
  joinRoom: (topic: string) => void
  leaveRoom: (topic: string) => void
  sendMessage: (peerId: string, message: string) => void
  onPeerData: (callback: (event: any, data: { peerId: string, message: string }) => void) => void
  onPeerConnected: (callback: (event: any, data: { peerId: string, initiator: boolean }) => void) => void
  onPeerDisconnected: (callback: (event: any, peerId: string) => void) => void
}

interface Window {
  electronAPI: ElectronAPI
}
