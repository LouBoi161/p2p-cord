import React, { useState } from 'react'
import { Plus, Hash, User, Settings, Copy, Trash2, Check } from 'lucide-react'

interface SidebarProps {
  rooms: string[]
  activeRoom: string | null
  userName: string
  onJoinRoom: (room: string) => void
  onSelectRoom: (room: string) => void
  onDeleteRoom: (room: string) => void
  onOpenSettings: () => void
}

export function Sidebar({ rooms, activeRoom, userName, onJoinRoom, onSelectRoom, onDeleteRoom, onOpenSettings }: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [copiedRoom, setCopiedRoom] = useState<string | null>(null)
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newRoomName.trim()) {
      onJoinRoom(newRoomName.trim())
      setNewRoomName('')
      setIsCreating(false)
    }
  }

  const copyToClipboard = (text: string) => {
      // Immediate visual feedback
      setCopiedRoom(text)
      setTimeout(() => setCopiedRoom(null), 2000)

      // Logic
      try {
        if (window.electronAPI && window.electronAPI.copyToClipboard) {
            window.electronAPI.copyToClipboard(text)
        } else {
            navigator.clipboard.writeText(text).catch(console.error)
        }
      } catch (err) {
        console.error("Copy failed", err)
      }
  }

  return (
    <div className="w-64 bg-gray-900 flex flex-col h-full border-r border-gray-800">
      <div className="p-4 border-b border-gray-800 font-bold text-xl text-indigo-500">
        P2P Cord
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {rooms.map(room => (
          <div
            key={room}
            className={`group w-full flex items-center gap-1 rounded transition-colors pr-1 ${
              activeRoom === room 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <button
                type="button"
                onClick={() => onSelectRoom(room)}
                className="flex-1 min-w-0 text-left px-3 py-2 flex items-center gap-2 overflow-hidden outline-none focus:bg-gray-600 rounded"
            >
                <Hash size={18} className="shrink-0" />
                <span className="truncate">{room}</span>
            </button>
            
            <button
                type="button"
                onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    copyToClipboard(room);
                }}
                className={`relative z-20 shrink-0 p-2 rounded-full transition-all cursor-pointer active:scale-90 ${
                    copiedRoom === room 
                    ? 'text-green-500 bg-gray-800' 
                    : 'text-gray-500 hover:text-white hover:bg-gray-600'
                }`}
                title="Copy Room ID"
            >
                {copiedRoom === room ? <Check size={14} className="pointer-events-none" /> : <Copy size={14} className="pointer-events-none" />}
            </button>
            <button
                type="button"
                onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    onDeleteRoom(room);
                }}
                className="relative z-20 shrink-0 p-2 text-gray-500 hover:text-red-400 hover:bg-gray-600 rounded-full transition-all cursor-pointer active:scale-90"
                title="Remove Room"
            >
                <Trash2 size={14} className="pointer-events-none" />
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-800 space-y-2">
        {isCreating ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              autoFocus
              placeholder="Enter Room Code"
              className="bg-gray-800 text-white text-sm rounded p-2 outline-none border border-gray-700 focus:border-indigo-500"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              onBlur={() => !newRoomName && setIsCreating(false)}
            />
            <button
               type="button"
               onMouseDown={() => setIsCreating(false)} // Use onMouseDown to prevent blur race condition
               className="text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition-colors"
            >
              <Hash size={18} />
              <span>Join Room</span>
            </button>
            <button
              onClick={() => {
                 // Generate random 9-character code (3 blocks of 3)
                 const code = Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 5)
                 onJoinRoom(code.toUpperCase())
              }}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded transition-colors"
            >
              <Plus size={18} />
              <span>Create Room</span>
            </button>
          </>
        )}
      </div>

      {/* User Profile Section */}
      <div className="p-3 bg-gray-950 border-t border-gray-800">
          <div className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                  <User size={16} />
              </div>
              <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{userName}</div>
                  <div className="text-[10px] text-gray-500">Online</div>
              </div>
              <button 
                  onClick={onOpenSettings}
                  className="text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                  <Settings size={14} />
              </button>
          </div>
      </div>
    </div>
  )
}
