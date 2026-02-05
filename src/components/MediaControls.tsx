import React from 'react'
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff } from 'lucide-react'

interface MediaControlsProps {
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleScreenShare: () => void
  onLeave: () => void
}

export function MediaControls({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave
}: MediaControlsProps) {
  return (
    <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-4 px-4 z-20">
      <button
        onClick={onToggleAudio}
        className={`p-3 rounded-full transition-colors ${
          isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
        }`}
        title={isAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
      >
        {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
      </button>

      <button
        onClick={onToggleVideo}
        className={`p-3 rounded-full transition-colors ${
          isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
        }`}
        title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
      >
        {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
      </button>

      <button
        onClick={onToggleScreenShare}
        className={`p-3 rounded-full transition-colors ${
          isScreenSharing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
        }`}
        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
      >
        <Monitor size={24} />
      </button>

      <button
        onClick={onLeave}
        className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
        title="Disconnect"
      >
        <PhoneOff size={24} />
      </button>
    </div>
  )
}
