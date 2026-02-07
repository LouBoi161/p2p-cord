import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useAudioActivity } from '../hooks/useAudioActivity'

interface VideoGridProps {
  localStream: MediaStream | null
  localVideoEnabled: boolean
  localUserName: string
  audioOutputDeviceId?: string
  peers: { peerId: string; stream: MediaStream; userName?: string; isVideoEnabled?: boolean }[]
  micGain?: number
  onMicGainChange?: (val: number) => void
  vadThreshold?: number
}

interface VideoCardProps {
  stream: MediaStream | null
  isLocal?: boolean
  peerId?: string
  userName?: string
  isVideoEnabled?: boolean
  audioOutputDeviceId?: string
  onClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  className?: string
  objectFit?: 'contain' | 'cover'
  volume?: number
  vadThreshold?: number
}

const VideoCard = ({
  stream,
  isLocal = false,
  peerId,
  userName,
  isVideoEnabled = true,
  audioOutputDeviceId,
  onClick,
  onContextMenu,
  className = '',
  objectFit = 'cover',
  volume = 1,
  vadThreshold = 0
}: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const effectiveThreshold = isLocal ? vadThreshold : 1
  const isSpeaking = useAudioActivity(stream, effectiveThreshold)
  
  // Audio Processing Refs for Volume Amplification
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  
  // Use a stable identifier for the avatar
  const avatarSeed = userName || peerId || 'default'
  
  const getInitials = (name: string) => {
      const cleanName = name.replace(/[^a-zA-Z0-9 ]/g, '')
      const parts = cleanName.trim().split(/\s+/)
      if (parts.length === 0) return '?'
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
      return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  
  const initials = getInitials(userName || peerId || '?')

  // Handle Audio Processing (Volume > 100%)
  useEffect(() => {
      if (!stream || isLocal) {
          // For local user, we rely on the muted prop and don't process audio to avoid feedback loops
          if (videoRef.current) videoRef.current.srcObject = stream
          return
      }

      if (stream.getAudioTracks().length === 0) {
          if (videoRef.current) videoRef.current.srcObject = stream
          return
      }

      // Initialize Web Audio
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContextClass()
      audioCtxRef.current = ctx
      
      const gain = ctx.createGain()
      gain.gain.value = volume
      gainNodeRef.current = gain
      
      const dest = ctx.createMediaStreamDestination()
      destNodeRef.current = dest
      
      const source = ctx.createMediaStreamSource(stream)
      source.connect(gain)
      gain.connect(dest)
      sourceNodeRef.current = source
      
      // Merge amplified audio with original video
      const processedStream = new MediaStream([
          dest.stream.getAudioTracks()[0],
          ...stream.getVideoTracks()
      ])
      
      if (videoRef.current) {
          videoRef.current.srcObject = processedStream
      }
      
      return () => {
          if (sourceNodeRef.current) sourceNodeRef.current.disconnect()
          if (gainNodeRef.current) gainNodeRef.current.disconnect()
          if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close()
      }
  }, [stream, isLocal]) // Re-run if stream changes

  // Update Gain when volume changes
  useEffect(() => {
      if (gainNodeRef.current) {
          // Smooth transition
          gainNodeRef.current.gain.setTargetAtTime(volume, audioCtxRef.current?.currentTime || 0, 0.1)
      }
  }, [volume])

  useEffect(() => {
      if (videoRef.current && audioOutputDeviceId && (videoRef.current as any).setSinkId) {
          try {
             (videoRef.current as any).setSinkId(audioOutputDeviceId)
          } catch (e) {
              console.error('Failed to set audio output device', e)
          }
      }
  }, [audioOutputDeviceId])

  const showVideo = isVideoEnabled && !!stream
  const activeClass = isSpeaking ? 'border-green-500 ring-2 ring-green-500' : 'border-gray-700'
  const cursorClass = onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-500' : ''

  return (
    <div 
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-lg border transition-all duration-100 ${activeClass} ${cursorClass} flex items-center justify-center ${className || 'aspect-video'}`}
    >
      <div className={`w-full h-full flex items-center justify-center bg-gray-900 ${showVideo ? 'hidden' : 'block'}`}>
          <div className={`w-24 h-24 rounded-full border-4 shadow-md flex items-center justify-center bg-indigo-600 text-white font-bold text-2xl select-none transition-colors duration-100 ${isSpeaking ? 'border-green-500' : 'border-gray-700'}`}>
              {initials}
          </div>
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} 
        className={`w-full h-full object-${objectFit} ${!showVideo ? 'hidden' : 'block'}`}
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm flex items-center gap-2">
        {isLocal ? `You (${userName})` : (userName || `Peer ${peerId?.slice(0, 6)}...`)}
      </div>
    </div>
  )
}

export function VideoGrid({ localStream, localVideoEnabled, localUserName, peers, audioOutputDeviceId, micGain = 1, onMicGainChange, vadThreshold = 0 }: VideoGridProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    peerId: string
    isLocal: boolean
    userName?: string
  } | null>(null)

  // Load volumes from storage
  useEffect(() => {
      const loadVolumes = async () => {
          const saved = localStorage.getItem('p2p-peer-volumes')
          if (saved) {
              try {
                  setVolumes(JSON.parse(saved))
              } catch (e) {
                  console.error("Failed to parse volumes", e)
              }
          }
          
          if (window.electronAPI?.getStoreValue) {
              const stored = await window.electronAPI.getStoreValue('p2p-peer-volumes')
              if (stored && typeof stored === 'object') {
                  setVolumes(prev => ({ ...prev, ...stored }))
              }
          }
      }
      loadVolumes()
  }, [])

  const handleContextMenu = (e: React.MouseEvent, peerId: string, isLocal: boolean, userName?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      peerId,
      isLocal,
      userName
    })
  }

  const handleVolumeChange = (peerId: string, val: number) => {
    setVolumes(prev => {
        const newVolumes = { ...prev, [peerId]: val }
        
        // Save to storage
        localStorage.setItem('p2p-peer-volumes', JSON.stringify(newVolumes))
        if (window.electronAPI?.setStoreValue) {
            window.electronAPI.setStoreValue('p2p-peer-volumes', newVolumes)
        }
        
        return newVolumes
    })
  }

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const focusedData = useMemo(() => {
    if (focusedId === 'local') {
      return {
        stream: localStream,
        userName: localUserName,
        isLocal: true,
        isVideoEnabled: localVideoEnabled,
        peerId: 'local',
        vadThreshold: vadThreshold
      }
    }
    const peer = peers.find(p => p.peerId === focusedId)
    if (peer) {
      return {
        stream: peer.stream,
        userName: peer.userName,
        isLocal: false,
        isVideoEnabled: peer.isVideoEnabled,
        peerId: peer.peerId
      }
    }
    return null
  }, [focusedId, localStream, localUserName, localVideoEnabled, peers, vadThreshold])

  useEffect(() => {
    if (focusedData && overlayRef.current) {
      overlayRef.current.requestFullscreen().catch(err => {
        console.warn("Failed to enter fullscreen:", err)
      })
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.warn("Failed to exit fullscreen:", err)
        })
      }
    }
  }, [focusedData])

  return (
    <>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full h-full content-start overflow-y-auto">
        <VideoCard 
          stream={localStream} 
          isLocal 
          isVideoEnabled={localVideoEnabled}
          userName={localUserName}
          audioOutputDeviceId={audioOutputDeviceId}
          onClick={() => setFocusedId('local')}
          onContextMenu={(e) => handleContextMenu(e, 'local', true, localUserName)}
          volume={volumes['local'] ?? 1}
          vadThreshold={vadThreshold}
        />
        {peers.map(peer => (
          <VideoCard 
            key={peer.peerId} 
            stream={peer.stream} 
            peerId={peer.peerId} 
            userName={peer.userName}
            isVideoEnabled={peer.isVideoEnabled}
            audioOutputDeviceId={audioOutputDeviceId}
            onClick={() => setFocusedId(peer.peerId)}
            onContextMenu={(e) => handleContextMenu(e, peer.peerId, false, peer.userName)}
            volume={volumes[peer.peerId] ?? 1}
          />
        ))}
        {peers.length === 0 && !localStream && (
          <div className="col-span-full flex items-center justify-center h-64 text-gray-500 hidden">
             {/* Fallback hidden because we always show local user now */}
          </div>
        )}
      </div>

      {focusedData && (
        <div 
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setFocusedId(null)}
          onContextMenu={(e) => {
             // Allow context menu in fullscreen too
             if (focusedData.peerId) {
                 handleContextMenu(e, focusedData.peerId, focusedData.isLocal || false, focusedData.userName)
             }
          }}
        >
          <div 
            className="w-full h-full relative"
            onClick={e => e.stopPropagation()}
          >
            <VideoCard 
              {...focusedData}
              audioOutputDeviceId={audioOutputDeviceId}
              className="w-full h-full"
              objectFit="contain"
              volume={volumes[focusedData.peerId || ''] ?? 1}
            />
            <button 
              onClick={() => setFocusedId(null)}
              className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors shadow-lg z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {contextMenu && contextMenu.visible && (
        <div 
            className="fixed z-[100] bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 w-64 text-sm text-white"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="font-bold mb-2 pb-2 border-b border-gray-700 truncate">
                {contextMenu.isLocal ? 'You (Input Gain)' : contextMenu.userName || 'Peer'}
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-bold uppercase">
                    {contextMenu.isLocal ? 'Gain' : 'Volume'}
                </label>
                <div className="flex items-center gap-3">
                    <input 
                        type="range" 
                        min="0" 
                        max="5"
                        step="0.01"
                        value={contextMenu.isLocal ? micGain : (volumes[contextMenu.peerId] ?? 1)}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            if (contextMenu.isLocal && onMicGainChange) {
                                onMicGainChange(val)
                            }
                        }}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="w-12 text-right font-mono text-xs text-gray-300">
                        {Math.round((contextMenu.isLocal ? micGain : (volumes[contextMenu.peerId] ?? 1)) * 100)}%
                    </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-600 mt-1 px-1">
                    <span>{contextMenu.isLocal ? '0%' : 'Mute'}</span>
                    <span>250%</span>
                    <span>500%</span>
                </div>
            </div>
        </div>
      )}
    </>
  )
}
