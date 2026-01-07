// src/hooks/useGridRecorder.ts

import { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { ActorCount } from '@/types';

export function useGridRecorder(
  webcamRefs: React.MutableRefObject<(Webcam | null)[]>,
  videoRef: React.RefObject<HTMLVideoElement>,
  actorCount: ActorCount
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Helper: Draw image with "object-cover" style to prevent stretching
  const drawImageCover = (
    ctx: CanvasRenderingContext2D,
    img: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    // Intrinsic dimensions of the source video
    const iW = img.videoWidth;
    const iH = img.videoHeight;
    if (!iW || !iH) return; // Not ready

    const r = w / h;
    const ir = iW / iH;

    let sx, sy, sWidth, sHeight;

    if (ir > r) {
      // Source is wider than dest: crop left/right
      sHeight = iH;
      sWidth = iH * r;
      sx = (iW - sWidth) / 2;
      sy = 0;
    } else {
      // Source is taller than dest: crop top/bottom
      sWidth = iW;
      sHeight = iW / r;
      sx = 0;
      sy = (iH - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
  };

  // Helper: Draw image with "object-contain" style (fit within box, black bars)
  const drawImageContain = (
    ctx: CanvasRenderingContext2D,
    img: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    const iW = img.videoWidth;
    const iH = img.videoHeight;
    if (!iW || !iH) return;

    const scale = Math.min(w / iW, h / iH);
    const dW = iW * scale;
    const dH = iH * scale;
    const dx = x + (w - dW) / 2;
    const dy = y + (h - dH) / 2;

    ctx.drawImage(img, 0, 0, iW, iH, dx, dy, dW, dH);
  };

  const startRecording = () => {
    const canvas = document.createElement('canvas');
    // Force 16:9 Full HD
    canvas.width = 1920;
    canvas.height = 1080;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    // --- Audio Setup ---
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const dest = audioCtx.createMediaStreamDestination();
    audioContextRef.current = audioCtx;

    // 1. Add Webcams Audio
    webcamRefs.current.forEach((webcam) => {
      if (webcam?.video?.srcObject) {
        const stream = webcam.video.srcObject as MediaStream;
        if (stream.getAudioTracks().length > 0) {
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(dest);
        }
      }
    });

    // 2. Add Video Audio
    if (videoRef.current) {
      try {
        // @ts-ignore
        const vidStream = videoRef.current.captureStream ? videoRef.current.captureStream() : videoRef.current.mozCaptureStream();
        if (vidStream.getAudioTracks().length > 0) {
          const vidSource = audioCtx.createMediaStreamSource(vidStream);
          vidSource.connect(dest);
        }
      } catch (e) {
        console.warn("Could not capture video audio directly", e);
      }
    }

    // --- DRAW LOOP ---
    const draw = () => {
      if (!ctx || !canvas) return;

      // Fill Background Black
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const halfW = canvas.width / 2; // 960px
      const H = canvas.height;        // 1080px

      // 1. LEFT SIDE: Reference Video (Contain/Fit)
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
         // Draw video to fit in the left 960x1080 box without stretching
         drawImageContain(ctx, videoRef.current, 0, 0, halfW, H);
      }

      // 2. RIGHT SIDE: Actor Grid (Cover/Fill)
      // We will divide the right 960x1080 area based on actor count
      webcamRefs.current.forEach((webcam, i) => {
        if (i < actorCount && webcam?.video?.readyState === 4) {
          let x, y, w, h;

          if (actorCount === 1) {
            // 1 Actor: Fills entire right side
            x = halfW; y = 0; w = halfW; h = H;
          } 
          else if (actorCount === 2) {
            // 2 Actors: Stacked vertically (960x540 each)
            x = halfW; 
            y = i * (H / 2); 
            w = halfW; 
            h = H / 2;
          } 
          else if (actorCount === 3) {
            // 3 Actors: 2 Top (small), 1 Bottom (wide)
            const rowH = H / 2; // 540px
            if (i === 0) {
              x = halfW; y = 0; w = halfW / 2; h = rowH;
            } else if (i === 1) {
              x = halfW + (halfW / 2); y = 0; w = halfW / 2; h = rowH;
            } else { // i === 2
              x = halfW; y = rowH; w = halfW; h = rowH;
            }
          } 
          else { 
            // 4 Actors: 2x2 Grid
            const colW = halfW / 2;
            const rowH = H / 2;
            const col = i % 2;
            const row = Math.floor(i / 2);
            
            x = halfW + (col * colW);
            y = row * rowH;
            w = colW;
            h = rowH;
          }

          // Use custom 'cover' function so faces aren't stretched
          drawImageCover(ctx, webcam.video, x, y, w, h);

          // Labels
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(x + 20, y + 20, 100, 30); // Label bg
          ctx.font = "bold 20px sans-serif";
          ctx.fillStyle = "white";
          ctx.fillText(`Actor ${i + 1}`, x + 35, y + 42);
        }
      });

      animationFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    // --- START RECORDER ---
    const canvasStream = canvas.captureStream(30);
    if (dest.stream.getAudioTracks().length > 0) {
      canvasStream.addTrack(dest.stream.getAudioTracks()[0]);
    }

    const recorder = new MediaRecorder(canvasStream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setIsRecording(false);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setIsPaused(false);
    setDownloadUrl(null);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadUrl,
    setDownloadUrl,
    isRecording,
    isPaused
  };
}
