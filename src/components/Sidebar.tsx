import React, { useState } from 'react'
import { Plus, Hash, User, Settings } from 'lucide-react'

interface SidebarProps {
  rooms: string[]
  activeRoom: string | null
  userName: string
  onJoinRoom: (room: string) => void
  onSelectRoom: (room: string) => void
  onOpenSettings: () => void
}

export function Sidebar({ rooms, activeRoom, userName, onJoinRoom, onSelectRoom, onOpenSettings }: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newRoomName.trim()) {
      onJoinRoom(newRoomName.trim())
      setNewRoomName('')
      setIsCreating(false)
    }
  }

  return (
    <div className="w-64 bg-gray-900 flex flex-col h-full border-r border-gray-800">
      <div className="p-4 border-b border-gray-800 font-bold text-xl text-indigo-500">
        P2P Cord
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {rooms.map(room => (
          <button
            key={room}
            onClick={() => onSelectRoom(room)}
            className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 transition-colors ${
              activeRoom === room 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Hash size={18} />
            <span className="truncate">{room}</span>
          </button>
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
