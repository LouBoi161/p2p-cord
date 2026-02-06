import React, { useState } from 'react'
import { X, Monitor, AppWindow } from 'lucide-react'

export interface ScreenSource {
  id: string
  name: string
  thumbnail: string // Data URL
  display_id: string
  appIcon?: string // Data URL
}

interface ScreenShareModalProps {
  isOpen: boolean
  sources: ScreenSource[]
  onSelect: (sourceId: string) => void
  onCancel: () => void
}

export function ScreenShareModal({ isOpen, sources, onSelect, onCancel }: ScreenShareModalProps) {
  const [activeTab, setActiveTab] = useState<'screens' | 'windows'>('screens')

  if (!isOpen) return null

  const screens = sources.filter(s => s.id.startsWith('screen'))
  const windows = sources.filter(s => s.id.startsWith('window'))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[800px] h-[600px] bg-gray-900 rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-800 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-800">
            <div>
                 <h2 className="text-xl font-bold text-white">Share Your Screen</h2>
                 <p className="text-sm text-gray-400">Select a screen or window to stream to the room.</p>
            </div>
            <button 
              onClick={onCancel}
              className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 gap-6 border-b border-gray-800">
             <button
                onClick={() => setActiveTab('screens')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'screens' 
                    ? 'border-indigo-500 text-white' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Monitor size={18} />
                Screens
              </button>
              <button
                onClick={() => setActiveTab('windows')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'windows' 
                    ? 'border-indigo-500 text-white' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <AppWindow size={18} />
                Applications
              </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-950/50">
             <div className="grid grid-cols-2 gap-4">
                 {(activeTab === 'screens' ? screens : windows).map(source => (
                     <button
                        key={source.id}
                        onClick={() => onSelect(source.id)}
                        className="group relative bg-gray-900 rounded-lg border border-gray-800 hover:border-indigo-500 overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-500/10 text-left flex flex-col"
                     >
                        <div className="aspect-video bg-gray-950 w-full relative border-b border-gray-800">
                             <img 
                                src={source.thumbnail} 
                                alt={source.name} 
                                className="w-full h-full object-contain"
                             />
                             {source.appIcon && (
                                 <div className="absolute bottom-2 right-2 w-8 h-8 rounded bg-gray-900 p-1 shadow border border-gray-800">
                                     <img src={source.appIcon} className="w-full h-full object-contain" />
                                 </div>
                             )}
                        </div>
                        <div className="p-3">
                             <div className="font-medium text-gray-200 truncate pr-2" title={source.name}>
                                 {source.name}
                             </div>
                             <div className="text-xs text-gray-500 mt-0.5 font-mono">
                                 {source.id.split(':')[0]}
                             </div>
                        </div>
                     </button>
                 ))}

                 {(activeTab === 'screens' ? screens : windows).length === 0 && (
                     <div className="col-span-2 py-12 flex flex-col items-center justify-center text-gray-500">
                         <div className="mb-2">
                             {activeTab === 'screens' ? <Monitor size={48} className="opacity-20" /> : <AppWindow size={48} className="opacity-20" />}
                         </div>
                         <p>No {activeTab} found.</p>
                     </div>
                 )}
             </div>
        </div>
      </div>
    </div>
  )
}
