import { useState, useEffect, useRef } from 'react'

export function useAudioActivity(stream: MediaStream | null) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stream) {
      setIsSpeaking(false)
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setIsSpeaking(false)
      return
    }

    const initAudio = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) return

        const audioContext = new AudioContextClass()
        audioContextRef.current = audioContext

        console.log('AudioContext created, state:', audioContext.state)

        // Ensure context is running (browsers often start suspended)
        if (audioContext.state === 'suspended') {
            await audioContext.resume()
            console.log('AudioContext resumed, new state:', audioContext.state)
        }

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512 // Increased for better resolution
        analyser.smoothingTimeConstant = 0.5
        analyserRef.current = analyser

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        sourceRef.current = source

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const checkAudio = () => {
          if (!analyserRef.current) return

          // Use Time Domain Data for more accurate waveform/volume detection
          analyserRef.current.getByteTimeDomainData(dataArray)

          // Calculate RMS (Root Mean Square) volume
          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            const x = dataArray[i] - 128 // Center on 0 (128 is silence)
            sum += x * x
          }
          const rms = Math.sqrt(sum / bufferLength)
          
          // Debug logs (throttle to avoid spamming too much, maybe once every 60 frames approx 1 sec)
          // if (Math.random() < 0.01) console.log('Current RMS:', rms)

          // Threshold for "speaking"
          // RMS usually stays below 1-2 for silence/noise. 
          // 5 is a safe threshold for "voice detection".
          const threshold = 3
          
          const speaking = rms > threshold
          setIsSpeaking(prev => {
              if (prev !== speaking) {
                  // console.log('Speaking state changed:', speaking, 'RMS:', rms)
              }
              return speaking
          })
          animationFrameRef.current = requestAnimationFrame(checkAudio)
        }

        checkAudio()
      } catch (err) {
        console.error('Error initializing audio activity detection:', err)
      }
    }

    initAudio()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stream])

  return isSpeaking
}