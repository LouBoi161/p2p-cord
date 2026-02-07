import React, { useState } from 'react'

interface CreatePublicRoomModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (name: string, password: string) => void
}

export function CreatePublicRoomModal({ isOpen, onClose, onSubmit }: CreatePublicRoomModalProps) {
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-96 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Create Public Room</h2>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(name, password); onClose(); setName(''); setPassword('') }}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Room Name</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                placeholder="e.g. Gaming"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Admin Password</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                placeholder="Required to manage room"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

interface DeletePublicRoomModalProps {
    isOpen: boolean
    roomName: string
    onClose: () => void
    onSubmit: (password: string) => void
}

export function DeletePublicRoomModal({ isOpen, roomName, onClose, onSubmit }: DeletePublicRoomModalProps) {
    const [password, setPassword] = useState('')

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 w-96 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Delete Public Room</h2>
                <p className="text-gray-400 mb-4">
                    Are you sure you want to delete <span className="font-bold text-white">{roomName}</span>?
                </p>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(password); onClose(); setPassword('') }}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Admin Password</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-red-500 outline-none"
                                placeholder="Enter Admin Password"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
