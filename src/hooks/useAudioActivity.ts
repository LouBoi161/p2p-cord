import { useState, useEffect, useRef } from 'react'

export function useAudioActivity(stream: MediaStream | null, threshold: number = 0) {
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

        if (audioContext.state === 'suspended') {
            await audioContext.resume()
        }

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.3
        analyserRef.current = analyser

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        sourceRef.current = source

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const checkAudio = () => {
          if (!analyserRef.current) return

          analyserRef.current.getByteTimeDomainData(dataArray)

          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            const x = dataArray[i] - 128
            sum += x * x
          }
          const rms = Math.sqrt(sum / bufferLength)
          
          // Normalize RMS roughly to 0-100 range.
          // Max RMS for a square wave is 128. Sine wave is ~90.
          // Normal speech usually hovers around 5-20 RMS.
          // We amplify it slightly for better UI mapping.
          // Factor 2.5 means RMS 40 (loud speech) -> 100%.
          const currentLevel = Math.min(100, rms * 2.5)
          
          // If threshold is 0, we consider it "Always Open" (but still need minimal noise floor check)
          // Let's say noise floor is 1%.
          const effectiveThreshold = threshold === 0 ? 1 : threshold
          
          const speaking = currentLevel > effectiveThreshold
          
          setIsSpeaking(speaking)
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
  }, [stream, threshold])

  return isSpeaking
}