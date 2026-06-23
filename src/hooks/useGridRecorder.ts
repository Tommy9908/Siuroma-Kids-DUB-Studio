// src/hooks/useGridRecorder.ts

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { WatermarkState } from '@/components/InteractiveWatermark';
import { TextState } from '@/components/InteractiveText';
import { ActorCount, ActorDeviceConfig, StickerState } from '@/types';
import { FilterEngine } from '@/lib/FilterEngine';
import { FilterTargetRect } from '@/types/filters';

type Orientation = 'landscape' | 'portrait';
type LayoutType = 'grid' | 'focus' | 'clean';

/** Calculate the actual video content rect within a video element that uses object-fit: contain */
function getVideoContentRect(videoEl: HTMLVideoElement): { x: number; y: number; width: number; height: number } {
  const cw = videoEl.clientWidth;
  const ch = videoEl.clientHeight;

  if (videoEl.videoWidth && videoEl.videoHeight) {
    const videoAspect = videoEl.videoWidth / videoEl.videoHeight;
    const containerAspect = cw / ch;

    if (videoAspect > containerAspect) {
      // Video is wider → letterbox top/bottom
      const displayW = cw;
      const displayH = cw / videoAspect;
      return { x: 0, y: (ch - displayH) / 2, width: displayW, height: displayH };
    } else {
      // Video is taller → letterbox left/right
      const displayW = ch * videoAspect;
      const displayH = ch;
      return { x: (cw - displayW) / 2, y: 0, width: displayW, height: displayH };
    }
  }

  return { x: 0, y: 0, width: cw, height: ch };
}

interface CanvasConfig {
  id: string; // e.g. "landscape-main", "landscape-clean", "portrait-focus-0"
  orientation: Orientation;
  type: LayoutType;
  focusIndex: number; // -1 for grid/main/clean
}

export function useGridRecorder(
  webcamRefs: React.MutableRefObject<(Webcam | null)[]>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  actorCount: ActorCount,
  isVideoMuted: boolean = false,
  watermarkSrc: string | null = null,
  deviceConfig: ActorDeviceConfig = {},
  watermarkState?: WatermarkState,
  texts?: TextState[],
  stickers?: StickerState[],
  actorVideoRefs?: React.MutableRefObject<Record<number, HTMLVideoElement | null>>,
  actorCellRefs?: React.MutableRefObject<Record<number, HTMLDivElement | null>>,
  filterEngineRef?: React.MutableRefObject<FilterEngine | null>,
  filterConfig?: Record<number, { id: string }>,
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
  const startTimeRef = useRef<number>(0);

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
  const drawImageContain = (ctx: CanvasRenderingContext2D, img: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
    const iW = img.videoWidth;
    const iH = img.videoHeight;
    if (!iW || !iH) return null;

    const scale = Math.min(w / iW, h / iH);
    const dW = iW * scale;
    const dH = iH * scale;
    const dx = x + (w - dW) / 2;
    const dy = y + (h - dH) / 2;
    ctx.drawImage(img, 0, 0, iW, iH, dx, dy, dW, dH);
    return { x: dx, y: dy, w: dW, h: dH }; // Return the actual drawing rect
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

    // Connect Actor Videos (imported video as actor)
    if (actorVideoRefs?.current) {
      Object.values(actorVideoRefs.current).forEach((videoEl) => {
        if (videoEl) {
          try {
            videoEl.currentTime = 0;
            videoEl.play().catch(e => console.warn("Could not play actor video", e));
            // @ts-expect-error - captureStream is not in the HTMLVideoElement types yet
            const actorStream: MediaStream = videoEl.captureStream ? videoEl.captureStream() : videoEl.mozCaptureStream();
            if (actorStream && actorStream.getAudioTracks().length > 0) {
              const actorSource = audioCtx.createMediaStreamSource(actorStream);
              actorSource.connect(dest);
            }
          } catch (e) {
            console.warn("Could not capture actor video audio", e);
          }
        }
      });
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
    const draw = (time: number = 0) => {
      contexts.forEach(({ ctx, canvas, config }) => {
        const W = canvas.width;
        const H = canvas.height;
        let videoOnCanvasRect: { x: number, y: number, w: number, h: number } | null = null;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        // --- Sticker drawing helpers (must be before layout blocks) ---
        const drawStickerOnCanvas = (
          stickerCtx: CanvasRenderingContext2D,
          sticker: StickerState,
          canvasX: number,
          canvasY: number,
          canvasSize: number
        ) => {
          stickerCtx.save();
          stickerCtx.globalAlpha = sticker.opacity;
          const cx = canvasX + canvasSize / 2;
          const cy = canvasY + canvasSize / 2;
          if (sticker.rotation !== 0) {
            stickerCtx.translate(cx, cy);
            stickerCtx.rotate((sticker.rotation * Math.PI) / 180);
            stickerCtx.translate(-cx, -cy);
          }
          stickerCtx.font = `${canvasSize * 0.8}px sans-serif`;
          stickerCtx.textAlign = 'center';
          stickerCtx.textBaseline = 'middle';
          stickerCtx.fillText(sticker.emoji, cx, cy);
          stickerCtx.restore();
        };

        const drawActorSticker = (actorIdx: number, sticker: StickerState, subX: number, subY: number, subW: number, subH: number, ax: number, ay: number) => {
          const cellEl = actorCellRefs?.current?.[actorIdx];
          if (!cellEl) return;
          const cellW = cellEl.clientWidth;
          const cellH = cellEl.clientHeight;
          if (!cellW || !cellH) return;
          const relX = sticker.x / cellW;
          const relY = sticker.y / cellH;
          const relW = sticker.width / cellW;
          const canvasX = ax + subX + relX * subW;
          const canvasY = ay + subY + relY * subH;
          const canvasSize = relW * subW;
          drawStickerOnCanvas(ctx, sticker, canvasX, canvasY, canvasSize);
        };

        const actorStickers = stickers?.filter(s => typeof s.target === 'number') ?? [];

        // --- Filter drawing helper ---
        const drawActorFilter = (
          actorIdx: number,
          sourceVideo: HTMLVideoElement,
          targetRect: FilterTargetRect,
        ) => {
          const engine = filterEngineRef?.current;
          if (!engine || !filterConfig) return;
          const filterId = filterConfig[actorIdx]?.id;
          if (!filterId || filterId === 'none') return;

          const vw = sourceVideo.videoWidth || 1280;
          const vh = sourceVideo.videoHeight || 720;
          engine.drawCachedOnRecording(ctx, actorIdx, targetRect, vw, vh, time);
        };

        // --- Filter detection runner (run detection for one actor per frame, round-robin) ---
        const engine = filterEngineRef?.current;
        if (engine && filterConfig) {
          // Run detection for this frame — pick the actor based on frameCount rotation
          const detectIdx = actorCount > 0 ? (Math.floor(time / 150) % actorCount) : 0;
          if (filterConfig[detectIdx]?.id && filterConfig[detectIdx].id !== 'none') {
            const actorVideoEl = actorVideoRefs?.current?.[detectIdx];
            const webcam = webcamRefs.current[detectIdx];
            const sourceVideo = (actorVideoEl && !actorVideoEl.paused) ? actorVideoEl : webcam?.video;
            if (sourceVideo) {
              engine.runDetectionForRecording(detectIdx, sourceVideo, time);
            }
          }
        }

        // --- 1. CLEAN MIX ---
        if (config.type === 'clean') {
            if (videoRef.current && (!videoRef.current.paused || videoRef.current.ended)) {
                videoOnCanvasRect = drawImageContain(ctx, videoRef.current, 0, 0, W, H);
            }
            // Watermark is drawn later, using videoOnCanvasRect
        } else {
            // --- 2. GRID & FOCUS LAYOUTS ---
            let refRect, actorsRect;

            if (config.orientation === 'landscape') {
               // Left / Right Split
               const halfW = W / 2;
               refRect = { x: 0, y: 0, w: halfW, h: H };
            } else {
               // Top / Bottom Split
               const halfH = H / 2;
               refRect = { x: 0, y: 0, w: W, h: halfH };
            }

            // A. Draw Reference Video with filter applied
            if (videoRef.current && (!videoRef.current.paused || videoRef.current.ended)) {
                videoOnCanvasRect = drawImageContain(ctx, videoRef.current, refRect.x, refRect.y, refRect.w, refRect.h);
            }

            // B. Match actor area to video's actual rendered dimensions so proportions are consistent
            if (videoOnCanvasRect) {
              if (config.orientation === 'landscape') {
                actorsRect = { x: W / 2, y: videoOnCanvasRect.y, w: W / 2, h: videoOnCanvasRect.h };
              } else {
                actorsRect = { x: videoOnCanvasRect.x, y: H / 2, w: videoOnCanvasRect.w, h: H / 2 };
              }
            } else {
              // Fallback: use full half if video isn't drawing yet
              if (config.orientation === 'landscape') {
                actorsRect = { x: W / 2, y: 0, w: W / 2, h: H };
              } else {
                actorsRect = { x: 0, y: H / 2, w: W, h: H / 2 };
              }
            }

            // C. Draw Actors
            const { x: ax, y: ay, w: aw, h: ah } = actorsRect;
            
            if (config.type === 'grid') {
                 // --- EQUAL GRID ---
                 webcamRefs.current.forEach((webcam, i) => {
                     if (i >= actorCount) return;

                     // Use actor video if available, otherwise use webcam
                     const actorVideoEl = actorVideoRefs?.current?.[i];
                     const sourceVideo = actorVideoEl && !actorVideoEl.paused ? actorVideoEl : webcam?.video;
                     if (!sourceVideo) return;

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

                     drawImageContain(ctx, sourceVideo, ax + subX, ay + subY, subW, subH);

                     // Draw filter on this actor
                     drawActorFilter(i, sourceVideo, { x: ax + subX, y: ay + subY, w: subW, h: subH });

                     // Label (Custom Name)
                     const actorName = deviceConfig[i]?.name || `${i+1}`;

                     ctx.fillStyle = "rgba(0,0,0,0.6)";
                     // Adjust label background size based on text length
                     const textWidth = ctx.measureText(actorName).width;
                     ctx.fillRect(ax + subX + 10, ay + subY + 10, textWidth + 20, 30);

                     ctx.fillStyle = "white";
                     ctx.font = "bold 16px sans-serif";
                     ctx.fillText(actorName, ax + subX + 20, ay + subY + 30);

                     // Draw stickers on this actor
                     actorStickers.filter(s => s.target === i).forEach(sticker => {
                       drawActorSticker(i, sticker, subX, subY, subW, subH, ax, ay);
                     });
                 });

            } else if (config.type === 'focus') {
                 // --- FOCUS MODE (Enlarge One, Minimize Others) ---
                 const focusedIndex = config.focusIndex;

                 // 1. Draw The Focused Actor (Large, Top 70%)
                 const focusedH = ah * 0.7;
                 const othersH = ah * 0.3;

                 // Draw Main — use actor video if available
                 const mainWebcam = webcamRefs.current[focusedIndex];
                 const mainActorVideo = actorVideoRefs?.current?.[focusedIndex];
                 const mainSource = mainActorVideo && !mainActorVideo.paused ? mainActorVideo : mainWebcam?.video;
                 if (mainSource) {
                     drawImageContain(ctx, mainSource, ax, ay, aw, focusedH);

                     // Draw filter on focused actor
                     drawActorFilter(focusedIndex, mainSource, { x: ax, y: ay, w: aw, h: focusedH });

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

                     // Draw stickers on focused actor
                     actorStickers.filter(s => s.target === focusedIndex).forEach(sticker => {
                       drawActorSticker(focusedIndex, sticker, 0, 0, aw, focusedH, ax, ay);
                     });
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
                         const actorVideoEl = actorVideoRefs?.current?.[actorIdx];
                         const actorSource = actorVideoEl && !actorVideoEl.paused ? actorVideoEl : webcam?.video;
                         const sx = ax + (posIdx * smallW);
                         const sy = ay + focusedH;

                         if (actorSource) {
                             drawImageContain(ctx, actorSource, sx, sy, smallW, othersH);

                             // Draw filter on small actor
                             drawActorFilter(actorIdx, actorSource, { x: sx, y: sy, w: smallW, h: othersH });

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

                         // Draw stickers on this small actor
                         actorStickers.filter(s => s.target === actorIdx).forEach(sticker => {
                           drawActorSticker(actorIdx, sticker, posIdx * smallW, focusedH, smallW, othersH, ax, ay);
                         });
                     });
                 }
            }
        }

        // Draw Watermark (with Animation and Correct Positioning)
        if (watermarkImgRef.current && watermarkState && watermarkState.visible && videoRef.current && videoOnCanvasRect) {
            const img = watermarkImgRef.current;
            const videoEl = videoRef.current;

            // 1. Get video content rect within the element (accounts for letterboxing in studio)
            const contentRect = getVideoContentRect(videoEl);

            // 2. Calculate position relative to the video CONTENT area (not the full element)
            const relativeX = (watermarkState.x - contentRect.x) / contentRect.width;
            const relativeY = (watermarkState.y - contentRect.y) / contentRect.height;
            const relativeW = watermarkState.width / contentRect.width;
            const relativeH = watermarkState.height / contentRect.height;

            // 3. Apply relative values to the actual video area on canvas
            let canvasX = videoOnCanvasRect.x + (relativeX * videoOnCanvasRect.w);
            let canvasY = videoOnCanvasRect.y + (relativeY * videoOnCanvasRect.h);
            let canvasW = relativeW * videoOnCanvasRect.w;
            let canvasH = relativeH * videoOnCanvasRect.h;
            let opacity = watermarkState.opacity;

            // 3. Apply Animations
            const timeSec = time / 1000;
            switch (watermarkState.animation) {
                case 'scroll-h':
                    canvasX = videoOnCanvasRect.x + ((canvasX - videoOnCanvasRect.x + timeSec * 50) % (videoOnCanvasRect.w + canvasW) - canvasW);
                    break;
                case 'scroll-v':
                    canvasY = videoOnCanvasRect.y + ((canvasY - videoOnCanvasRect.y + timeSec * 50) % (videoOnCanvasRect.h + canvasH) - canvasH);
                    break;
                case 'pulse':
                    const scale = 1 + Math.sin(timeSec * 3) * 0.1; // Breathes in and out
                    canvasX -= (canvasW * (scale - 1)) / 2; // Keep it centered
                    canvasY -= (canvasH * (scale - 1)) / 2;
                    canvasW *= scale;
                    canvasH *= scale;
                    break;
                case 'fade-in-out':
                    opacity = (Math.sin(timeSec * 2) + 1) / 2 * watermarkState.opacity; // Fades in and out
                    break;
            }

            // 4. Draw
            ctx.globalAlpha = opacity;
            ctx.drawImage(img, canvasX, canvasY, canvasW, canvasH);
            ctx.globalAlpha = 1.0;
        }

        // --- Draw Text Overlays ---
        if (texts && texts.length > 0 && videoRef.current && videoOnCanvasRect) {
          const videoEl = videoRef.current;
          const elapsedSec = ((time || performance.now()) - startTimeRef.current) / 1000;

          texts.forEach(textState => {
            // Get video content rect to compute positions relative to actual content
            const contentRect = getVideoContentRect(videoEl);

            // Calculate position relative to video CONTENT area (not the full element)
            const relativeX = (textState.x - contentRect.x) / contentRect.width;
            const relativeY = (textState.y - contentRect.y) / contentRect.height;
            const relativeW = textState.width / contentRect.width;
            const relativeH = textState.height / contentRect.height;

            // Map to canvas coordinates
            const canvasX = videoOnCanvasRect!.x + (relativeX * videoOnCanvasRect!.w);
            let canvasY = videoOnCanvasRect!.y + (relativeY * videoOnCanvasRect!.h);
            const canvasW = relativeW * videoOnCanvasRect!.w;
            const canvasH = relativeH * videoOnCanvasRect!.h;

            // Scale font size from UI (content area) to canvas
            const scaleRatio = videoOnCanvasRect!.w / contentRect.width;
            const fontSize = textState.fontSize * scaleRatio;
            const lineHeight = fontSize * 1.4;

            ctx.save();
            ctx.fillStyle = textState.color;
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textBaseline = 'top';

            // Handle animations
            let displayText = textState.text;

            switch (textState.animation) {
              case 'typewriter': {
                const charsPerSec = 15;
                const charCount = Math.min(
                  Math.floor(elapsedSec * charsPerSec),
                  textState.text.length
                );
                displayText = textState.text.substring(0, charCount);
                break;
              }
              case 'scroll-up': {
                const scrollSpeed = 25; // pixels per second on canvas
                const totalScroll = (elapsedSec * scrollSpeed) % (canvasH + 20);
                canvasY = canvasY - totalScroll;
                break;
              }
            }

            // Word wrap and multi-line rendering
            const lines: string[] = [];
            displayText.split('\n').forEach(paragraph => {
              const words = paragraph.split(' ');
              let line = '';
              for (const word of words) {
                const testLine = line ? line + ' ' + word : word;
                const metrics = ctx.measureText(testLine);
                if (metrics.width > canvasW && line) {
                  lines.push(line);
                  line = word;
                } else {
                  line = testLine;
                }
              }
              if (line) lines.push(line);
            });

            lines.forEach(line => {
              ctx.fillText(line, canvasX, canvasY);
              canvasY += lineHeight;
            });

            ctx.restore();
          });
        }

        // Video stickers (target === 'video')
        if (stickers && videoRef.current && videoOnCanvasRect) {
          const videoEl = videoRef.current;
          const contentRect = getVideoContentRect(videoEl);
          const videoStickers = stickers.filter(s => s.target === 'video');

          videoStickers.forEach(sticker => {
            const relativeX = (sticker.x - contentRect.x) / contentRect.width;
            const relativeY = (sticker.y - contentRect.y) / contentRect.height;
            const relativeW = sticker.width / contentRect.width;
            const canvasX = videoOnCanvasRect!.x + (relativeX * videoOnCanvasRect!.w);
            const canvasY = videoOnCanvasRect!.y + (relativeY * videoOnCanvasRect!.h);
            const canvasSize = relativeW * videoOnCanvasRect!.w;
            drawStickerOnCanvas(ctx, sticker, canvasX, canvasY, canvasSize);
          });
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

    startTimeRef.current = performance.now();
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