// src/components/ActorGrid.tsx
import React, { useState } from 'react';
import Webcam from 'react-webcam';
import { Mic, MicOff, VideoOff } from 'lucide-react';
import { ActorCount, ActorDeviceConfig } from '@/types';
import { AudioVisualizer } from './AudioVisualizer';

interface ActorGridProps {
  count: ActorCount;
  isRecording: boolean;
  deviceConfig: ActorDeviceConfig;
  webcamRefs: React.MutableRefObject<(Webcam | null)[]>;
}

export function ActorGrid({ count, isRecording, deviceConfig, webcamRefs }: ActorGridProps) {
  const [streams, setStreams] = useState<{[key: number]: MediaStream | null}>({});

  const handleUserMedia = (index: number) => (stream: MediaStream) => {
    setStreams(prev => ({ ...prev, [index]: stream }));
  };

  // Grid CSS logic
  let gridClass = "grid-cols-1";
  if (count === 2) gridClass = "grid-cols-1 md:grid-cols-2";
  if (count >= 3 && count <= 4) gridClass = "grid-cols-2";
  if (count >= 5 && count <= 6) gridClass = "grid-cols-2 lg:grid-cols-3";
  if (count >= 7) gridClass = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`grid ${gridClass} gap-4 h-full p-4 overflow-y-auto auto-rows-[1fr]`}>
      {Array.from({ length: count }).map((_, i) => {
        const hasVideo = deviceConfig[i]?.videoDeviceId !== 'no-video';
        const currentVideoId = deviceConfig[i]?.videoDeviceId; // Get the specific ID

        return (
          <div key={i} className="relative bg-black rounded-xl overflow-hidden border border-gray-800 group h-full w-full">
            {/* Webcam Component */}
            <Webcam
              // FIX: Add key to force re-render when device changes
              key={`${i}-${currentVideoId}`} 
              
              ref={(el: Webcam | null) => {
                if (webcamRefs.current) {
                  webcamRefs.current[i] = el;
                }
              }}
              audio={true} 
              muted={true}
              className={`w-full h-full object-cover ${hasVideo ? 'opacity-100' : 'opacity-0'}`}
              onUserMedia={handleUserMedia(i)}
              videoConstraints={
                hasVideo 
                ? {
                    deviceId: currentVideoId ? { exact: currentVideoId } : undefined, // More specific constraint
                    width: 1280,
                    height: 720
                  }
                : false
              }
              audioConstraints={{
                deviceId: deviceConfig[i]?.audioDeviceId
              }}
            />

            {!hasVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-500">
                <VideoOff size={48} className="mb-2 opacity-50" />
                <span className="text-sm font-medium">Camera Off</span>
              </div>
            )}

            <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm font-bold flex items-center gap-2 backdrop-blur-sm z-10">
              Actor {i + 1}
              {!hasVideo && <span className="text-xs text-gray-400 font-normal border-l border-gray-600 pl-2">Audio Only</span>}
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-end justify-between">
               <div className="w-1/3 h-full">
                 <AudioVisualizer stream={streams[i] || null} />
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
