// src/hooks/useGridRecorder.ts
import { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { ActorCount } from '@/types';

type Orientation = 'landscape' | 'portrait';
type LayoutType = 'grid' | 'focus';

interface CanvasConfig {
  id: string; // e.g. "landscape-main", "portrait-focus-0"
  orientation: Orientation;
  type: LayoutType;
  focusIndex: number; // -1 for grid/main
}

export function useGridRecorder(
  webcamRefs: React.MutableRefObject<(Webcam | null)[]>,
  videoRef: React.RefObject<HTMLVideoElement>,
  actorCount: ActorCount,
  isVideoMuted: boolean = false,
  watermarkText: string = "" // Added argument
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // downloadUrls keys will be like "landscape-main", "portrait-focus-1", etc.
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string> | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const mediaRecordersRef = useRef<Record<string, MediaRecorder>>({});
  const chunksRef = useRef<Record<string, Blob[]>>({});
  const animationFrameRef = useRef<number | null>(null);

  // --- Helpers ---
  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLVideoElement | HTMLCanvasElement, x: number, y: number, w: number, h: number) => {
    // @ts-ignore
    const iW = img.videoWidth || img.width;
    // @ts-ignore
    const iH = img.videoHeight || img.height;
    if (!iW || !iH) return;
    const r = w / h;
    const ir = iW / iH;
    let sx, sy, sWidth, sHeight;
    if (ir > r) {
      sHeight = iH; sWidth = iH * r; sx = (iW - sWidth) / 2; sy = 0;
    } else {
      sWidth = iW; sHeight = iW / r; sx = 0; sy = (iH - sHeight) / 2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
  };

  const drawImageContain = (ctx: CanvasRenderingContext2D, img: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
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
    setDownloadUrls(null);
    const recorders: Record<string, MediaRecorder> = {};
    const chunks: Record<string, Blob[]> = {};

    // --- 1. Audio Setup ---
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const dest = audioCtx.createMediaStreamDestination();
    audioContextRef.current = audioCtx;
    audioDestinationRef.current = dest;

    // Connect Webcams
    webcamRefs.current.forEach((webcam) => {
      if (webcam?.video?.srcObject) {
        const stream = webcam.video.srcObject as MediaStream;
        if (stream.getAudioTracks().length > 0) {
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(dest);
        }
      }
    });

    // Connect Reference Video
    if (videoRef.current && !isVideoMuted) {
      try {
        // @ts-ignore
        const vidStream = videoRef.current.captureStream ? videoRef.current.captureStream() : videoRef.current.mozCaptureStream();
        if (vidStream.getAudioTracks().length > 0) {
          const vidSource = audioCtx.createMediaStreamSource(vidStream);
          vidSource.connect(dest);
        }
      } catch (e) {
        console.warn("Could not capture video audio", e);
      }
    }

    // --- 2. Define All Video Configurations ---
    const configs: CanvasConfig[] = [];
    const orientations: Orientation[] = ['landscape', 'portrait'];

    orientations.forEach(orientation => {
      // Main Mix
      configs.push({ id: `${orientation}-main`, orientation, type: 'grid', focusIndex: -1 });
      // Focus Mixes
      for (let i = 0; i < actorCount; i++) {
        configs.push({ id: `${orientation}-focus-${i}`, orientation, type: 'focus', focusIndex: i });
      }
    });

    // --- 3. Create Canvases & Recorders ---
    const contexts = configs.map(config => {
      const canvas = document.createElement('canvas');
      if (config.orientation === 'landscape') {
        canvas.width = 1920;
        canvas.height = 1080;
      } else {
        canvas.width = 1080;
        canvas.height = 1920;
      }
      
      const ctx = canvas.getContext('2d')!;
      
      // Setup Recorder
      const stream = canvas.captureStream(30);
      if (dest.stream.getAudioTracks().length > 0) {
        stream.addTrack(dest.stream.getAudioTracks()[0]);
      }
      
      chunks[config.id] = [];
      try {
        const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        rec.ondataavailable = e => { if (e.data.size > 0) chunks[config.id].push(e.data); };
        recorders[config.id] = rec;
      } catch (e) {
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = e => { if (e.data.size > 0) chunks[config.id].push(e.data); };
        recorders[config.id] = rec;
      }

      return { ctx, canvas, config };
    });

    // --- 4. Draw Loop ---
    const draw = () => {
      contexts.forEach(({ ctx, canvas, config }) => {
        const W = canvas.width;
        const H = canvas.height;
        
        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // Define Layout Areas
        let refRect, actorsRect;

        if (config.orientation === 'landscape') {
          // Left / Right Split
          const halfW = W / 2;
          refRect = { x: 0, y: 0, w: halfW, h: H };
          actorsRect = { x: halfW, y: 0, w: halfW, h: H };
        } else {
          // Top / Bottom Split
          const halfH = H / 2;
          refRect = { x: 0, y: 0, w: W, h: halfH };
          actorsRect = { x: 0, y: halfH, w: W, h: halfH };
        }

        // A. Draw Reference Video
        if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
          drawImageContain(ctx, videoRef.current, refRect.x, refRect.y, refRect.w, refRect.h);
        }

        // B. Draw Actors
        const { x: ax, y: ay, w: aw, h: ah } = actorsRect;

        if (config.type === 'grid') {
          // --- EQUAL GRID ---
          webcamRefs.current.forEach((webcam, i) => {
            if (i >= actorCount || !webcam?.video) return;
            
            // Sub-grid calculations relative to Actor Area
            let subX, subY, subW, subH;
            
            if (actorCount === 1) { 
               subX = 0; subY = 0; subW = aw; subH = ah; 
            } else if (actorCount === 2) {
               // Vertical stack in both landscape/portrait usually looks best for 2
               subX = 0; subY = i * (ah / 2); subW = aw; subH = ah / 2;
            } else if (actorCount === 3) {
               const rowH = ah / 2;
               if (i === 0) { subX = 0; subY = 0; subW = aw / 2; subH = rowH; }
               else if (i === 1) { subX = aw / 2; subY = 0; subW = aw / 2; subH = rowH; }
               else { subX = 0; subY = rowH; subW = aw; subH = rowH; }
            } else { // 4
               const colW = aw / 2; const rowH = ah / 2;
               const col = i % 2; const row = Math.floor(i / 2);
               subX = col * colW; subY = row * rowH; subW = colW; subH = rowH;
            }

            drawImageCover(ctx, webcam.video, ax + subX, ay + subY, subW, subH);
            
            // Label
            ctx.fillStyle = "rgba(0,0,0,0.6)"; 
            ctx.fillRect(ax + subX + 10, ay + subY + 10, 80, 24);
            ctx.font = "bold 16px sans-serif"; 
            ctx.fillStyle = "white"; 
            ctx.fillText(`Actor ${i + 1}`, ax + subX + 20, ay + subY + 28);
          });

        } else if (config.type === 'focus') {
          // --- FOCUS LAYOUT ---
          const focusIdx = config.focusIndex;
          
          // Layout: 70% Primary, 30% Strip
          // Important: In Portrait mode, the "Actor Area" is already vertical. 
          // We stack them vertically inside that area.
          const focusH = ah * 0.70;
          const stripH = ah * 0.30;

          // 1. Focus Actor (Top 70% of Actor Area)
          const focusWebcam = webcamRefs.current[focusIdx];
          if (focusWebcam?.video) {
            drawImageCover(ctx, focusWebcam.video, ax, ay, aw, focusH);
            // Label
            ctx.fillStyle = "rgba(0,0,0,0.6)"; 
            ctx.fillRect(ax + 20, ay + 20, 100, 30);
            ctx.font = "bold 20px sans-serif"; 
            ctx.fillStyle = "white"; 
            ctx.fillText(`Actor ${focusIdx + 1}`, ax + 35, ay + 42);
          }

          // 2. Others (Bottom 30% of Actor Area)
          const others = Array.from({length: actorCount}, (_, i) => i).filter(i => i !== focusIdx);
          const otherCount = others.length;
          const otherW = aw / (otherCount || 1); 

          others.forEach((actorIdx, idx) => {
             const webcam = webcamRefs.current[actorIdx];
             if (webcam?.video) {
               const sx = idx * otherW;
               drawImageCover(ctx, webcam.video, ax + sx, ay + focusH, otherW, stripH);
               
               // Small Label
               ctx.fillStyle = "rgba(0,0,0,0.6)"; 
               ctx.fillRect(ax + sx + 5, ay + focusH + 5, 60, 16);
               ctx.font = "bold 12px sans-serif"; 
               ctx.fillStyle = "white"; 
               ctx.fillText(`Actor ${actorIdx + 1}`, ax + sx + 10, ay + focusH + 18);
             }
          });
        }
        
        // --- C. Draw Watermark ---
        if (watermarkText) {
          ctx.save();
          // Scale font size based on canvas width (approx 1.5% of width)
          const fontSize = Math.max(16, Math.floor(W * 0.015)); 
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; // 50% transparent white
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";      // Black shadow for contrast
          ctx.shadowBlur = 4;
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          
          // Draw in bottom-right corner with padding
          const padding = Math.floor(W * 0.02);
          ctx.fillText(watermarkText, W - padding, H - padding);
          ctx.restore();
        }
      });

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Start all
    chunksRef.current = chunks;
    mediaRecordersRef.current = recorders;
    Object.values(recorders).forEach(r => r.start());
    
    setIsRecording(true);
    setIsPaused(false);
  };

  const stopRecording = () => {
    const recorders = Object.values(mediaRecordersRef.current);
    if (recorders.length === 0) return;

    const stopPromises = Object.entries(mediaRecordersRef.current).map(([key, recorder]) => {
      return new Promise<{key: string, url: string}>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current[key], { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          resolve({ key, url });
        };
        recorder.stop();
      });
    });

    Promise.all(stopPromises).then((results) => {
      const urls: Record<string, string> = {};
      results.forEach(res => urls[res.key] = res.url);
      setDownloadUrls(urls);
      setIsRecording(false);
      setIsPaused(false);
      
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) {
         audioContextRef.current.close();
         audioContextRef.current = null;
         audioDestinationRef.current = null;
      }
      mediaRecordersRef.current = {};
    });
  };

  // Passthroughs
  const pauseRecording = () => {
    Object.values(mediaRecordersRef.current).forEach(r => { if (r.state === 'recording') r.pause(); });
    setIsPaused(true);
  };
  const resumeRecording = () => {
    Object.values(mediaRecordersRef.current).forEach(r => { if (r.state === 'paused') r.resume(); });
    setIsPaused(false);
  };

  return {
    startRecording, stopRecording, pauseRecording, resumeRecording,
    downloadUrls, setDownloadUrls, isRecording, isPaused,
    audioContext: audioContextRef.current,
    audioDestination: audioDestinationRef.current
  };
}
