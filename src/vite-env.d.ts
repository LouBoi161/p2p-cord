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
    onGetScreenSources: (callback: (event: any, sources: any[]) => void) => void
    selectScreenSource: (sourceId: string | null) => void
    
    // Public Rooms
    createPublicRoom: (name: string, password: string) => Promise<{ success: boolean, error?: string }>
    deletePublicRoom: (name: string, password: string) => Promise<{ success: boolean, error?: string }>
    getPublicRooms: () => Promise<string[]>
    onPublicRoomsUpdate: (callback: (event: any, rooms: string[]) => void) => void
  }
}
