// src/hooks/useGridRecorder.ts

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { ActorCount, ActorDeviceConfig } from '@/types';

type Orientation = 'landscape' | 'portrait';
type LayoutType = 'grid' | 'focus' | 'clean';

interface CanvasConfig {
  id: string; // e.g. "landscape-main", "landscape-clean", "portrait-focus-0"
  orientation: Orientation;
  type: LayoutType;
  focusIndex: number; // -1 for grid/main/clean
}

export function useGridRecorder(
  webcamRefs: React.MutableRefObject<(Webcam | null)[]>,
  videoRef: React.RefObject<HTMLVideoElement>,
  actorCount: ActorCount,
  isVideoMuted: boolean = false,
  watermarkSrc: string | null = null,
  deviceConfig: ActorDeviceConfig = {} // Add this parameter
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // downloadUrls keys will be like "landscape-main", "landscape-clean", etc.
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string> | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecordersRef = useRef<Record<string, MediaRecorder>>({});
  const chunksRef = useRef<Record<string, Blob[]>>({});
  const animationFrameRef = useRef<number | null>(null);
  
  // Watermark Image Ref
  const watermarkImgRef = useRef<HTMLImageElement | null>(null);

  // Preload Watermark when src changes
  useEffect(() => {
    if (watermarkSrc) {
        const img = new Image();
        img.src = watermarkSrc;
        img.crossOrigin = "anonymous"; // vital for canvas export
        img.onload = () => {
            watermarkImgRef.current = img;
        };
    } else {
        watermarkImgRef.current = null;
    }
  }, [watermarkSrc]);

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
      
      // Clean Mix (Landscape Only)
      if (orientation === 'landscape') {
        configs.push({ id: `${orientation}-clean`, orientation, type: 'clean', focusIndex: -1 });
      }

      // Focus Mixes
      for (let i = 0; i < actorCount; i++) {
        configs.push({ id: `${orientation}-focus-${i}`, orientation, type: 'focus', focusIndex: i });
      }
    });

    // --- 3. Determine MIME Type ---
    let mimeType = 'video/webm;codecs=vp9';
    if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
        mimeType = 'video/webm;codecs=h264';
    }

    // --- 4. Create Canvases & Recorders ---
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
        const rec = new MediaRecorder(stream, { mimeType });
        rec.ondataavailable = e => { if (e.data.size > 0) chunks[config.id].push(e.data); };
        recorders[config.id] = rec;
      } catch (e) {
        // Fallback
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = e => { if (e.data.size > 0) chunks[config.id].push(e.data); };
        recorders[config.id] = rec;
      }
      
      return { ctx, canvas, config };
    });

    // --- 5. Draw Loop ---
    const draw = () => {
      contexts.forEach(({ ctx, canvas, config }) => {
        const W = canvas.width;
        const H = canvas.height;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        
        // --- 1. CLEAN MIX ---
        if (config.type === 'clean') {
            if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
                drawImageContain(ctx, videoRef.current, 0, 0, W, H);
            }
            // Watermark (Top Left, Opaque)
            if (watermarkImgRef.current) {
                const img = watermarkImgRef.current;
                const iW = img.width; const iH = img.height;
                const maxW = W * 0.15; 
                const scale = maxW / iW;
                const dW = iW * scale; const dH = iH * scale;
                
                ctx.globalAlpha = 1.0; // Opaque
                ctx.drawImage(img, 40, 40, dW, dH);
                ctx.globalAlpha = 1.0;
            }
            return;
        }

        // --- 2. GRID & FOCUS LAYOUTS ---
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
                 
                 // Sub-grid calculations
                 let subX, subY, subW, subH;
                 if (actorCount === 1) { 
                     subX = 0; subY = 0; subW = aw; subH = ah; 
                 } else if (actorCount === 2) {
                     subX = 0; subY = i * (ah / 2); subW = aw; subH = ah / 2;
                 } else if (actorCount === 3) {
                     const rowH = ah / 2;
                     if (i === 0) { subX = 0; subY = 0; subW = aw / 2; subH = rowH; }
                     else if (i === 1) { subX = aw / 2; subY = 0; subW = aw / 2; subH = rowH; }
                     else { subX = 0; subY = rowH; subW = aw; subH = rowH; }
                 } else { // 4+
                     const colW = aw / 2; const rowH = ah / 2;
                     const col = i % 2; const row = Math.floor(i / 2);
                     subX = col * colW; subY = row * rowH; subW = colW; subH = rowH;
                 }

                 drawImageCover(ctx, webcam.video, ax + subX, ay + subY, subW, subH);
                 
                 // Label (Custom Name)
                 const actorName = deviceConfig[i]?.name || `${i+1}`;
                 
                 ctx.fillStyle = "rgba(0,0,0,0.6)";
                 // Adjust label background size based on text length
                 const textWidth = ctx.measureText(actorName).width;
                 ctx.fillRect(ax + subX + 10, ay + subY + 10, textWidth + 20, 30);
                 
                 ctx.fillStyle = "white";
                 ctx.font = "bold 16px sans-serif";
                 ctx.fillText(actorName, ax + subX + 20, ay + subY + 30);
             });

        } else if (config.type === 'focus') {
             // --- FOCUS MODE (Enlarge One, Minimize Others) ---
             const focusedIndex = config.focusIndex;
             
             // 1. Draw The Focused Actor (Large, Top 70%)
             const focusedH = ah * 0.7;
             const othersH = ah * 0.3;
             
             // Draw Main
             const mainWebcam = webcamRefs.current[focusedIndex];
             if (mainWebcam?.video) {
                 drawImageCover(ctx, mainWebcam.video, ax, ay, aw, focusedH);
                 
                 // Label Main (Custom Name)
                 const focusedName = deviceConfig[focusedIndex]?.name || `Actor ${focusedIndex+1}`;
                 ctx.font = "bold 20px sans-serif";
                 const textWidth = ctx.measureText(focusedName).width;
                 
                 ctx.fillStyle = "rgba(0,0,0,0.6)";
                 ctx.fillRect(ax + 20, ay + 20, textWidth + 30, 40);
                 
                 ctx.fillStyle = "white";
                 ctx.fillText(focusedName, ax + 35, ay + 48);
                 
                 // Highlight border
                 ctx.strokeStyle = "#2563EB"; // blue-600
                 ctx.lineWidth = 4;
                 ctx.strokeRect(ax+2, ay+2, aw-4, focusedH-4);
             } else {
                 ctx.fillStyle = "#222";
                 ctx.fillRect(ax, ay, aw, focusedH);
             }

             // 2. Draw Others (Small row at bottom)
             const otherActors = Array.from({length: actorCount}, (_, i) => i).filter(i => i !== focusedIndex);
             if (otherActors.length > 0) {
                 const smallW = aw / otherActors.length;
                 otherActors.forEach((actorIdx, posIdx) => {
                     const webcam = webcamRefs.current[actorIdx];
                     const sx = ax + (posIdx * smallW);
                     const sy = ay + focusedH;
                     
                     if (webcam?.video) {
                         drawImageCover(ctx, webcam.video, sx, sy, smallW, othersH);
                         
                         // Small Label (First char of name or number)
                         const smallActorName = deviceConfig[actorIdx]?.name?.charAt(0) || `${actorIdx+1}`;
                         
                         ctx.fillStyle = "rgba(0,0,0,0.6)";
                         ctx.fillRect(sx + 5, sy + 5, 20, 20);
                         ctx.fillStyle = "white";
                         ctx.font = "bold 12px sans-serif";
                         ctx.fillText(smallActorName, sx + 11, sy + 19);
                     } else {
                         ctx.fillStyle = "#111";
                         ctx.fillRect(sx, sy, smallW, othersH);
                     }
                     // Border between small ones
                     ctx.strokeStyle = "#000";
                     ctx.lineWidth = 1;
                     ctx.strokeRect(sx, sy, smallW, othersH);
                 });
             }
        }

        // Draw Watermark (Top Left, Opaque)
        if (watermarkImgRef.current) {
            const img = watermarkImgRef.current;
            const iW = img.width; const iH = img.height;
            const maxW = W * 0.15; // 15% width
            const scale = maxW / iW;
            const dW = iW * scale; const dH = iH * scale;
            
            ctx.globalAlpha = 1.0; // Opaque
            // Position: Top Left (20px padding)
            ctx.drawImage(img, 20, 20, dW, dH);
            ctx.globalAlpha = 1.0;
        }
      });
      
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    // Start everything
    mediaRecordersRef.current = recorders;
    chunksRef.current = chunks;
    Object.values(recorders).forEach(rec => rec.start());
    setIsRecording(true);
    setIsPaused(false);
    
    if (videoRef.current) {
        // Ensure video is playing
        videoRef.current.play().catch(e => console.error(e));
    }
    
    draw();
  };

  const stopRecording = () => {
    if (!isRecording) return;
    
    // Stop loop
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    // Stop all recorders
    const newUrls: Record<string, string> = {};
    let pending = Object.keys(mediaRecordersRef.current).length;

    Object.entries(mediaRecordersRef.current).forEach(([id, rec]) => {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current[id], { type: rec.mimeType }); // Use actual mimeType
        newUrls[id] = URL.createObjectURL(blob);
        pending--;
        if (pending === 0) {
            setDownloadUrls(newUrls);
        }
      };
      rec.stop();
    });

    setIsRecording(false);
    setIsPaused(false);

    // Cleanup audio
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }
  };

  const pauseRecording = () => {
    if (!isRecording) return;
    Object.values(mediaRecordersRef.current).forEach(r => r.pause());
    setIsPaused(true);
    videoRef.current?.pause();
  };

  const resumeRecording = () => {
    if (!isRecording) return;
    Object.values(mediaRecordersRef.current).forEach(r => r.resume());
    setIsPaused(false);
    videoRef.current?.play();
  };

  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadUrls,
    setDownloadUrls,
    isRecording,
    isPaused,
    audioContext: audioContextRef.current,
    audioDestination: audioDestinationRef.current
  };
}
