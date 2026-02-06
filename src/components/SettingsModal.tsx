import React, { useState, useEffect, useRef } from 'react'
import { X, Mic, Video, User, Activity } from 'lucide-react'

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
  // Bitrate settings (in kbps)
  cameraBitrate: number
  setCameraBitrate: (val: number) => void
  screenBitrate: number
  setScreenBitrate: (val: number) => void
  audioBitrate: number
  setAudioBitrate: (val: number) => void
  // Incoming settings
  cameraBitrateIncoming: number
  setCameraBitrateIncoming: (val: number) => void
  screenBitrateIncoming: number
  setScreenBitrateIncoming: (val: number) => void
  audioBitrateIncoming: number
  setAudioBitrateIncoming: (val: number) => void
  // Voice Processing
  noiseSuppression: boolean
  setNoiseSuppression: (val: boolean) => void
  echoCancellation: boolean
  setEchoCancellation: (val: boolean) => void
  autoGainControl: boolean
  setAutoGainControl: (val: boolean) => void
  vadThreshold: number
  setVadThreshold: (val: number) => void
}

function VolumeMeter({ stream, vadThreshold, onChangeVadThreshold }: { 
    stream: MediaStream | null,
    vadThreshold: number,
    onChangeVadThreshold: (val: number) => void
}) {
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
    // Usually voice is lower, so let's amplify visualization slightly
    const percent = Math.min(100, Math.max(0, volume * 1.5)) 

    return (
        <div className="flex flex-col gap-1">
             <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Input Sensitivity & Gate</label>
                <span className="text-xs font-mono bg-gray-900 px-2 py-0.5 rounded text-gray-400">
                    {vadThreshold === 0 ? "OPEN" : `${vadThreshold}%`}
                </span>
            </div>

            <div className="relative w-full h-8 bg-gray-950 rounded overflow-hidden border border-gray-700 cursor-pointer group">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gray-900" />
                
                {/* Visualizer Bar */}
                <div 
                    className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-75 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                    style={{ width: `${percent}%` }}
                />

                {/* Gate Threshold Overlay (Darken area below threshold) */}
                 <div 
                    className="absolute top-0 left-0 h-full bg-black/60 z-10 pointer-events-none transition-all duration-75"
                    style={{ width: `${vadThreshold}%` }}
                />

                {/* Threshold Line Marker */}
                 <div 
                    className="absolute top-0 h-full w-1 bg-white z-20 pointer-events-none shadow-[0_0_5px_rgba(255,255,255,0.8)]"
                    style={{ left: `${vadThreshold}%` }}
                />

                {/* Interactive Slider */}
                <input 
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={vadThreshold}
                    onChange={(e) => onChangeVadThreshold(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                    title="Adjust Voice Gate Threshold"
                />
            </div>
            
            <div className="flex justify-between text-[10px] text-gray-500">
                <span>Always Open</span>
                <span className="text-center">{trackInfo ? 'Device Ready' : 'Initializing...'}</span>
                <span>Strict Gate</span>
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
  localStream,
  cameraBitrate,
  setCameraBitrate,
  screenBitrate,
  setScreenBitrate,
  audioBitrate,
  setAudioBitrate,
  cameraBitrateIncoming,
  setCameraBitrateIncoming,
  screenBitrateIncoming,
  setScreenBitrateIncoming,
  audioBitrateIncoming,
  setAudioBitrateIncoming,
  noiseSuppression,
  setNoiseSuppression,
  echoCancellation,
  setEchoCancellation,
  autoGainControl,
  setAutoGainControl,
  vadThreshold,
  setVadThreshold
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'voice' | 'video' | 'quality'>('profile')
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

          <button
            onClick={() => setActiveTab('quality')}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === 'quality' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Activity size={18} />
            Quality / Data
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
          <div className="flex items-center justify-between p-6 pb-0">
            <h2 className="text-xl font-bold text-white">
              {activeTab === 'profile' && 'My Account'}
              {activeTab === 'voice' && 'Voice Settings'}
              {activeTab === 'video' && 'Video Settings'}
              {activeTab === 'quality' && 'Connection Quality'}
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
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Mic Test & Gate</label>
                        <p className="text-xs text-gray-500 mb-1">Speak to test. Adjust the slider to set the open gate threshold.</p>
                        <VolumeMeter 
                            stream={localStream} 
                            vadThreshold={vadThreshold}
                            onChangeVadThreshold={setVadThreshold}
                        />
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 border-b border-gray-700 pb-2">Voice Processing</h3>
                    
                    <div className="space-y-4">
                        <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={noiseSuppression} 
                                onChange={(e) => setNoiseSuppression(e.target.checked)}
                                className="w-5 h-5 rounded accent-indigo-500 bg-gray-700 border-gray-600"
                            />
                            <div>
                                <div className="font-bold text-sm">Noise Suppression</div>
                                <div className="text-xs text-gray-500">Reduces background noise and static</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={echoCancellation} 
                                onChange={(e) => setEchoCancellation(e.target.checked)}
                                className="w-5 h-5 rounded accent-indigo-500 bg-gray-700 border-gray-600"
                            />
                            <div>
                                <div className="font-bold text-sm">Echo Cancellation</div>
                                <div className="text-xs text-gray-500">Prevents others from hearing themselves</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={autoGainControl} 
                                onChange={(e) => setAutoGainControl(e.target.checked)}
                                className="w-5 h-5 rounded accent-indigo-500 bg-gray-700 border-gray-600"
                            />
                            <div>
                                <div className="font-bold text-sm">Auto Gain Control</div>
                                <div className="text-xs text-gray-500">Automatically adjusts microphone volume</div>
                            </div>
                        </label>
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
                                {videoDevices.length === 0 && <option value="">No Cameras Found</option>}
                            </select>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold text-sm">Camera Bitrate (Outgoing)</label>
                            <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded text-gray-400">{cameraBitrate} kbps</span>
                        </div>
                        <input 
                            type="range" 
                            min="100" 
                            max="5000" 
                            step="100"
                            value={cameraBitrate}
                            onChange={(e) => setCameraBitrate(Number(e.target.value))}
                            className="w-full accent-indigo-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            )}

            {activeTab === 'quality' && (
                <div className="space-y-6">
                     <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                        <h4 className="font-bold text-blue-400 mb-2">Connection Settings</h4>
                        <p className="text-sm text-gray-300">
                            Adjust these settings if you are experiencing lag or poor quality. Lower bitrates reduce bandwidth usage.
                        </p>
                    </div>

                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold text-sm">Screen Share Bitrate</label>
                            <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded text-gray-400">{screenBitrate} kbps</span>
                        </div>
                        <input 
                            type="range" 
                            min="500" 
                            max="8000" 
                            step="500"
                            value={screenBitrate}
                            onChange={(e) => setScreenBitrate(Number(e.target.value))}
                            className="w-full accent-indigo-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-bold text-sm">Audio Bitrate</label>
                            <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded text-gray-400">{audioBitrate} kbps</span>
                        </div>
                        <input 
                            type="range" 
                            min="16" 
                            max="256" 
                            step="16"
                            value={audioBitrate}
                            onChange={(e) => setAudioBitrate(Number(e.target.value))}
                            className="w-full accent-indigo-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
