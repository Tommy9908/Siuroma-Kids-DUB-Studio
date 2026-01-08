// src/app/page.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { 
  RotateCcw, Play, Pause, Square, Download, Volume2, VolumeX, 
  Smartphone, Monitor, Layout, Type
} from 'lucide-react';

// Components
import { VideoPlayer } from "@/components/VideoPlayer";
import { ActorGrid } from "@/components/ActorGrid";
import { Header } from "@/components/Header";
import { SoundBoard } from "@/components/SoundBoard";

// Hooks & Types
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { useGridRecorder } from "@/hooks/useGridRecorder";
import { ActorCount, SourceMode, ActorDeviceConfig } from "@/types";

export default function DubbingStudio() {
  // --- State ---
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
  const [watermarkText, setWatermarkText] = useState("Dubbing Studio");
  
  // View Mode
  const [viewMode, setViewMode] = useState<'studio' | 'review'>('studio');
  
  // Review Mode State
  const [previewVersion, setPreviewVersion] = useState('main'); // 'main' | 'focus-0' | 'focus-1'...
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Video progress state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // --- Refs & Hooks ---
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
  } = useGridRecorder(webcamRefs, videoRef, actorCount, isVideoMuted, watermarkText);

  // --- Video Handlers (Restored) ---

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
    }
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = (Number(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setVideoProgress(Number(e.target.value));
    }
  };

  // --- Logic ---

  // 1. Countdown Logic
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished -> Start
      setCountdown(null);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsPlaying(true);
        startRecording();
      }
    }
  }, [countdown, startRecording]);

  // 2. Watch for Recording Completion to Switch Views
  useEffect(() => {
    if (downloadUrls && Object.keys(downloadUrls).length > 0) {
      setViewMode('review');
    }
  }, [downloadUrls]);

  // --- Handlers ---

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
    setDownloadUrls(null);
    setViewMode('studio');
    // Reset video to start
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setVideoProgress(0);
    }
    setPreviewVersion('main');
  };

  // Header Handlers
  const onFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
    }
  };

  // --- Render ---

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
          
          {/* Main Preview Player */}
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

          {/* Controls Container */}
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col gap-4 w-full max-w-4xl">
            
            <div className="flex flex-wrap items-center justify-between gap-4">
               {/* Orientation Toggles */}
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

               {/* Download Button */}
               {currentUrl && (
                 <a 
                   href={currentUrl} 
                   download={`recording-${currentKey}.webm`}
                   className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 font-medium transition"
                 >
                   <Download size={18} /> Save Video
                 </a>
               )}
            </div>

            <div className="h-px bg-gray-800 w-full" />

            {/* Version Selectors */}
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
      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
           <div className="text-9xl font-black text-white animate-bounce">
             {countdown === 0 ? "GO!" : countdown}
           </div>
        </div>
      )}

      {/* Header */}
      <Header 
         sourceMode={sourceMode}
         setSourceMode={setSourceMode}
         actorCount={actorCount}
         setActorCount={setActorCount}
         onFileImport={onFileImport}
         devices={devices}
         config={deviceConfig}
         setConfig={setDeviceConfig}
         refreshDevices={refreshDevices}
         isScanning={isScanning}
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
               <div className="flex-1 relative">
                 <video
                   ref={videoRef}
                   src={videoSrc}
                   className="w-full h-full object-contain"
                   muted={isVideoMuted}
                   onTimeUpdate={handleVideoTimeUpdate}
                   onLoadedMetadata={handleVideoLoadedMetadata}
                 />
                 {/* Floating Watermark Preview */}
                 {watermarkText && (
                   <div className="absolute bottom-4 right-4 text-white/50 text-sm font-bold pointer-events-none drop-shadow-md z-10">
                     {watermarkText}
                   </div>
                 )}
               </div>
               
               {/* Controls Bar */}
               <div className="border-t border-gray-800 bg-black/90 p-4 flex flex-col gap-4">
                  
                  {/* Watermark Input */}
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-800">
                    <Type size={16} className="text-gray-500" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Watermark</span>
                    <input 
                      type="text" 
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      placeholder="Enter watermark text..."
                      className="bg-gray-950 border border-gray-700 text-gray-300 text-sm rounded px-3 py-1 focus:outline-none focus:border-blue-500 focus:text-white transition w-full"
                    />
                  </div>

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
                      {/* Left Spacer */}
                      <div className="flex-1"></div>

                      {/* Center Controls Group */}
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

                      {/* Right Spacer */}
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
               webcamRefs={webcamRefs}
               deviceConfig={deviceConfig}
             />
          </div>
          
          {/* Constrain SoundBoard Height: Fixed height (h-56 or h-64) ensures it doesn't push up. */}
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
