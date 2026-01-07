"use client";

import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { 
  RotateCcw, Play, Pause, Square, Download, Volume2, VolumeX 
} from 'lucide-react';

// Components
import { VideoPlayer } from "@/components/VideoPlayer";
import { ActorGrid } from "@/components/ActorGrid";
import { Header } from "@/components/Header";
import { DeviceSettings } from "@/components/DeviceSettings";
// Import the new SoundBoard component
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

  // Stores the selected Camera/Mic for each actor
  const [deviceConfig, setDeviceConfig] = useState<ActorDeviceConfig>({});

  // Audio state for Reference Video
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'studio' | 'review'>('studio');

  // Video progress state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // Header props (placeholders/state)
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [hdmiVolume, setHdmiVolume] = useState(0);

  // --- Refs & Hooks ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRefs = useRef<(Webcam | null)[]>([]);

  // Destructure refreshDevices to pass it to settings
  const { devices, refreshDevices, isScanning } = useMediaDevices();

  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadUrls, // UPDATED
    setDownloadUrls,
    isRecording,
    isPaused
  } = useGridRecorder(webcamRefs, videoRef, actorCount, isVideoMuted);

  // --- Video Handlers ---
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

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    if (downloadUrls) {
      setViewMode('review');
    }
  }, [downloadUrls]);

  const [previewVersion, setPreviewVersion] = useState('main');

  const initiateRecording = () => {
    if (!videoSrc) return alert("Please upload a video reference first.");
    setCountdown(3);
  };

  const handleStop = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
    stopRecording();
    // The useEffect above will handle switching to 'review' when data is ready
  };

  const handleDiscard = () => {
    setDownloadUrls(null);
    setViewMode('studio');
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  // Header Handlers
  const onFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoSrc(URL.createObjectURL(file));
    }
  };

  // --- Review View ---
  if (viewMode === 'review') {
    const currentUrl = downloadUrls ? downloadUrls[previewVersion] : null;

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 gap-6">
        <h2 className="text-3xl font-bold mb-4">Recording Review</h2>
        
        {/* Version Selector */}
        <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
          <button 
            onClick={() => setPreviewVersion('main')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition ${
              previewVersion === 'main' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            Main Mix (Equal)
          </button>
          {Array.from({ length: actorCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPreviewVersion(`focus-${i}`)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition ${
                previewVersion === `focus-${i}` ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              Focus Actor {i + 1}
            </button>
          ))}
        </div>

        {currentUrl && (
          <div className="w-full max-w-4xl bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
            <video src={currentUrl} controls className="w-full h-auto" />
          </div>
        )}

        <div className="flex gap-4 mt-6">
          <button 
            onClick={handleDiscard}
            className="px-8 py-3 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg font-bold transition flex items-center gap-2"
          >
            <RotateCcw size={20} />
            Discard All
          </button>
          
          {/* Save Current Version */}
          {currentUrl && (
             <a 
               href={currentUrl} 
               download={`dubbing-${previewVersion}.webm`}
               className="px-8 py-3 bg-green-600 text-white hover:bg-green-500 rounded-lg font-bold transition flex items-center gap-2"
             >
               <Download size={20} />
               Save This Version
             </a>
          )}
        </div>
      </div>
    );
  }

  // --- Studio View ---
  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      
      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-[12rem] font-black text-white animate-pulse">
            {countdown === 0 ? "GO!" : countdown}
          </div>
        </div>
      )}

      {/* Header */}
      <Header 
        actorCount={actorCount}
        setActorCount={setActorCount}
        onFileImport={onFileImport}
        sourceMode={sourceMode}
        setSourceMode={setSourceMode}
        // Passthrough props for device settings in header (if you move it there)
        devices={devices}
        isScanning={isScanning}
        refreshDevices={refreshDevices}
        selectedDeviceId={selectedDeviceId}
        setSelectedDeviceId={setSelectedDeviceId}
        hdmiVolume={hdmiVolume}
        setHdmiVolume={setHdmiVolume}
      />

      <main className="flex-1 p-4 flex gap-4 overflow-hidden">
        {/* LEFT: Reference Video */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden relative">
            {!videoSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                <div className="w-16 h-16 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center mb-4">
                  <Play size={32} className="opacity-50" />
                </div>
                <p>Import a video to start dubbing</p>
              </div>
            )}
            
            <VideoPlayer 
              ref={videoRef} 
              fileSrc={videoSrc}
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={handleVideoLoadedMetadata}
              isMuted={isVideoMuted}
            />
          </div>

          {/* Controls Section with Slider */}
          {videoSrc && (
            <div className="bg-gray-900 p-4 rounded-xl flex items-center gap-4">
               {/* Progress Bar */}
               <span className="text-xs font-mono text-gray-400 w-12 text-right">
                 {formatTime((videoProgress / 100) * videoDuration)}
               </span>
               <input 
                 type="range" 
                 min="0" 
                 max="100" 
                 value={videoProgress}
                 onChange={handleVideoSeek}
                 className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
               />
               <span className="text-xs font-mono text-gray-400 w-12">
                 {formatTime(videoDuration)}
               </span>

               <div className="w-px h-8 bg-gray-700 mx-2" />

               {/* Control Buttons */}
               
               {/* Mute Toggle */}
               <button 
                 onClick={() => setIsVideoMuted(!isVideoMuted)}
                 className={`p-4 rounded-full transition ${
                    isVideoMuted ? 'bg-red-600/20 text-red-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                 }`}
                 title={isVideoMuted ? "Unmute Reference Video" : "Mute Reference Video"}
               >
                 {isVideoMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
               </button>

               {!isRecording ? (
                 <button 
                   onClick={initiateRecording}
                   className="flex-1 bg-red-600 hover:bg-red-500 text-white p-4 rounded-full font-bold transition flex items-center justify-center gap-2"
                 >
                   <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
                   START RECORDING
                 </button>
               ) : (
                 <>
                   <button 
                     onClick={() => {
                        if (isPaused) {
                          resumeRecording();
                          videoRef.current?.play();
                        } else {
                          pauseRecording();
                          videoRef.current?.pause();
                        }
                     }}
                     className="p-4 bg-gray-800 hover:bg-gray-700 rounded-full transition"
                   >
                     {isPaused ? <Play size={24} /> : <Pause size={24} />}
                   </button>
                   
                   <button 
                     onClick={handleStop}
                     className="flex-1 bg-gray-800 hover:bg-gray-700 text-white p-4 rounded-full font-bold transition flex items-center justify-center gap-2"
                   >
                     <Square size={20} className="fill-current" />
                     STOP
                   </button>
                 </>
               )}
            </div>
          )}
        </div>

        {/* RIGHT: Actor Grid & Settings & SoundBoard */}
        <div className="flex-1 flex flex-col h-full gap-4 relative">
          {/* Main Actor Grid Area - Takes available space */}
          <div className="flex-1 min-h-0">
            <ActorGrid
              count={actorCount}
              isRecording={isRecording}
              deviceConfig={deviceConfig}
              webcamRefs={webcamRefs}
            />
          </div>

          {/* Sound Board - Fixed height at bottom */}
          <div className="flex-none">
            <SoundBoard />
          </div>

          {/* Device Settings Button (Floating) */}
          <DeviceSettings 
             devices={devices} 
             refreshDevices={refreshDevices}
             isScanning={isScanning}
             actorCount={actorCount}
             deviceConfig={deviceConfig}
             setDeviceConfig={setDeviceConfig}
          />
        </div>
      </main>
    </div>
  );
}
