import React, { useEffect, useRef } from 'react'
import { useAudioActivity } from '../hooks/useAudioActivity'

interface VideoGridProps {
  localStream: MediaStream | null
  localVideoEnabled: boolean
  localUserName: string
  audioOutputDeviceId?: string
  peers: { peerId: string; stream: MediaStream; userName?: string; isVideoEnabled?: boolean }[]
}

const VideoCard = ({ stream, isLocal = false, peerId, userName, isVideoEnabled = true, audioOutputDeviceId }: { stream: MediaStream | null; isLocal?: boolean, peerId?: string, userName?: string, isVideoEnabled?: boolean, audioOutputDeviceId?: string }) => {
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

  return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden aspect-video shadow-lg border transition-all duration-100 ${activeClass} flex items-center justify-center`}>
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
        className={`w-full h-full object-cover ${!showVideo ? 'hidden' : 'block'}`}
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm flex items-center gap-2">
        {isLocal ? `You (${userName})` : (userName || `Peer ${peerId?.slice(0, 6)}...`)}
      </div>
    </div>
  )
}

export function VideoGrid({ localStream, localVideoEnabled, localUserName, peers, audioOutputDeviceId }: VideoGridProps) {
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full h-full content-start overflow-y-auto">
      <VideoCard 
        stream={localStream} 
        isLocal 
        isVideoEnabled={localVideoEnabled}
        userName={localUserName}
        audioOutputDeviceId={audioOutputDeviceId}
      />
      {peers.map(peer => (
        <VideoCard 
          key={peer.peerId} 
          stream={peer.stream} 
          peerId={peer.peerId} 
          userName={peer.userName}
          isVideoEnabled={peer.isVideoEnabled}
          audioOutputDeviceId={audioOutputDeviceId}
        />
      ))}
      {peers.length === 0 && !localStream && (
        <div className="col-span-full flex items-center justify-center h-64 text-gray-500 hidden">
           {/* Fallback hidden because we always show local user now */}
        </div>
      )}
    </div>
  )
}
