// src/components/ActorGrid.tsx
import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { Mic, MicOff, VideoOff, Film, X } from 'lucide-react';
import { ActorCount, ActorDeviceConfig, ActorVideoState, StickerState, FilterId } from '@/types';
import { AudioVisualizer } from './AudioVisualizer';
import { InteractiveSticker } from './InteractiveSticker';
import { FilterOverlay } from './FilterOverlay';
import { FilterEngine } from '@/lib/FilterEngine';

interface ActorGridProps {
  count: ActorCount;
  isRecording: boolean;
  deviceConfig: ActorDeviceConfig;
  webcamRefs: React.MutableRefObject<(Webcam | null)[]>;
  actorVideos: Record<number, ActorVideoState>;
  actorVideoRefs: React.MutableRefObject<Record<number, HTMLVideoElement | null>>;
  onActorVideoLoaded?: (index: number, duration: number) => void;
  onRemoveActorVideo?: (index: number) => void;
  // Sticker props
  stickers: StickerState[];
  onStickerChange: (id: string, newProps: Partial<StickerState>) => void;
  onStickerDelete: (id: string) => void;
  onStickerDrop: (actorIndex: number, emoji: string, x: number, y: number) => void;
  actorCellRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  // Filter props
  filterEngine: FilterEngine | null;
  filterConfig: Record<number, { id: FilterId }>;
}

export function ActorGrid({
  count,
  isRecording,
  deviceConfig,
  webcamRefs,
  actorVideos,
  actorVideoRefs,
  onActorVideoLoaded,
  onRemoveActorVideo,
  stickers,
  onStickerChange,
  onStickerDelete,
  onStickerDrop,
  actorCellRefs,
  filterEngine,
  filterConfig,
}: ActorGridProps) {
  const [streams, setStreams] = useState<{[key: number]: MediaStream | null}>({});
  const [dragOverCell, setDragOverCell] = useState<number | null>(null);

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
        const currentVideoId = deviceConfig[i]?.videoDeviceId;
        const currentAudioId = deviceConfig[i]?.audioDeviceId;
        const actorName = deviceConfig[i]?.name || `Actor ${i + 1}`;
        const hasActorVideo = !!actorVideos[i];
        const cellStickers = stickers.filter(s => s.target === i);
        const isDragOver = dragOverCell === i;

        return (
          <div
            key={i}
            ref={(el) => {
              if (actorCellRefs.current) {
                actorCellRefs.current[i] = el;
              }
            }}
            className={`relative bg-black rounded-xl overflow-hidden border-2 group h-full w-full transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-950/30'
                : 'border-gray-800'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setDragOverCell(i);
            }}
            onDragLeave={() => setDragOverCell(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverCell(null);
              const emoji = e.dataTransfer.getData('text/plain');
              if (!emoji) return;
              const cellEl = actorCellRefs.current[i];
              if (!cellEl) return;
              const rect = cellEl.getBoundingClientRect();
              const x = e.clientX - rect.left - 40; // center the 80px sticker on cursor
              const y = e.clientY - rect.top - 40;
              onStickerDrop(i, emoji, Math.max(0, x), Math.max(0, y));
            }}
          >
            {hasActorVideo ? (
              /* Imported Actor Video */
              <video
                ref={(el) => {
                  if (actorVideoRefs.current) {
                    actorVideoRefs.current[i] = el;
                  }
                }}
                src={actorVideos[i].src}
                autoPlay
                loop
                muted
                className="w-full h-full object-contain"
                onLoadedMetadata={(e) => {
                  const duration = (e.target as HTMLVideoElement).duration;
                  if (onActorVideoLoaded && isFinite(duration)) {
                    onActorVideoLoaded(i, duration);
                  }
                }}
              />
            ) : (
              /* Webcam Component */
              <Webcam
                key={`${i}-${currentVideoId}-${currentAudioId}`}

                ref={(el: Webcam | null) => {
                  if (webcamRefs.current) {
                    webcamRefs.current[i] = el;
                  }
                }}
                audio={true}
                muted={true}
                className={`w-full h-full object-contain ${hasVideo ? 'opacity-100' : 'opacity-0'}`}
                onUserMedia={handleUserMedia(i)}
                videoConstraints={
                  hasVideo
                  ? {
                      deviceId: currentVideoId ? { exact: currentVideoId } : undefined,
                      width: 1280,
                      height: 720
                    }
                  : false
                }
                audioConstraints={{
                  deviceId: currentAudioId ? { exact: currentAudioId } : undefined
                }}
              />
            )}

            {/* Drag-over hint */}
            {isDragOver && (
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <div className="bg-blue-600/80 text-white px-4 py-2 rounded-lg text-sm font-bold backdrop-blur-sm">
                  Drop sticker on {actorName}
                </div>
              </div>
            )}

            {!hasVideo && !hasActorVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-500">
                <VideoOff size={48} className="mb-2 opacity-50" />
                <span className="text-sm font-medium">Camera Off</span>
              </div>
            )}

            {/* Sticker overlays on this actor */}
            {cellStickers.map(sticker => (
              <InteractiveSticker
                key={sticker.id}
                state={sticker}
                onChange={(newState) => onStickerChange(sticker.id, newState)}
                onDelete={() => onStickerDelete(sticker.id)}
                containerRef={{ current: actorCellRefs.current[i] }}
              />
            ))}

            {/* AR Face Filter Overlay */}
            <FilterOverlay
              actorIndex={i}
              videoEl={
                hasActorVideo
                  ? actorVideoRefs.current[i]
                  : webcamRefs.current[i]?.video ?? null
              }
              filterEngine={filterEngine}
              filterId={filterConfig[i]?.id ?? 'none'}
            />

            <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm font-bold flex items-center gap-2 backdrop-blur-sm z-10">
              {hasActorVideo && <Film size={14} className="text-blue-400" />}
              {actorName}
              {!hasVideo && !hasActorVideo && <span className="text-xs text-gray-400 font-normal border-l border-gray-600 pl-2">Audio Only</span>}
              {hasActorVideo && <span className="text-xs text-blue-400 font-normal border-l border-gray-600 pl-2">Video</span>}
            </div>

            {/* Remove Actor Video Button */}
            {hasActorVideo && onRemoveActorVideo && (
              <button
                onClick={() => onRemoveActorVideo(i)}
                className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Remove imported video"
              >
                <X size={14} />
              </button>
            )}

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
