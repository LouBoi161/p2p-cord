/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    joinRoom: (topic: string) => void
    leaveRoom: (topic: string) => void
    sendMessage: (peerId: string, message: string) => void
    copyToClipboard: (text: string) => void
    onPeerData: (callback: (event: any, data: { peerId: string, message: string }) => void) => void
    onPeerConnected: (callback: (event: any, data: { peerId: string, initiator: boolean }) => void) => void
    onPeerDisconnected: (callback: (event: any, peerId: string) => void) => void
    getStoreValue: (key: string) => Promise<any>
    setStoreValue: (key: string, value: any) => void
  }
}
