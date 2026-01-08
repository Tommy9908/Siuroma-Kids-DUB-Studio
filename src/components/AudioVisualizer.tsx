// src/components/AudioVisualizer.tsx

import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isMuted?: boolean;
}

export function AudioVisualizer({ stream, isMuted }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);
  const analyserRef = useRef<AnalyserNode>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode>(null);
  const audioContextRef = useRef<AudioContext>(null);

  useEffect(() => {
    // 1. Safety check: Ensure stream exists AND has at least one audio track
    if (!stream || !canvasRef.current || stream.getAudioTracks().length === 0) return;

    // Initialize Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    audioContextRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Connect Stream
    try {
      // 2. This line was causing the crash. Now it's protected by the check above.
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
    } catch (e) {
      console.error("Audio visualizer connection failed", e);
      return; // Exit if connection fails
    }

    // Draw Loop
    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Bars
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;

        // Gradient Color
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, '#4ade80'); // Green bottom
        gradient.addColorStop(1, '#60a5fa'); // Blue top

        ctx.fillStyle = isMuted ? '#374151' : gradient; // Grey if muted
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioContextRef.current) {
         // Suspend or close context to free resources
         audioContextRef.current.close(); 
      }
    };
  }, [stream, isMuted]);

  return (
    <canvas 
      ref={canvasRef} 
      width={200} 
      height={60} 
      className="w-full h-full"
    />
  );
}
