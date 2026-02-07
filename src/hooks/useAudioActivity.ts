import { useState, useEffect, useRef } from 'react'

export function useAudioActivity(stream: MediaStream | null, threshold: number = 0) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const thresholdRef = useRef(threshold)
  
  useEffect(() => {
      thresholdRef.current = threshold
  }, [threshold])

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
    
    // Check if track is enabled
    if (!audioTracks[0].enabled) {
         setIsSpeaking(false)
         // We should probably still listen in case it gets enabled, but the stream object usually doesn't change when enabled changes...
         // Actually, if track.enabled changes, we don't get a re-render unless we listen to it.
         // But the hook depends on 'stream'.
    }

    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let source: MediaStreamAudioSourceNode | null = null
    let animationFrameId: number

    const initAudio = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioContextClass) return

        audioContext = new AudioContextClass()
        if (audioContext.state === 'suspended') {
            await audioContext.resume()
        }

        analyser = audioContext.createAnalyser()
        analyser.fftSize = 1024 
        analyser.smoothingTimeConstant = 0.1 
        
        source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Float32Array(bufferLength)

        const checkAudio = () => {
          if (!analyser) return

          // Use Float32 for better precision if available (TimeDomain)
          analyser.getFloatTimeDomainData(dataArray)

          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            const x = dataArray[i]
            sum += x * x
          }
          const rms = Math.sqrt(sum / bufferLength)
          
          // Convert to roughly 0-100 scale.
          // 0.01 RMS is usually ambient noise/quiet room.
          // 0.05-0.1 is speaking.
          // We map 0.05 -> 50 approx.
          const currentLevel = Math.min(100, rms * 1000)
          
          // Noise Gate logic
          // If threshold is 0 (Always On), we use a minimal noise floor of 5 (corresponds to 0.005 RMS)
          // If threshold > 0, we use it directly.
          const effectiveThreshold = thresholdRef.current <= 0 ? 5 : thresholdRef.current
          
          setIsSpeaking(currentLevel > effectiveThreshold)
          
          animationFrameId = requestAnimationFrame(checkAudio)
        }

        checkAudio()
      } catch (err) {
        console.error('Error initializing audio activity detection:', err)
      }
    }

    initAudio()

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (source) {
        source.disconnect()
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close()
      }
    }
  }, [stream])

  return isSpeaking
}