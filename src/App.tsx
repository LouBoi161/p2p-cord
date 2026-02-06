import React, { useState, useEffect, useRef } from 'react'
import { Sidebar } from './components/Sidebar'
import { VideoGrid } from './components/VideoGrid'
import { MediaControls } from './components/MediaControls'
import { SettingsModal } from './components/SettingsModal'
import { ScreenShareModal, ScreenSource } from './components/ScreenShareModal'
import SimplePeer from 'simple-peer'

// Types
type PeerData = {
  peerId: string
  peer: SimplePeer.Instance
  stream?: MediaStream
  userName?: string
  isVideoEnabled?: boolean
}

function App() {
  const [rooms, setRooms] = useState<string[]>([])
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map())
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('p2p-username') || `User ${Math.floor(Math.random() * 1000)}`
  })
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>(() => localStorage.getItem('p2p-audio-input') || '')
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState<string>(() => localStorage.getItem('p2p-audio-output') || '')
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>(() => localStorage.getItem('p2p-video-input') || '')
  
  // Screen Share State
  const [isScreenShareModalOpen, setIsScreenShareModalOpen] = useState(false)
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([])
  
  // Media States
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quality Settings State
  const [cameraBitrate, setCameraBitrate] = useState<number>(1500)
  const [screenBitrate, setScreenBitrate] = useState<number>(4000)
  const [audioBitrate, setAudioBitrate] = useState<number>(64)

  const [cameraBitrateIncoming, setCameraBitrateIncoming] = useState<number>(1500)
  const [screenBitrateIncoming, setScreenBitrateIncoming] = useState<number>(4000)
  const [audioBitrateIncoming, setAudioBitrateIncoming] = useState<number>(64)
  
  // Voice Processing State
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [autoGainControl, setAutoGainControl] = useState(true)
  const [vadThreshold, setVadThreshold] = useState(0)
  
  // Microphone Gain
  const [micGain, setMicGain] = useState<number>(1)

  // We need a force update because Map mutation doesn't trigger re-render
  const [, setForceUpdate] = useState(0)

  const peersRef = useRef<Map<string, PeerData>>(new Map())
  const peerPreferencesRef = useRef<Map<string, { camera: number, screen: number, audio: number }>>(new Map())
  const cameraStreamRef = useRef<MediaStream | null>(null) // Stores the original webcam stream
  const activeStreamRef = useRef<MediaStream | null>(null) // Stores the currently being sent stream (cam or screen)
  
  // Audio Processing Refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const userNameRef = useRef(userName)
  const isVideoEnabledRef = useRef(isVideoEnabled)
  const isScreenSharingRef = useRef(isScreenSharing)
  
  const selectedAudioDeviceRef = useRef(selectedAudioDevice)
  const selectedVideoDeviceRef = useRef(selectedVideoDevice)
  const selectedAudioOutputDeviceRef = useRef(selectedAudioOutputDevice)
  
  // Refs for bitrate to access in callbacks without deps
  const bitratesOutgoingRef = useRef({ camera: 1500, screen: 4000, audio: 64 })
  const bitratesIncomingRef = useRef({ camera: 1500, screen: 4000, audio: 64 })

  useEffect(() => {
      if (gainNodeRef.current) {
          try {
            gainNodeRef.current.gain.setTargetAtTime(micGain, audioContextRef.current?.currentTime || 0, 0.1)
          } catch(e) {
             console.error("Failed to set gain", e)
          }
      }
  }, [micGain])

  useEffect(() => {
    localStorage.setItem('p2p-username', userName)
    if (window.electronAPI?.setStoreValue) {
        window.electronAPI.setStoreValue('p2p-username', userName)
    }
    userNameRef.current = userName
  }, [userName])

  useEffect(() => {
      isVideoEnabledRef.current = isVideoEnabled
  }, [isVideoEnabled])

  useEffect(() => {
      isScreenSharingRef.current = isScreenSharing
      applyBitrateSettings()
  }, [isScreenSharing])
  
  useEffect(() => {
      selectedAudioDeviceRef.current = selectedAudioDevice
      selectedVideoDeviceRef.current = selectedVideoDevice
      selectedAudioOutputDeviceRef.current = selectedAudioOutputDevice
  }, [selectedAudioDevice, selectedVideoDevice, selectedAudioOutputDevice])

  useEffect(() => {
      bitratesOutgoingRef.current = { camera: cameraBitrate, screen: screenBitrate, audio: audioBitrate }
      
      // Save settings
      localStorage.setItem('p2p-bitrate-camera', String(cameraBitrate))
      localStorage.setItem('p2p-bitrate-screen', String(screenBitrate))
      localStorage.setItem('p2p-bitrate-audio', String(audioBitrate))

      if (window.electronAPI?.setStoreValue) {
          window.electronAPI.setStoreValue('p2p-bitrate-camera', cameraBitrate)
          window.electronAPI.setStoreValue('p2p-bitrate-screen', screenBitrate)
          window.electronAPI.setStoreValue('p2p-bitrate-audio', audioBitrate)
      }

      // Apply to existing connections
      applyBitrateSettings()
  }, [cameraBitrate, screenBitrate, audioBitrate])

  useEffect(() => {
      bitratesIncomingRef.current = { camera: cameraBitrateIncoming, screen: screenBitrateIncoming, audio: audioBitrateIncoming }

      // Save settings
      localStorage.setItem('p2p-bitrate-camera-in', String(cameraBitrateIncoming))
      localStorage.setItem('p2p-bitrate-screen-in', String(screenBitrateIncoming))
      localStorage.setItem('p2p-bitrate-audio-in', String(audioBitrateIncoming))

      if (window.electronAPI?.setStoreValue) {
          window.electronAPI.setStoreValue('p2p-bitrate-camera-in', cameraBitrateIncoming)
          window.electronAPI.setStoreValue('p2p-bitrate-screen-in', screenBitrateIncoming)
          window.electronAPI.setStoreValue('p2p-bitrate-audio-in', audioBitrateIncoming)
      }

      // Broadcast preferences because my incoming requirements changed
      broadcastBitratePreferences()
  }, [cameraBitrateIncoming, screenBitrateIncoming, audioBitrateIncoming])

  useEffect(() => {
    const loadSettings = async () => {
        // Fallback or initial load from localStorage
        const savedRooms = JSON.parse(localStorage.getItem('p2p-rooms') || '[]')
        setRooms(savedRooms)

        setCameraBitrate(Number(localStorage.getItem('p2p-bitrate-camera')) || 1500)
        setScreenBitrate(Number(localStorage.getItem('p2p-bitrate-screen')) || 4000)
        setAudioBitrate(Number(localStorage.getItem('p2p-bitrate-audio')) || 64)

        setCameraBitrateIncoming(Number(localStorage.getItem('p2p-bitrate-camera-in')) || 1500)
        setScreenBitrateIncoming(Number(localStorage.getItem('p2p-bitrate-screen-in')) || 4000)
        setAudioBitrateIncoming(Number(localStorage.getItem('p2p-bitrate-audio-in')) || 64)

        if (!window.electronAPI) {
            console.error("Electron API missing")
            return
        }

        // Load from robust Electron store
        if (window.electronAPI?.getStoreValue) {
            let storedRooms = await window.electronAPI.getStoreValue('p2p-rooms')
            
            // Migration: If store is empty but we have local rooms, save them!
            if ((!storedRooms || !Array.isArray(storedRooms) || storedRooms.length === 0) && savedRooms.length > 0) {
                 await window.electronAPI.setStoreValue('p2p-rooms', savedRooms)
                 storedRooms = savedRooms
            }

            if (storedRooms && Array.isArray(storedRooms)) setRooms(storedRooms)

            const storedUser = await window.electronAPI.getStoreValue('p2p-username')
            if (storedUser) setUserName(storedUser)
            
            const aIn = await window.electronAPI.getStoreValue('p2p-audio-input')
            if (aIn) setSelectedAudioDevice(aIn)

            const vIn = await window.electronAPI.getStoreValue('p2p-video-input')
            if (vIn) setSelectedVideoDevice(vIn)

            const aOut = await window.electronAPI.getStoreValue('p2p-audio-output')
            if (aOut) setSelectedAudioOutputDevice(aOut)

            const camRate = await window.electronAPI.getStoreValue('p2p-bitrate-camera')
            if (camRate) setCameraBitrate(camRate)

            const scrRate = await window.electronAPI.getStoreValue('p2p-bitrate-screen')
            if (scrRate) setScreenBitrate(scrRate)

            const audRate = await window.electronAPI.getStoreValue('p2p-bitrate-audio')
            if (audRate) setAudioBitrate(audRate)

            const camRateIn = await window.electronAPI.getStoreValue('p2p-bitrate-camera-in')
            if (camRateIn) setCameraBitrateIncoming(camRateIn)

            const scrRateIn = await window.electronAPI.getStoreValue('p2p-bitrate-screen-in')
            if (scrRateIn) setScreenBitrateIncoming(scrRateIn)

            const audRateIn = await window.electronAPI.getStoreValue('p2p-bitrate-audio-in')
            if (audRateIn) setAudioBitrateIncoming(audRateIn)
        }
    }
    loadSettings()
    
    // Load devices
    loadDevices()
    navigator.mediaDevices.addEventListener('devicechange', loadDevices)

    // Electron listeners
    window.electronAPI.onPeerConnected((_event, { peerId, initiator }) => {
      createPeer(peerId, initiator)
    })

    window.electronAPI.onPeerData((_event, { peerId, message }) => {
      const peerData = peersRef.current.get(peerId)
      if (peerData) {
        peerData.peer.signal(JSON.parse(message))
      }
    })

    window.electronAPI.onPeerDisconnected((_event, peerId) => {
      const peerData = peersRef.current.get(peerId)
      if (peerData) {
        peerData.peer.destroy()
        peersRef.current.delete(peerId)
        peerPreferencesRef.current.delete(peerId)
        updatePeers()
      }
    })
    
    // Screen Share Picker Listener
    if (window.electronAPI.onGetScreenSources) {
        window.electronAPI.onGetScreenSources((_event, sources) => {
            console.log("Received screen sources", sources.length)
            setScreenSources(sources)
            setIsScreenShareModalOpen(true)
        })
    }
    
    return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
    }
  }, [])

  const broadcastBitratePreferences = () => {
      const prefs = {
          type: 'bitrate-pref',
          camera: bitratesIncomingRef.current.camera,
          screen: bitratesIncomingRef.current.screen,
          audio: bitratesIncomingRef.current.audio
      }
      const msg = JSON.stringify(prefs)
      peersRef.current.forEach(p => {
          if (p.peer.connected) {
              try { p.peer.send(msg) } catch (e) { console.error('Failed to send prefs', e)}
          }
      })
  }

  const applyBitrateSettings = () => {
      peersRef.current.forEach((p, peerId) => {
          const peer = p.peer as any
          if (!peer._pc) return

          const senders = peer._pc.getSenders() as RTCRtpSender[]
          const peerPrefs = peerPreferencesRef.current.get(peerId)

          senders.forEach(sender => {
              if (!sender.track) return

              const params = sender.getParameters()
              if (!params.encodings) params.encodings = [{}]

              let limit = Infinity
              
              if (sender.track.kind === 'audio') {
                  const myLimit = bitratesOutgoingRef.current.audio
                  const peerLimit = peerPrefs?.audio ?? Infinity
                  limit = Math.min(myLimit, peerLimit)
              } else if (sender.track.kind === 'video') {
                  const isScreen = isScreenSharingRef.current
                  const myLimit = isScreen ? bitratesOutgoingRef.current.screen : bitratesOutgoingRef.current.camera
                  const peerLimit = isScreen ? (peerPrefs?.screen ?? Infinity) : (peerPrefs?.camera ?? Infinity)
                  limit = Math.min(myLimit, peerLimit)
              }

              if (limit !== Infinity) {
                  params.encodings[0].maxBitrate = limit * 1000 // kbps to bps
                  sender.setParameters(params).catch(e => console.error("Failed to set bitrate", e))
              }
          })
      })
  }
  
  // Restart camera when devices change
  useEffect(() => {
      startCamera(selectedAudioDevice, selectedVideoDevice)
  }, [selectedAudioDevice, selectedVideoDevice])

  const handleSelectScreenSource = (id: string) => {
      window.electronAPI.selectScreenSource(id)
      setIsScreenShareModalOpen(false)
  }

  const handleCancelScreenShare = () => {
      window.electronAPI.selectScreenSource(null)
      setIsScreenShareModalOpen(false)
  }

  const loadDevices = async () => {
      try {
          const devs = await navigator.mediaDevices.enumerateDevices()
          setDevices(devs)
          
          // Set defaults if not set
          const audio = devs.filter(d => d.kind === 'audioinput')
          const video = devs.filter(d => d.kind === 'videoinput')
          const audioOutput = devs.filter(d => d.kind === 'audiooutput')
          
          const currentAudio = selectedAudioDeviceRef.current
          const currentVideo = selectedVideoDeviceRef.current
          const currentAudioOutput = selectedAudioOutputDeviceRef.current

          // Check if selected devices still exist, otherwise reset to default
          if (currentAudio && !audio.find(d => d.deviceId === currentAudio)) {
              setSelectedAudioDevice(audio[0]?.deviceId || '')
          } else if (!currentAudio && audio.length > 0) {
              setSelectedAudioDevice(audio[0].deviceId)
          }

          if (currentVideo && !video.find(d => d.deviceId === currentVideo)) {
              setSelectedVideoDevice(video[0]?.deviceId || '')
          } else if (!currentVideo && video.length > 0) {
              setSelectedVideoDevice(video[0].deviceId)
          }

          if (currentAudioOutput && !audioOutput.find(d => d.deviceId === currentAudioOutput)) {
               setSelectedAudioOutputDevice(audioOutput[0]?.deviceId || '')
          } else if (!currentAudioOutput && audioOutput.length > 0) {
               setSelectedAudioOutputDevice(audioOutput[0].deviceId)
          }

      } catch (e) {
          console.error("Error enumerating devices", e)
      }
  }

  const startCamera = async (audioDeviceId?: string, videoDeviceId?: string) => {
    setError(null)
    try {
      console.log("startCamera: Requesting stream with devices:", { audio: audioDeviceId, video: videoDeviceId })
      
      const createConstraints = (audioId?: string, videoId?: string) => ({
          audio: audioId 
            ? { deviceId: { exact: audioId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: videoId ? { deviceId: { exact: videoId } } : true
      })

      let rawStream: MediaStream | null = null
      
      // Stop old tracks if restarting
      if (cameraStreamRef.current) {
          console.log("startCamera: Stopping old tracks")
          cameraStreamRef.current.getTracks().forEach(t => t.stop())
      }
      
      // Cleanup old audio nodes
      if (micSourceRef.current) {
          micSourceRef.current.disconnect()
          micSourceRef.current = null
      }

      try {
        const constraints = createConstraints(audioDeviceId, videoDeviceId)
        console.log("startCamera: Calling getUserMedia with constraints:", JSON.stringify(constraints))
        rawStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err: any) {
        console.warn("startCamera: Primary constraints failed:", err)
        if (err.name === 'NotReadableError') {
             setError("Camera is in use by another application. Please close other apps (including old P2P-Cord instances) and restart.")
             return
        }
        if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
            console.log("startCamera: Falling back to default devices")
            try {
                // Fallback to simple constraints (Audio + Video)
                rawStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
                    video: true 
                })
            } catch (retryErr: any) {
                 if (retryErr.name === 'NotReadableError') {
                     setError("Camera is in use by another application.")
                     return
                 }
                 console.warn("startCamera: Fallback (A+V) failed, trying Audio only", retryErr)
                 try {
                     // Fallback to Audio ONLY
                     rawStream = await navigator.mediaDevices.getUserMedia({ 
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
                        video: false 
                    })
                    setIsVideoEnabled(false)
                 } catch (audioErr) {
                     console.error("startCamera: Audio-only fallback failed", audioErr)
                     setLocalStream(null)
                     return
                 }
            }
        } else {
            console.error('Failed to get local stream', err)
            try {
                 // Try Audio ONLY as a last resort for other errors
                 rawStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
                    video: false 
                })
                setIsVideoEnabled(false)
            } catch (finalErr) {
                console.error('startCamera: Final audio-only attempt failed', finalErr)
                setLocalStream(null)
                return
            }
        }
      }

      if (!rawStream) {
          setLocalStream(null)
          return
      }

      // Process Audio with Gain
      let finalStream = rawStream
      if (rawStream.getAudioTracks().length > 0) {
          try {
              if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
                  audioContextRef.current = new AudioContextClass()
              }
              const ctx = audioContextRef.current
              if (ctx.state === 'suspended') await ctx.resume()

              if (!gainNodeRef.current) {
                  gainNodeRef.current = ctx.createGain()
                  gainNodeRef.current.gain.value = micGain
              }

              const source = ctx.createMediaStreamSource(rawStream)
              micSourceRef.current = source
              
              const dest = ctx.createMediaStreamDestination()
              
              source.connect(gainNodeRef.current)
              gainNodeRef.current.connect(dest)
              
              const processedAudioTrack = dest.stream.getAudioTracks()[0]
              // Sync enabled state
              processedAudioTrack.enabled = rawStream.getAudioTracks()[0].enabled
              
              // Handle muting events to keep tracks in sync
              rawStream.getAudioTracks()[0].onmute = () => { processedAudioTrack.enabled = false }
              rawStream.getAudioTracks()[0].onunmute = () => { processedAudioTrack.enabled = true }
              rawStream.getAudioTracks()[0].onended = () => { processedAudioTrack.stop() }

              finalStream = new MediaStream([processedAudioTrack, ...rawStream.getVideoTracks()])
              console.log("startCamera: Audio processing chain set up")
          } catch (e) {
              console.error("startCamera: Failed to set up audio processing", e)
              finalStream = rawStream
          }
      }

      console.log("startCamera: Stream obtained:", finalStream.id)
      console.log("startCamera: Audio tracks:", finalStream.getAudioTracks().length)
      console.log("startCamera: Video tracks:", finalStream.getVideoTracks().length)
      
      // Refresh devices list after permission grant to ensure labels are visible
      loadDevices()

      setLocalStream(finalStream)
      cameraStreamRef.current = finalStream
      activeStreamRef.current = finalStream
      
      const shouldEnableVideo = isVideoEnabledRef.current
      if (finalStream.getVideoTracks().length > 0) {
          finalStream.getVideoTracks()[0].enabled = shouldEnableVideo
      }
      
      setIsVideoEnabled(shouldEnableVideo)
      setIsAudioEnabled(true)
      
      // If we are in a call, we might need to replace tracks for peers
      if (peersRef.current.size > 0) {
          replaceTracksForAllPeers(finalStream)
      }

    } catch (err) {
      console.error('Failed to get local stream', err)
    }
  }

  const replaceTracksForAllPeers = (newStream: MediaStream) => {
      const audioTrack = newStream.getAudioTracks()[0]
      const videoTrack = newStream.getVideoTracks()[0]
      
      peersRef.current.forEach(p => {
          if (!p.peer.destroyed) {
              const oldStream = p.peer.streams[0] // or however simple-peer stores it locally? No, simple-peer wraps it.
              // Actually simple-peer replaceTrack requires the OLD track reference.
              // We need to track what we sent. 
              // For simplicity in this demo: we might need to renegotiate or just replace assuming 1 track of each kind.
              // A robust way: keep track of 'currentSentStream' separately.
              
              // This is complex in simple-peer without reliable track mapping. 
              // A naive attempt:
              const senders = (p.peer as any)._pc.getSenders() // Accessing internal PC
              senders.forEach((sender: RTCRtpSender) => {
                  if (sender.track?.kind === 'audio' && audioTrack) {
                      sender.replaceTrack(audioTrack)
                  }
                  if (sender.track?.kind === 'video' && videoTrack) {
                      sender.replaceTrack(videoTrack)
                  }
              })
          }
      })
  }
  
  const handleDeviceChange = (deviceId: string, kind: 'audioinput' | 'videoinput' | 'audiooutput') => {
      if (kind === 'audioinput') {
          setSelectedAudioDevice(deviceId)
          localStorage.setItem('p2p-audio-input', deviceId)
          window.electronAPI?.setStoreValue('p2p-audio-input', deviceId)
      } else if (kind === 'videoinput') {
          setSelectedVideoDevice(deviceId)
          localStorage.setItem('p2p-video-input', deviceId)
          window.electronAPI?.setStoreValue('p2p-video-input', deviceId)
      } else if (kind === 'audiooutput') {
          setSelectedAudioOutputDevice(deviceId)
          localStorage.setItem('p2p-audio-output', deviceId)
          window.electronAPI?.setStoreValue('p2p-audio-output', deviceId)
      }
  }

  const updatePeers = () => {
    setPeers(new Map(peersRef.current))
    setForceUpdate(n => n + 1)
  }

  const createPeer = (peerId: string, initiator: boolean) => {
    if (peersRef.current.has(peerId)) return

    console.log(`Creating peer ${peerId}. Initiator: ${initiator}`)

    // Create SimplePeer instance
    const Peer = (SimplePeer as any).default || SimplePeer
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: activeStreamRef.current || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    })

    peer.on('signal', (data: any) => {
      window.electronAPI.sendMessage(peerId, JSON.stringify(data))
    })

    peer.on('connect', () => {
      console.log('Peer connected', peerId)
      // Send identity and video state
      peer.send(JSON.stringify({ type: 'identify', username: userNameRef.current, videoEnabled: isVideoEnabledRef.current }))
      
      // Send bitrate prefs
      const prefs = {
          type: 'bitrate-pref',
          camera: bitratesIncomingRef.current.camera,
          screen: bitratesIncomingRef.current.screen,
          audio: bitratesIncomingRef.current.audio
      }
      try { peer.send(JSON.stringify(prefs)) } catch (e) { console.error('Failed to send prefs on connect', e) }
    })

    peer.on('data', (data: any) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'identify') {
          const p = peersRef.current.get(peerId)
          if (p) {
            p.userName = msg.username
            if (msg.videoEnabled !== undefined) {
                p.isVideoEnabled = msg.videoEnabled
            }
            updatePeers()
          }
        } else if (msg.type === 'video-state') {
            const p = peersRef.current.get(peerId)
            if (p) {
                p.isVideoEnabled = msg.enabled
                updatePeers()
            }
        } else if (msg.type === 'bitrate-pref') {
            console.log(`Received bitrate prefs from ${peerId}`, msg)
            peerPreferencesRef.current.set(peerId, {
                camera: msg.camera,
                screen: msg.screen,
                audio: msg.audio
            })
            applyBitrateSettings()
        }
      } catch (err) {
        console.error('Data channel error', err)
      }
    })

    peer.on('stream', (stream: MediaStream) => {
      console.log('Received stream from', peerId)
      const p = peersRef.current.get(peerId)
      if (p) {
        p.stream = stream
        // Default to true if not yet received, but usually identify comes first
        if (p.isVideoEnabled === undefined) p.isVideoEnabled = true
        updatePeers()
        
        // Apply bitrate settings to new stream senders (if we are sending to them)
        // Wait, 'stream' event is for incoming. We need to set OUR senders.
        // Actually, simple-peer might add tracks/senders shortly after connection.
        // Let's retry applying settings after a short delay to ensure senders exist
        setTimeout(applyBitrateSettings, 1000)
      }
    })

    peer.on('error', (err: any) => {
        console.error('Peer error', peerId, err)
    })

    peersRef.current.set(peerId, { peerId, peer, isVideoEnabled: true })
    updatePeers()
  }

  const handleJoinRoom = (room: string) => {
    if (!room || !room.trim()) return // Validation
    if (activeRoom === room) return
    
    if (activeRoom) {
      handleLeaveRoom()
    }
    
    if (!rooms.includes(room)) {
      const newRooms = [...rooms, room]
      setRooms(newRooms)
      localStorage.setItem('p2p-rooms', JSON.stringify(newRooms))
      if (window.electronAPI?.setStoreValue) {
          window.electronAPI.setStoreValue('p2p-rooms', newRooms)
      }
    }
    setActiveRoom(room)
    
    window.electronAPI.joinRoom(room)
  }

  const handleDeleteRoom = (room: string) => {
      const newRooms = rooms.filter(r => r !== room)
      setRooms(newRooms)
      localStorage.setItem('p2p-rooms', JSON.stringify(newRooms))
      if (window.electronAPI?.setStoreValue) {
          window.electronAPI.setStoreValue('p2p-rooms', newRooms)
      }
      if (activeRoom === room) {
          handleLeaveRoom()
      }
  }

  const handleLeaveRoom = () => {
    if (!activeRoom) return

    // Leave swarm
    window.electronAPI.leaveRoom(activeRoom)
    
    // Destroy all peers
    peersRef.current.forEach(p => {
        p.peer.destroy()
    })
    peersRef.current.clear()
    peerPreferencesRef.current.clear() // Clear prefs
    updatePeers()

    // Stop screen share if active
    if (isScreenSharing) {
        stopScreenShare()
    }

    setActiveRoom(null)
  }

  const handleUpdateUserName = (name: string) => {
    setUserName(name)
    userNameRef.current = name
    
    // Broadcast new name to all connected peers
    peersRef.current.forEach((p) => {
        if (p.peer.connected) {
            try {
                p.peer.send(JSON.stringify({ type: 'identify', username: name, videoEnabled: isVideoEnabled }))
            } catch (err) {
                console.error('Failed to send identity update', err)
            }
        }
    })
  }

  // Media Controls
  const toggleAudio = () => {
    if (activeStreamRef.current) {
      const audioTrack = activeStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (activeStreamRef.current) {
      const videoTrack = activeStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        const enabled = !videoTrack.enabled
        videoTrack.enabled = enabled
        setIsVideoEnabled(enabled)
        
        // Broadcast video state
        peersRef.current.forEach(p => {
            if (p.peer.connected) {
                p.peer.send(JSON.stringify({ type: 'video-state', enabled }))
            }
        })
      }
    }
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop Screen Share -> Revert to Camera
      stopScreenShare()
    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        const screenTrack = screenStream.getVideoTracks()[0]
        
        screenTrack.onended = () => stopScreenShare() // Handle browser "Stop sharing" UI

        if (activeStreamRef.current) {
           const oldVideoTrack = activeStreamRef.current.getVideoTracks()[0]
           
           if (oldVideoTrack) {
               // Replace track in all peers
               for (const p of peersRef.current.values()) {
                 p.peer.replaceTrack(oldVideoTrack, screenTrack, activeStreamRef.current)
               }
               activeStreamRef.current.removeTrack(oldVideoTrack)
           } else {
               // We are adding a video track where there was none
               for (const p of peersRef.current.values()) {
                   p.peer.addTrack(screenTrack, activeStreamRef.current)
               }
           }

           activeStreamRef.current.addTrack(screenTrack)
           setLocalStream(activeStreamRef.current)
           setIsScreenSharing(true)
           
           // Ensure audio is still preserved from camera stream if needed (DisplayMedia might not have audio)
           // If we want to keep mic audio, we just replaced the video track, so audio track should remain.
        }
      } catch (err) {
        console.error("Failed to share screen", err)
      }
    }
  }

  const stopScreenShare = () => {
    if (!isScreenSharing || !cameraStreamRef.current || !activeStreamRef.current) return

    const screenTrack = activeStreamRef.current.getVideoTracks()[0]
    const cameraTrack = cameraStreamRef.current.getVideoTracks()[0]

    if (screenTrack) {
        if (cameraTrack) {
            // Replace track in all peers
            for (const p of peersRef.current.values()) {
              p.peer.replaceTrack(screenTrack, cameraTrack, activeStreamRef.current)
            }
            activeStreamRef.current.removeTrack(screenTrack)
            activeStreamRef.current.addTrack(cameraTrack)

            // Restore video enabled state
            if (!isVideoEnabled) {
                cameraTrack.enabled = false
            } else {
                cameraTrack.enabled = true
            }
        } else {
            // Revert to audio-only (remove video track)
            for (const p of peersRef.current.values()) {
                p.peer.removeTrack(screenTrack, activeStreamRef.current)
            }
            activeStreamRef.current.removeTrack(screenTrack)
        }
        
        screenTrack.stop()
    }

    setLocalStream(activeStreamRef.current)
    setIsScreenSharing(false)
    // Force update to refresh video element
    setForceUpdate(n => n + 1)
  }

  // Convert map to array for VideoGrid
  const peerList = Array.from(peers.values()).map(p => ({
    peerId: p.peerId,
    stream: p.stream!,
    userName: p.userName,
    isVideoEnabled: p.isVideoEnabled
  })).filter(p => p.stream)

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white overflow-hidden">
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userName={userName}
        onUpdateUserName={handleUpdateUserName}
        devices={devices}
        selectedAudioDevice={selectedAudioDevice}
        selectedAudioOutputDevice={selectedAudioOutputDevice}
        selectedVideoDevice={selectedVideoDevice}
        onDeviceChange={handleDeviceChange}
        localStream={localStream}
        cameraBitrate={cameraBitrate}
        setCameraBitrate={setCameraBitrate}
        screenBitrate={screenBitrate}
        setScreenBitrate={setScreenBitrate}
        audioBitrate={audioBitrate}
        setAudioBitrate={setAudioBitrate}
        cameraBitrateIncoming={cameraBitrateIncoming}
        setCameraBitrateIncoming={setCameraBitrateIncoming}
        screenBitrateIncoming={screenBitrateIncoming}
        setScreenBitrateIncoming={setScreenBitrateIncoming}
        audioBitrateIncoming={audioBitrateIncoming}
        setAudioBitrateIncoming={setAudioBitrateIncoming}
        noiseSuppression={noiseSuppression}
        setNoiseSuppression={setNoiseSuppression}
        echoCancellation={echoCancellation}
        setEchoCancellation={setEchoCancellation}
        autoGainControl={autoGainControl}
        setAutoGainControl={setAutoGainControl}
        vadThreshold={vadThreshold}
        setVadThreshold={setVadThreshold}
      />

      <ScreenShareModal 
        isOpen={isScreenShareModalOpen}
        sources={screenSources}
        onSelect={handleSelectScreenSource}
        onCancel={handleCancelScreenShare}
      />

      <Sidebar 
        rooms={rooms} 
        activeRoom={activeRoom} 
        userName={userName}
        onJoinRoom={handleJoinRoom}
        onSelectRoom={handleJoinRoom} 
        onDeleteRoom={handleDeleteRoom}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900 shadow-sm z-10">
            {activeRoom ? (
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold tracking-tight"># {activeRoom}</span>
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    </div>
                    <div className="text-xs text-gray-500 font-mono border border-gray-700 rounded px-2 py-0.5">
                        {peers.size} Peer{peers.size !== 1 ? 's' : ''} Connected
                    </div>
                </div>
            ) : (
                <div className="text-gray-400 font-medium">Select or join a room</div>
            )}
        </div>

        <div className="flex-1 relative bg-black flex flex-col min-h-0">
             {error && (
                 <div className="bg-red-900/80 text-white px-4 py-2 text-sm border-b border-red-700 flex items-center justify-between">
                     <span>{error}</span>
                     <button onClick={() => setError(null)} className="hover:bg-red-800 rounded px-2">✕</button>
                 </div>
             )}
             {activeRoom ? (
                 <>
                   <VideoGrid 
                      localStream={localStream} 
                      localVideoEnabled={isVideoEnabled}
                      localUserName={userName}
                      peers={peerList} 
                      audioOutputDeviceId={selectedAudioOutputDevice}
                      micGain={micGain}
                      onMicGainChange={setMicGain}
                      vadThreshold={vadThreshold}
                   />
                   <MediaControls 
                      isAudioEnabled={isAudioEnabled}
                      isVideoEnabled={isVideoEnabled}
                      isScreenSharing={isScreenSharing}
                      onToggleAudio={toggleAudio}
                      onToggleVideo={toggleVideo}
                      onToggleScreenShare={toggleScreenShare}
                      onLeave={handleLeaveRoom}
                   />
                 </>
             ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                    <div className="text-6xl text-gray-800">⌘</div>
                    <p className="text-lg">Welcome to P2P Cord.</p>
                    <p className="text-sm max-w-md text-center text-gray-600">
                      Serverless, encrypted, and direct. Join a room to start streaming with peers.
                    </p>
                 </div>
             )}
        </div>
      </div>
    </div>
  )
}

export default App
