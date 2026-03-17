'use client';

import { useRef, useState, useCallback } from 'react';

export const INPUT_SAMPLE_RATE = 16000;

export function useAudioInput() {
  const [volume, setVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const audioContextRef   = useRef<AudioContext | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const processorRef      = useRef<ScriptProcessorNode | null>(null);
  const isMutedRef        = useRef(false);

  const startInput = useCallback(async (onAudioData: (base64: string) => void) => {
    audioContextRef.current = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    processorRef.current = audioContextRef.current.createScriptProcessor(2048, 1, 1);

    processorRef.current.onaudioprocess = (e) => {
      if (isMutedRef.current) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);
      let sum = 0;

      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        sum += Math.abs(s);
      }

      setVolume(sum / inputData.length);

      const uint8 = new Uint8Array(pcmData.buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      onAudioData(btoa(binary));
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  }, []);

  const stopInput = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setVolume(0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      isMutedRef.current = !prev;
      return !prev;
    });
  }, []);

  return { startInput, stopInput, volume, isMuted, toggleMute };
}
