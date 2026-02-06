import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useAudioActivity } from '../hooks/useAudioActivity'

interface VideoGridProps {
  localStream: MediaStream | null
  localVideoEnabled: boolean
  localUserName: string
  audioOutputDeviceId?: string
  peers: { peerId: string; stream: MediaStream; userName?: string; isVideoEnabled?: boolean }[]
}

interface VideoCardProps {
  stream: MediaStream | null
  isLocal?: boolean
  peerId?: string
  userName?: string
  isVideoEnabled?: boolean
  audioOutputDeviceId?: string
  onClick?: () => void
  className?: string
  objectFit?: 'contain' | 'cover'
}

const VideoCard = ({ 
  stream, 
  isLocal = false, 
  peerId, 
  userName, 
  isVideoEnabled = true, 
  audioOutputDeviceId,
  onClick,
  className = '',
  objectFit = 'cover'
}: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isSpeaking = useAudioActivity(stream)
  
  // Use a stable identifier for the avatar (userName or peerId)
  const avatarSeed = userName || peerId || 'default'
  const avatarUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=555555,777777`

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

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
      className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-lg border transition-all duration-100 ${activeClass} ${cursorClass} flex items-center justify-center ${className || 'aspect-video'}`}
    >
      <div className={`w-full h-full flex items-center justify-center bg-gray-900 ${showVideo ? 'hidden' : 'block'}`}>
          <img 
            src={avatarUrl} 
            alt={userName} 
            className={`w-24 h-24 rounded-full border-4 shadow-md transition-colors duration-100 ${isSpeaking ? 'border-green-500' : 'border-gray-700'}`}
          />
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Mute local video to avoid feedback
        className={`w-full h-full object-${objectFit} ${!showVideo ? 'hidden' : 'block'}`}
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm flex items-center gap-2">
        {isLocal ? `You (${userName})` : (userName || `Peer ${peerId?.slice(0, 6)}...`)}
      </div>
    </div>
  )
}

export function VideoGrid({ localStream, localVideoEnabled, localUserName, peers, audioOutputDeviceId }: VideoGridProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const focusedData = useMemo(() => {
    if (focusedId === 'local') {
      return {
        stream: localStream,
        userName: localUserName,
        isLocal: true,
        isVideoEnabled: localVideoEnabled,
        peerId: 'local'
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
  }, [focusedId, localStream, localUserName, localVideoEnabled, peers])

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
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 md:p-8"
          onClick={() => setFocusedId(null)}
        >
          <div 
            className="w-full h-full max-w-7xl relative"
            onClick={e => e.stopPropagation()}
          >
            <VideoCard 
              {...focusedData}
              audioOutputDeviceId={audioOutputDeviceId}
              className="w-full h-full"
              objectFit="contain"
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
    </>
  )
}
