import React, { useState, useEffect, useRef } from 'react'
import { X, Mic, Video, User } from 'lucide-react'

// Simple hook reimplementation for inside modal if needed, or pass stream and use existing hook?
// Better to re-use existing hook logic or just replicate for a simple visualizer.
// Since we can't easily import the hook here without prop drilling the hook result or stream, 
// let's assume we pass the stream to the modal.

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  onUpdateUserName: (name: string) => void
  devices: MediaDeviceInfo[]
  selectedAudioDevice: string
  selectedAudioOutputDevice: string
  selectedVideoDevice: string
  onDeviceChange: (deviceId: string, kind: 'audioinput' | 'videoinput' | 'audiooutput') => void
  localStream: MediaStream | null
}

function VolumeMeter({ stream }: { stream: MediaStream | null }) {
    const [volume, setVolume] = useState(0)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const reqRef = useRef<number | null>(null)

    const [ctxState, setCtxState] = useState<string>('unknown')
    const [trackInfo, setTrackInfo] = useState<string>('')

    useEffect(() => {
        if (!stream) {
            console.log("VolumeMeter: No stream provided")
            setVolume(0)
            setTrackInfo('No Stream (Check Cam/Mic)')
            setCtxState('Idle')
            return
        }

        const audioTracks = stream.getAudioTracks()
        console.log("VolumeMeter: Stream tracks:", audioTracks.length, audioTracks)
        if (audioTracks.length > 0) {
             const track = audioTracks[0]
             setTrackInfo(`Track: ${track.label} | Muted: ${track.muted} | Enabled: ${track.enabled} | State: ${track.readyState}`)
             
             track.onmute = () => setTrackInfo(prev => prev + ' (Muted event)')
             track.onunmute = () => setTrackInfo(prev => prev + ' (Unmuted event)')
             track.onended = () => setTrackInfo(prev => prev + ' (Ended event)')
        } else {
             setTrackInfo('No Audio Tracks')
        }

        const init = async () => {
             const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
             if (!AudioContextClass) {
                 console.error("VolumeMeter: AudioContext not supported")
                 setCtxState('Not Supported')
                 return
             }
             
             const ctx = new AudioContextClass()
             setCtxState(ctx.state)
             
             const resumeCtx = async () => {
                if (ctx.state === 'suspended') {
                    try {
                        await ctx.resume()
                        console.log("VolumeMeter: AudioContext resumed, state:", ctx.state)
                        setCtxState(ctx.state)
                    } catch (e) {
                        console.error("VolumeMeter: Failed to resume AudioContext", e)
                    }
                }
             }
             
             await resumeCtx()
             // Add listener for state change
             ctx.onstatechange = () => setCtxState(ctx.state)

             audioContextRef.current = ctx

             const analyser = ctx.createAnalyser()
             analyser.fftSize = 256
             analyserRef.current = analyser

             try {
                 const source = ctx.createMediaStreamSource(stream)
                 source.connect(analyser)
                 sourceRef.current = source
                 console.log("VolumeMeter: MediaStreamSource connected")
             } catch (e) {
                 console.error("VolumeMeter: Failed to create MediaStreamSource", e)
             }

             const data = new Uint8Array(analyser.frequencyBinCount)
             
             const tick = () => {
                 analyser.getByteFrequencyData(data)
                 let sum = 0
                 for(let i=0; i<data.length; i++) sum += data[i]
                 const avg = sum / data.length
                 
                 setVolume(avg)
                 reqRef.current = requestAnimationFrame(tick)
             }
             tick()
        }
        init()

        return () => {
            if (reqRef.current) cancelAnimationFrame(reqRef.current)
            if (sourceRef.current) sourceRef.current.disconnect()
            if (audioContextRef.current) audioContextRef.current.close()
        }
    }, [stream])

    // Scale volume 0-255 roughly to percentage 0-100
    // Usually voice is lower, so let's amplify visualization
    const percent = Math.min(100, Math.max(0, volume * 2)) 

    return (
        <div className="flex flex-col gap-1">
            <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden mt-2 border border-gray-700">
                <div 
                    className="h-full bg-green-500 transition-all duration-75 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <div className="text-[10px] text-gray-600 flex justify-between">
                <span>Ctx: {ctxState}</span>
                <span>{trackInfo}</span>
            </div>
             {ctxState === 'suspended' && (
                <button 
                    onClick={() => audioContextRef.current?.resume()}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline text-left"
                >
                    Resume Audio Context
                </button>
            )}
        </div>
    )
}

export function SettingsModal({
  isOpen,
  onClose,
  userName,
  onUpdateUserName,
  devices,
  selectedAudioDevice,
  selectedAudioOutputDevice,
  selectedVideoDevice,
  onDeviceChange,
  localStream
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'voice' | 'video'>('profile')
  const [tempName, setTempName] = useState(userName)

  if (!isOpen) return null

  const audioDevices = devices.filter(d => d.kind === 'audioinput')
  const audioOutputDevices = devices.filter(d => d.kind === 'audiooutput')
  const videoDevices = devices.filter(d => d.kind === 'videoinput')

  const handleNameSave = () => {
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim())
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[800px] h-[600px] bg-gray-900 rounded-lg shadow-2xl flex overflow-hidden border border-gray-800">
        
        {/* Sidebar */}
        <div className="w-60 bg-gray-950 p-4 flex flex-col gap-2 border-r border-gray-800">
          <div className="text-xs font-bold text-gray-500 uppercase px-2 mb-2">User Settings</div>
          
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'profile' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <User size={18} />
            My Account
          </button>
          
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'voice' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Mic size={18} />
            Voice
          </button>
          
          <button
            onClick={() => setActiveTab('video')}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'video' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Video size={18} />
            Video
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
          <div className="flex items-center justify-between p-6 pb-0">
            <h2 className="text-xl font-bold text-white">
              {activeTab === 'profile' && 'My Account'}
              {activeTab === 'voice' && 'Voice Settings'}
              {activeTab === 'video' && 'Video Settings'}
            </h2>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors flex flex-col items-center"
            >
              <X size={24} />
              <span className="text-[10px] font-bold mt-1">ESC</span>
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                 <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-2xl font-bold">
                                {tempName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="text-sm text-gray-400 font-medium">USERNAME</div>
                                <input 
                                    type="text" 
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    className="bg-transparent text-white font-medium text-lg outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleNameSave}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-medium transition-colors"
                        >
                            Save Changes
                        </button>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Input Device</label>
                    <div className="relative">
                        <select 
                            value={selectedAudioDevice}
                            onChange={(e) => onDeviceChange(e.target.value, 'audioinput')}
                            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 outline-none focus:border-indigo-500 appearance-none"
                        >
                            {audioDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                            {audioDevices.length === 0 && <option value="">Default Microphone</option>}
                        </select>
                    </div>
                    
                    <div className="mt-4">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Mic Test</label>
                        <p className="text-xs text-gray-500 mb-1">Speak into your microphone to test.</p>
                        <VolumeMeter stream={localStream} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Output Device</label>
                    <div className="relative">
                        <select 
                            value={selectedAudioOutputDevice}
                            onChange={(e) => onDeviceChange(e.target.value, 'audiooutput')}
                            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 outline-none focus:border-indigo-500 appearance-none"
                        >
                            {audioOutputDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                            {audioOutputDevices.length === 0 && <option value="">Default Speaker</option>}
                        </select>
                    </div>

                    <div className="mt-4">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Speaker Test</label>
                         <button
                            onClick={async () => {
                                const audio = new Audio()
                                // Simple beep using a data URI (100ms sine wave 440Hz)
                                audio.src = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + 'A'.repeat(100) // Placeholder invalid, let's use a real oscillator
                                
                                // Better: Use AudioContext to generate a beep and route it
                                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
                                const ctx = new AudioContextClass()
                                const osc = ctx.createOscillator()
                                const dest = ctx.createMediaStreamDestination()
                                osc.connect(dest)
                                osc.start()
                                osc.stop(ctx.currentTime + 0.5) // 0.5 seconds beep
                                
                                const audioEl = new Audio()
                                audioEl.srcObject = dest.stream
                                if (selectedAudioOutputDevice && (audioEl as any).setSinkId) {
                                    try {
                                        await (audioEl as any).setSinkId(selectedAudioOutputDevice)
                                    } catch (e) {
                                        console.error("Failed to set sinkId", e)
                                    }
                                }
                                audioEl.play()
                            }}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors border border-gray-700"
                        >
                            Play Test Sound
                        </button>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
               <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Camera</label>
                    <div className="relative">
                        <select 
                            value={selectedVideoDevice}
                            onChange={(e) => onDeviceChange(e.target.value, 'videoinput')}
                            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 outline-none focus:border-indigo-500 appearance-none"
                        >
                            {videoDevices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                                </option>
                            ))}
                            {videoDevices.length === 0 && <option value="">Default Camera</option>}
                        </select>
                    </div>
                </div>
                
                <div className="bg-gray-950 rounded-lg p-4 aspect-video flex items-center justify-center border border-gray-800 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
                        Video Preview Area
                    </div>
                    {/* We could potentially show a local preview here if we passed the stream down */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
