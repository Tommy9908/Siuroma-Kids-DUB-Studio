"use client";

import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { 
  RotateCcw, Play, Pause, Square, Download, Volume2, VolumeX, 
  Smartphone, Monitor, Layout, Maximize
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { ActorGrid } from "@/components/ActorGrid";
import { SoundBoard } from "@/components/SoundBoard";
import { Header } from "@/components/Header";
import { InteractiveWatermark, WatermarkState } from "@/components/InteractiveWatermark";
import { InteractiveText, TextState } from '@/components/InteractiveText';
import { InteractiveSticker } from '@/components/InteractiveSticker';

// Hooks & Types
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { useGridRecorder } from "@/hooks/useGridRecorder";
import { ActorCount, SourceMode, ActorDeviceConfig, StickerState, StickerTarget, ActorVideoState, FilterId } from "@/types";
import { FilterEngine } from "@/lib/FilterEngine";

export default function DubbingStudio() {
  // --- State ---\
  const [actorCount, setActorCount] = useState<ActorCount>(1);
  const [sourceMode, setSourceMode] = useState<SourceMode>('file');
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  
  // Device Configuration State
  const [deviceConfig, setDeviceConfig] = useState<ActorDeviceConfig>({});

  // Audio state
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Watermark State
  const [watermarkState, setWatermarkState] = useState<WatermarkState>({
    x: 16,
    y: 16,
    width: 128,
    height: 128,
    opacity: 1,
    animation: 'none',
    visible: true,
  });
  const [watermarkImage] = useState<string | null>("/images/watermark.png");

  // Text State
  const [texts, setTexts] = useState<TextState[]>([]);

  // Sticker State
  const [stickers, setStickers] = useState<StickerState[]>([]);

  // AR Face Filter State
  const [filterConfig, setFilterConfig] = useState<Record<number, { id: FilterId }>>({});
  const filterEngineRef = useRef<FilterEngine | null>(null);
  const [filterEngine, setFilterEngine] = useState<FilterEngine | null>(null);
  const [filtersAvailable, setFiltersAvailable] = useState(false);

  // Actor Video State (import video to replace an actor)
  const [actorVideos, setActorVideos] = useState<Record<number, ActorVideoState>>({});
  const actorVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const actorCellRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [actorVideoDurations, setActorVideoDurations] = useState<Record<number, number>>({});

  // View Mode
  const [viewMode, setViewMode] = useState<'studio' | 'review'>('studio');
  
  // Review Mode State
  const [previewVersion, setPreviewVersion] = useState('main'); 
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Video progress state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // --- Refs & Hooks ---\
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRefs = useRef<(Webcam | null)[]>([]);

  // Media Devices Hook
  const { devices, refreshDevices, isScanning } = useMediaDevices();

  // Recorder Hook
  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadUrls,
    setDownloadUrls,
    isRecording,
    isPaused,
    audioContext,
    audioDestination
  } = useGridRecorder(webcamRefs, videoRef, actorCount, isVideoMuted, watermarkImage, deviceConfig, watermarkState, texts, stickers, actorVideoRefs, actorCellRefs, filterEngineRef, filterConfig);

  // --- Video Handlers ---\
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setVideoProgress(progress || 0);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      // Clamp watermark and text positions to stay within actual video content area
      clampOverlaysToContent();
    }
  };

  /** Compute video content rect (object-fit: contain) and clamp overlay positions inside it */
  const clampOverlaysToContent = () => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return;

    const cw = videoEl.clientWidth;
    const ch = videoEl.clientHeight;
    const videoAspect = videoEl.videoWidth / videoEl.videoHeight;
    const containerAspect = cw / ch;

    let contentX: number, contentY: number, contentW: number, contentH: number;

    if (videoAspect > containerAspect) {
      // Video is wider → letterbox top/bottom
      contentW = cw;
      contentH = cw / videoAspect;
      contentX = 0;
      contentY = (ch - contentH) / 2;
    } else {
      // Video is taller → letterbox left/right
      contentH = ch;
      contentW = ch * videoAspect;
      contentX = (cw - contentW) / 2;
      contentY = 0;
    }

    // Clamp watermark position (only if it falls outside content area)
    setWatermarkState(prev => {
      const clampedX = Math.max(contentX, Math.min(prev.x, contentX + contentW - prev.width));
      const clampedY = Math.max(contentY, Math.min(prev.y, contentY + contentH - prev.height));
      if (clampedX !== prev.x || clampedY !== prev.y) {
        return { ...prev, x: clampedX, y: clampedY };
      }
      return prev;
    });

    // Clamp all text positions
    setTexts(prev => {
      let changed = false;
      const clamped = prev.map(t => {
        const clampedX = Math.max(contentX, Math.min(t.x, contentX + contentW - t.width));
        const clampedY = Math.max(contentY, Math.min(t.y, contentY + contentH - t.height));
        if (clampedX !== t.x || clampedY !== t.y) {
          changed = true;
          return { ...t, x: clampedX, y: clampedY };
        }
        return t;
      });
      return changed ? clamped : prev;
    });

    // Clamp all sticker positions
    setStickers(prev => {
      let changed = false;
      const clamped = prev.map(s => {
        const clampedX = Math.max(contentX, Math.min(s.x, contentX + contentW - s.width));
        const clampedY = Math.max(contentY, Math.min(s.y, contentY + contentH - s.height));
        if (clampedX !== s.x || clampedY !== s.y) {
          changed = true;
          return { ...s, x: clampedX, y: clampedY };
        }
        return s;
      });
      return changed ? clamped : prev;
    });
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = (Number(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setVideoProgress(Number(e.target.value));
    }
  };

  // --- Logic ---\
  // 1. Countdown Logic
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsPlaying(true);
        startRecording();
      }
    }
  }, [countdown, startRecording]);

  // 2. Watch for Recording Completion
  useEffect(() => {
    if (downloadUrls && Object.keys(downloadUrls).length > 0) {
      setViewMode('review');
    }
  }, [downloadUrls]);

  // 3. Auto-start recording when actorCount=1 and actor has a video
  const autoRecordTriggeredRef = useRef(false);
  useEffect(() => {
    if (autoRecordTriggeredRef.current) return;
    if (
      actorCount === 1 &&
      actorVideos[0] &&
      actorVideoDurations[0] > 0 &&
      videoSrc &&
      videoDuration > 0 &&
      !isRecording
    ) {
      autoRecordTriggeredRef.current = true;
      // Small delay to ensure everything is loaded and rendered
      const timer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
          setIsPlaying(true);
          startRecording();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [actorCount, actorVideos, actorVideoDurations, videoSrc, videoDuration, isRecording, startRecording]);

  // 4. Auto-stop recording when max video duration is reached
  useEffect(() => {
    if (!isRecording) return;

    const actorDurations = Object.values(actorVideoDurations);
    if (actorDurations.length === 0) return;

    const maxActorDuration = Math.max(...actorDurations);
    let maxDurationSec = maxActorDuration;
    if (videoDuration > 0) {
      maxDurationSec = Math.min(maxActorDuration, videoDuration);
    }

    if (maxDurationSec <= 0) return;

    const timer = setTimeout(() => {
      videoRef.current?.pause();
      setIsPlaying(false);
      stopRecording();
    }, maxDurationSec * 1000);

    return () => clearTimeout(timer);
  }, [isRecording, actorVideoDurations, videoDuration, stopRecording]);

  // 5. Initialize AR face filter engine
  useEffect(() => {
    const engine = new FilterEngine();
    filterEngineRef.current = engine;
    engine.initialize().then((success) => {
      setFiltersAvailable(success);
      if (success) setFilterEngine(engine);
    });
    return () => {
      // Cleanup: nothing to dispose (MediaPipe manages its own resources)
    };
  }, []);

  // --- Handlers ---\
  const initiateRecording = () => {
    if (!videoSrc) return alert("Please upload a video reference first.");
    setCountdown(3);
  };

  const handleStop = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
    stopRecording();
  };

  const handleDiscard = () => {
    autoRecordTriggeredRef.current = false;
    setDownloadUrls(null);
    setViewMode('studio');
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setVideoProgress(0);
    }
    setPreviewVersion('main');
  };

  const onFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
    }
  };

  const handleAddText = () => {
    if (!videoSrc) {
      alert('Please import a video first before adding text.');
      return;
    }
    setTexts(prev => [
      ...prev,
      {
        id: uuidv4(),
        text: 'Double-click to edit',
        x: 50,
        y: 50,
        width: 200,
        height: 50,
        fontSize: 20,
        color: '#FFFFFF',
        animation: 'none',
      }
    ]);
  };

  const handleTextChange = (id: string, newProps: Partial<TextState>) => {
    setTexts(prev => prev.map(t => t.id === id ? { ...t, ...newProps } : t));
  };

  const handleTextDelete = (id: string) => {
    setTexts(prev => prev.filter(t => t.id !== id));
  };

  const handleAddSticker = (emoji: string, target: StickerTarget = 'video', dropX?: number, dropY?: number) => {
    if (!videoSrc) {
      alert('Please import a video first before adding stickers.');
      return;
    }
    setStickers(prev => [
      ...prev,
      {
        id: uuidv4(),
        emoji,
        x: dropX ?? 80,
        y: dropY ?? 80,
        width: 80,
        height: 80,
        opacity: 1,
        rotation: 0,
        target,
      }
    ]);
  };

  const handleStickerChange = (id: string, newProps: Partial<StickerState>) => {
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...newProps } : s));
  };

  const handleStickerDrop = (actorIndex: number, emoji: string, x: number, y: number) => {
    if (!videoSrc) {
      alert('Please import a video first before adding stickers.');
      return;
    }
    setStickers(prev => [
      ...prev,
      {
        id: uuidv4(),
        emoji,
        x,
        y,
        width: 80,
        height: 80,
        opacity: 1,
        rotation: 0,
        target: actorIndex,
      }
    ]);
  };

  const handleStickerDelete = (id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
  };

  // --- Filter Handlers ---
  const handleSelectFilter = (filterId: FilterId, applyToAll?: boolean) => {
    if (applyToAll) {
      // Apply to all actors
      const config: Record<number, { id: FilterId }> = {};
      for (let i = 0; i < actorCount; i++) {
        config[i] = { id: filterId };
      }
      setFilterConfig(config);
      filterEngineRef.current?.setFilterConfig(config);
    } else {
      // Apply to first actor that doesn't have a filter, or cycle through
      // For simplicity, clicking a filter applies it to actor 0 by default
      // Users can change which actor has which filter via future per-actor selector
      setFilterConfig((prev) => {
        const next = { ...prev, 0: { id: filterId } };
        filterEngineRef.current?.setFilterConfig(next);
        return next;
      });
    }
  };

  // --- Actor Video Handlers ---
  const handleImportActorVideo = (actorIndex: number, file: File) => {
    const src = URL.createObjectURL(file);
    setActorVideos(prev => ({
      ...prev,
      [actorIndex]: {
        src,
        duration: 0, // Will be updated when video metadata loads
        fileName: file.name,
      }
    }));
  };

  const handleActorVideoLoaded = (index: number, duration: number) => {
    setActorVideoDurations(prev => ({ ...prev, [index]: duration }));
    // Also update the duration in actorVideos state
    setActorVideos(prev => {
      if (prev[index] && prev[index].duration !== duration) {
        return { ...prev, [index]: { ...prev[index], duration } };
      }
      return prev;
    });
  };

  const handleRemoveActorVideo = (actorIndex: number) => {
    setActorVideos(prev => {
      const next = { ...prev };
      if (next[actorIndex]?.src) {
        URL.revokeObjectURL(next[actorIndex].src);
      }
      delete next[actorIndex];
      return next;
    });
    setActorVideoDurations(prev => {
      const next = { ...prev };
      delete next[actorIndex];
      return next;
    });
  };

  const handleDownloadAll = () => {
    if (!downloadUrls) return;
    Object.entries(downloadUrls).forEach(([key, url]) => {
      const a = document.createElement('a');
a.href = url;
      a.download = `recording-${key}.mp4`; 
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  // --- Render ---\

  // REVIEW VIEW
  if (viewMode === 'review') {
    const currentKey = `${orientation}-${previewVersion}`;
    const currentUrl = downloadUrls ? downloadUrls[currentKey] : null;

    return (
      <div className="min-h-screen bg-black text-white flex flex-col p-6">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            Review Recording
          </h1>
          <button onClick={handleDiscard} className="text-gray-400 hover:text-white flex items-center gap-2">
            <RotateCcw size={16} /> Discard & New
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center gap-6">
          <div className={`relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden shadow-2xl transition-all duration-500
             ${orientation === 'landscape' ? 'aspect-video w-full max-w-4xl' : 'aspect-[9/16] h-[70vh]'}`}>
            {currentUrl ? (
              <video 
                src={currentUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                Video not found for this configuration.
              </div>
            )}
          </div>

          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col gap-4 w-full max-w-4xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
               <div className="flex bg-gray-800 rounded-lg p-1">
                 <button
                   onClick={() => setOrientation('landscape')}
                   className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition ${orientation === 'landscape' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                 >
                   <Monitor size={16} /> Landscape
                 </button>
                 <button
                   onClick={() => setOrientation('portrait')}
                   className={`px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition ${orientation === 'portrait' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                 >
                   <Smartphone size={16} /> Portrait
                 </button>
               </div>

               {downloadUrls && (
                 <button 
                   onClick={handleDownloadAll}
                   className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 font-medium transition"
                 >
                   <Download size={18} /> Download All Versions
                 </button>
               )}
            </div>

            <div className="h-px bg-gray-800 w-full" />

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setPreviewVersion('main')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap border transition ${
                  previewVersion === 'main' 
                    ? 'bg-gray-800 border-blue-500 text-blue-400' 
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                }`}
              >
                <Layout size={16} /> 
                Main Mix
              </button>
              
              {orientation === 'landscape' && (
                  <button
                    onClick={() => setPreviewVersion('clean')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap border transition ${
                      previewVersion === 'clean' 
                        ? 'bg-gray-800 border-blue-500 text-blue-400' 
                        : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    <Maximize size={16} /> 
                    Clean Mix
                  </button>
              )}

              {Array.from({ length: actorCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewVersion(`focus-${i}`)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap border transition ${
                    previewVersion === `focus-${i}`
                      ? 'bg-gray-800 border-blue-500 text-blue-400' 
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-white">
                    {i + 1}
                  </div>
                  Focus Actor {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STUDIO VIEW
  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden">
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
           <div className="text-9xl font-black text-white animate-bounce">
             {countdown === 0 ? "GO!" : countdown}
           </div>
        </div>
      )}

      <Header
         sourceMode={sourceMode}
         setSourceMode={setSourceMode}
         actorCount={actorCount}
         setActorCount={setActorCount}
         onFileImport={onFileImport}
         onImportActorVideo={handleImportActorVideo}
         onAddText={handleAddText}
         isWatermarkVisible={watermarkState.visible}
         onToggleWatermark={() => setWatermarkState(prev => ({ ...prev, visible: !prev.visible }))}
         devices={devices}
         config={deviceConfig}
         setConfig={setDeviceConfig}
         refreshDevices={refreshDevices}
         isScanning={isScanning}
         onAddSticker={handleAddSticker}
         onSelectFilter={handleSelectFilter}
         filtersAvailable={filtersAvailable}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Reference Video */}
        <div className="w-1/2 border-r border-gray-800 relative bg-gray-900 flex flex-col">
          {!videoSrc ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
              <div className="p-4 rounded-full bg-gray-800/50">
                <Download size={48} className="opacity-50" />
              </div>
              <p>Import a video to start dubbing</p>
            </div>
          ) : (
            <>
               <div
                 className="flex-1 relative"
                 onDragOver={(e) => {
                   e.preventDefault();
                   e.dataTransfer.dropEffect = 'copy';
                 }}
                 onDrop={(e) => {
                   e.preventDefault();
                   const emoji = e.dataTransfer.getData('text/plain');
                   if (!emoji) return;
                   const container = e.currentTarget;
                   const rect = container.getBoundingClientRect();
                   const x = e.clientX - rect.left - 40;
                   const y = e.clientY - rect.top - 40;
                   handleAddSticker(emoji, 'video', Math.max(0, x), Math.max(0, y));
                 }}
               >
                 <video
                   ref={videoRef}
                   src={videoSrc}
                   className="w-full h-full object-contain"
                   muted={isVideoMuted}
                   onTimeUpdate={handleVideoTimeUpdate}
                   onLoadedMetadata={handleVideoLoadedMetadata}
                 />
                 {/* Interactive Elements */}
                 {watermarkImage && watermarkState.visible && (
                   <InteractiveWatermark
                      src={watermarkImage}
                      state={watermarkState}
                      onChange={(newState) => setWatermarkState(prev => ({...prev, ...newState}))}
                      containerRef={videoRef}
                   />
                 )}
                 {texts.map(text => (
                    <InteractiveText
                      key={text.id}
                      state={text}
                      onChange={(newState) => handleTextChange(text.id, newState)}
                      onDelete={() => handleTextDelete(text.id)}
                      containerRef={videoRef}
                    />
                 ))}
                 {stickers.filter(s => s.target === 'video').map(sticker => (
                    <InteractiveSticker
                      key={sticker.id}
                      state={sticker}
                      onChange={(newState) => handleStickerChange(sticker.id, newState)}
                      onDelete={() => handleStickerDelete(sticker.id)}
                      containerRef={videoRef}
                    />
                 ))}
               </div>
               
               {/* Controls Bar */}
               <div className="border-t border-gray-800 bg-black/90 p-4 flex flex-col gap-4">
                  
                  {/* Progress Bar Row */}
                  <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
                    <span>{formatTime((videoProgress / 100) * videoDuration)}</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={videoProgress}
                        onChange={handleVideoSeek}
                        className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                        disabled={isRecording}
                    />
                    <span>{formatTime(videoDuration)}</span>
                  </div>

                  {/* Buttons Row (Centered Layout) */}
                  <div className="flex items-center justify-between">
                      <div className="flex-1"></div>
                      <div className="flex items-center gap-6">
                          <button 
                            onClick={() => setIsVideoMuted(!isVideoMuted)}
                            className={`p-3 rounded-full transition ${
                                isVideoMuted ? 'bg-red-600/20 text-red-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                            title={isVideoMuted ? "Unmute Reference Video" : "Mute Reference Video"}
                          >
                            {isVideoMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                          </button>

                          {!isRecording ? (
                            <button 
                              onClick={initiateRecording}
                              className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full flex items-center gap-2 transition shadow-lg shadow-red-900/20 transform hover:scale-105 active:scale-95"
                            >
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                              START RECORDING
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={isPaused ? resumeRecording : pauseRecording}
                                className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition"
                              >
                                {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
                              </button>
                              <button 
                                onClick={handleStop}
                                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-red-500 font-bold rounded-full flex items-center gap-2 transition border border-red-500/20"
                              >
                                <Square size={16} fill="currentColor" /> STOP
                              </button>
                            </div>
                          )}
                      </div>
                      <div className="flex-1"></div>
                  </div>
               </div>
            </>
          )}
        </div>

        {/* RIGHT: Actor Grid & SoundBoard */}
        <div className="w-1/2 flex flex-col bg-gray-950">
          <div className="flex-1 relative overflow-hidden">
             <ActorGrid
               count={actorCount}
               isRecording={isRecording}
               webcamRefs={webcamRefs}
               deviceConfig={deviceConfig}
               actorVideos={actorVideos}
               actorVideoRefs={actorVideoRefs}
               onActorVideoLoaded={handleActorVideoLoaded}
               onRemoveActorVideo={handleRemoveActorVideo}
               stickers={stickers}
               onStickerChange={handleStickerChange}
               onStickerDelete={handleStickerDelete}
               onStickerDrop={handleStickerDrop}
               actorCellRefs={actorCellRefs}
               filterEngine={filterEngine}
               filterConfig={filterConfig}
             />
          </div>
          
          <div className="h-56 border-t border-gray-800 bg-gray-900/50 p-4 shrink-0">
            <SoundBoard 
              audioContext={audioContext} 
              audioDestination={audioDestination} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}